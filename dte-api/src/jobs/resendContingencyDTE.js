/**
 * Background Job: Resend Contingency DTEs
 */

const pool = require('../../config/db');
const { authenticate, transmitDTE } = require('../transmission/transmissionService');

async function processContingencyQueue() {
    console.log('Processing contingency transmission queue...');

    // 1. Get pending contingency documents
    // Note: We need company credentials to authenticate
    const [tasks] = await pool.query(
        'SELECT cd.*, c.api_user, c.api_password, c.ambiente ' +
        'FROM dte_contingency_documents cd ' +
        'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
        'JOIN companies c ON d.company_id = c.id ' +
        'WHERE cd.estado_envio = "PENDING" ' +
        'LIMIT 10'
    );

    for (const task of tasks) {
        try {
            // 2. Authenticate
            const auth = await authenticate(task.api_user, task.api_password);
            if (!auth.success) {
                throw new Error(auth.message);
            }

            // 3. Transmit
            const result = await transmitDTE(auth.token, task.json_firmado, {
                ambiente: task.ambiente,
                tipoDte: task.tipo_documento,
                codigoGeneracion: task.codigo_generacion,
                version: 3 // Standard version for most DTEs
            });

            if (result.success && result.status === 'PROCESADO') {
                // 4. Update status
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
            } else {
                throw new Error(JSON.stringify(result.error || result.data));
            }

        } catch (error) {
            console.error(`Error retransmitting contingency DTE ${task.codigo_generacion}:`, error.message);
            // Optionally update a retry count or log to dte_errors
        }
    }
}

let contingencyWorker = null;

function startContingencyWorker(intervalMs = 300000) { // Default every 5 minutes
    if (contingencyWorker) return;
    contingencyWorker = setInterval(processContingencyQueue, intervalMs);
    console.log(`Contingency worker started (interval: ${intervalMs}ms)`);
}

module.exports = { processContingencyQueue, startContingencyWorker };
