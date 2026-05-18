/**
 * Background Job: Resend Contingency DTEs
 * Con retry logic y máximo de intentos
 */

const pool = require('../../config/db');
const { authenticate, transmitDTE } = require('../transmission/transmissionService');

const MAX_RETRIES = 5;

async function processContingencyQueue() {
    console.log('[ContingencyWorker] Processing queue...');

    // 1. Get pending contingency documents (sin exceder máximo de intentos)
    const [tasks] = await pool.query(
        'SELECT cd.*, c.api_user, c.api_password, c.ambiente ' +
        'FROM dte_contingency_documents cd ' +
        'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
        'JOIN companies c ON d.company_id = c.id ' +
        'WHERE cd.estado_envio = "PENDING" AND (cd.retry_count IS NULL OR cd.retry_count < ?) ' +
        'ORDER BY cd.created_at ASC LIMIT 10',
        [MAX_RETRIES]
    );

    if (tasks.length === 0) return;

    console.log(`[ContingencyWorker] Processing ${tasks.length} pending documents`);

    for (const task of tasks) {
        try {
            // 2. Authenticate
            const auth = await authenticate(task.api_user, task.api_password);
            if (!auth.success) throw new Error(auth.message);

            // 3. Transmit
            const version = (task.tipo_documento === '01' || task.tipo_documento === '11' || task.tipo_documento === '07') ? 1 : 3;
            const ambiente = (task.ambiente === 'produccion' || task.ambiente === '01') ? '01' : '00';
            const result = await transmitDTE(auth.token, task.json_firmado, {
                ambiente: ambiente,
                tipoDte: task.tipo_documento,
                codigoGeneracion: task.codigo_generacion,
                version: version
            });

            if (result.success && result.status === 'PROCESADO') {
                // 4a. Success
                await pool.query(
                    'UPDATE dte_contingency_documents SET estado_envio = "SENT", fecha_envio_hacienda = NOW() WHERE id = ?',
                    [task.id]
                );
                await pool.query(
                    'UPDATE dtes SET status = "RETRANSMITIDO", sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                    [result.selloRecepcion, result.fhProcesamiento, task.codigo_generacion]
                );
                await pool.query(
                    'INSERT INTO dte_events (dte_id, event_type, description) SELECT id, "RETRANSMITTED", "Documento retransmitido post-contingencia" FROM dtes WHERE codigo_generacion = ?',
                    [task.codigo_generacion]
                );
                console.log(`[ContingencyWorker] ✅ ${task.codigo_generacion} retransmitido`);
            } else {
                // 4b. Hacienda rechazó
                const retries = (task.retry_count || 0) + 1;
                if (retries >= MAX_RETRIES) {
                    await pool.query(
                        'UPDATE dte_contingency_documents SET estado_envio = "FAILED", retry_count = ? WHERE id = ?',
                        [retries, task.id]
                    );
                    console.log(`[ContingencyWorker] ❌ ${task.codigo_generacion} FAILED after ${MAX_RETRIES} retries`);
                } else {
                    await pool.query(
                        'UPDATE dte_contingency_documents SET retry_count = ?, last_error = ? WHERE id = ?',
                        [retries, JSON.stringify(result.error || result.data), task.id]
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
