/**
 * Background Job: Resend Contingency DTEs
 * Con retry logic y máximo de intentos
 */

const pool = require('../../config/db');
const axios = require('axios');
const { authenticate, transmitDTE } = require('../transmission/transmissionService');
const { getSchemaVersion } = require('../utils/versionMap');
const { getMHAmbiente } = require('../config/haciendaConfig');

const MAX_RETRIES = 5;

async function processContingencyQueue() {
    console.log('[ContingencyWorker] Processing queue...');

    // 1. Get pending contingency documents (solo de empresas cuya contingencia esté CERRADA)
    const [tasks] = await pool.query(
        'SELECT cd.*, c.api_user, c.api_password, d.ambiente, d.id as dte_id, d.venta_id, d.company_id ' +
        'FROM dte_contingency_documents cd ' +
        'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
        'JOIN companies c ON d.company_id = c.id ' +
        'WHERE cd.estado_envio = "PENDING" AND (cd.retry_count IS NULL OR cd.retry_count < ?) ' +
        '  AND NOT EXISTS (' +
        '      SELECT 1 FROM dte_contingencies dc ' +
        '      WHERE dc.company_id = d.company_id AND dc.estado = "OPEN"' +
        '  ) ' +
        'ORDER BY cd.created_at ASC LIMIT 10',
        [MAX_RETRIES]
    );

    if (tasks.length === 0) return;

    console.log(`[ContingencyWorker] Processing ${tasks.length} pending documents`);

    for (const task of tasks) {
        try {
            // 2. Authenticate
            const auth = await authenticate(task.api_user, task.api_password, task.ambiente);
            if (!auth.success) throw new Error(auth.message);

            // 3. Transmit
            const version = getSchemaVersion(task.tipo_documento);
            const ambiente = getMHAmbiente(task.ambiente);
            const result = await transmitDTE(auth.token, task.json_firmado, {
                ambiente: ambiente,
                tipoDte: task.tipo_documento,
                codigoGeneracion: task.codigo_generacion,
                version: version
            });

            if (result.success && result.status === 'PROCESADO') {
                // Formatear fhProcesamiento si viene como DD/MM/YYYY HH:MM:SS
                let formattedDate = result.fhProcesamiento || null;
                if (formattedDate && formattedDate.includes('/')) {
                    const [datePart, timePart] = formattedDate.split(' ');
                    const [day, month, year] = datePart.split('/');
                    formattedDate = `${year}-${month}-${day} ${timePart}`;
                }

                // 4a. Success
                await pool.query(
                    'UPDATE dte_contingency_documents SET estado_envio = "SENT", fecha_envio_hacienda = NOW() WHERE id = ?',
                    [task.id]
                );
                await pool.query(
                    'UPDATE dtes SET status = "ACCEPTED", sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                    [result.selloRecepcion, formattedDate, task.codigo_generacion]
                );
                await pool.query(
                    'UPDATE sales_headers SET sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                    [result.selloRecepcion, formattedDate, task.codigo_generacion]
                );
                await pool.query(
                    'INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "RETRANSMITTED", "Documento retransmitido y aceptado por MH post-contingencia")',
                    [task.dte_id]
                );
                console.log(`[ContingencyWorker] ✅ ${task.codigo_generacion} retransmitido y aceptado con sello ${result.selloRecepcion}`);

                // 4b. Disparar envío automático de correo al cliente con sello de Hacienda oficial
                if (task.venta_id) {
                    const mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:4000';
                    try {
                        await axios.post(`${mainServerUrl}/api/internal/dte/notify-accepted`, {
                            codigoGeneracion: task.codigo_generacion,
                            ventaId: task.venta_id,
                            companyId: task.company_id
                        }, { timeout: 10000 });
                        console.log(`[ContingencyWorker] 📧 Notificación de correo enviada al servidor para venta ${task.venta_id}`);
                    } catch (mailErr) {
                        console.warn(`[ContingencyWorker] ⚠️ Error notificando envío de correo: ${mailErr.message}`);
                    }
                }
            } else {
                // 4b. Hacienda rechazó o devolvió error
                const retries = (task.retry_count || 0) + 1;
                const lastErrorMsg = JSON.stringify(result.error || result.data || 'Rechazo MH sin detalle');
                if (retries >= MAX_RETRIES) {
                    await pool.query(
                        'UPDATE dte_contingency_documents SET estado_envio = "FAILED", retry_count = ?, last_error = ? WHERE id = ?',
                        [retries, lastErrorMsg, task.id]
                    );
                    await pool.query(
                        'UPDATE dtes SET status = "ERROR" WHERE codigo_generacion = ?',
                        [task.codigo_generacion]
                    );
                    await pool.query(
                        'INSERT INTO dte_errors (dte_id, codigo_error, mensaje_error) VALUES (?, "CONT_RETRY_ERR", ?)',
                        [task.dte_id, lastErrorMsg]
                    );
                    console.log(`[ContingencyWorker] ❌ ${task.codigo_generacion} FAILED after ${MAX_RETRIES} retries`);
                } else {
                    await pool.query(
                        'UPDATE dte_contingency_documents SET retry_count = ?, last_error = ? WHERE id = ?',
                        [retries, lastErrorMsg, task.id]
                    );
                }
            }
        } catch (error) {
            console.error(`[ContingencyWorker] Error ${task.codigo_generacion}:`, error.message);
            const retries = (task.retry_count || 0) + 1;
            if (retries >= MAX_RETRIES) {
                await pool.query(
                    'UPDATE dte_contingency_documents SET estado_envio = "FAILED", retry_count = ?, last_error = ? WHERE id = ?',
                    [retries, error.message, task.id]
                );
                await pool.query(
                    'UPDATE dtes SET status = "ERROR" WHERE codigo_generacion = ?',
                    [task.codigo_generacion]
                );
                await pool.query(
                    'INSERT INTO dte_errors (dte_id, codigo_error, mensaje_error) VALUES (?, "CONT_RETRY_ERR", ?)',
                    [task.dte_id, error.message]
                );
            } else {
                await pool.query(
                    'UPDATE dte_contingency_documents SET retry_count = ?, last_error = ? WHERE id = ?',
                    [retries, error.message, task.id]
                );
            }
        }
    }
}

let contingencyWorker = null;

function startContingencyWorker(intervalMs = 300000) {
    if (contingencyWorker) return;
    contingencyWorker = setInterval(processContingencyQueue, intervalMs);
    console.log(`[ContingencyWorker] Started (interval: ${intervalMs}ms, max retries: ${MAX_RETRIES})`);
}

module.exports = { processContingencyQueue, startContingencyWorker };
