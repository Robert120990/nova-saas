/**
 * SQL-based Transmission Queue
 */

const pool = require('../../config/db');
const { authenticate, transmitDTE } = require('../transmission/transmissionService');

async function addToQueue(dteId) {
    const nextAttemptAt = new Date();
    await pool.query(
        'INSERT INTO transmission_queue (dte_id, next_attempt_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = "WAITING", next_attempt_at = ?',
        [dteId, nextAttemptAt, nextAttemptAt]
    );
}

async function processQueue() {
    console.log('Processing DTE transmission queue...');

    // 1. Get pending tasks
    const [tasks] = await pool.query(
        'SELECT tq.*, d.codigo_generacion, d.tipo_dte, d.ambiente, d.json_firmado, c.api_user, c.api_password ' +
        'FROM transmission_queue tq ' +
        'JOIN dtes d ON tq.dte_id = d.id ' +
        'JOIN companies c ON d.company_id = c.id ' +
        'WHERE tq.status IN ("WAITING", "FAILED") AND tq.attempts < tq.max_attempts AND tq.next_attempt_at <= NOW() ' +
        'LIMIT 10'
    );

    for (const task of tasks) {
        try {
            await pool.query('UPDATE transmission_queue SET status = "PROCESSING" WHERE id = ?', [task.id]);

            // 2. Authenticate
            const auth = await authenticate(task.api_user, task.api_password);
            if (!auth.success) {
                throw new Error(auth.message);
            }

            // 3. Transmit
            const result = await transmitDTE(auth.token, task.json_firmado, {
                ambiente: task.ambiente,
                tipoDte: task.tipo_dte,
                codigoGeneracion: task.codigo_generacion
            });

            if (result.success && result.status === 'PROCESADO') {
                // 4. Update DTE
                await pool.query(
                    'UPDATE dtes SET status = "ACCEPTED", sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
                    [result.selloRecepcion, result.fhProcesamiento, task.dte_id]
                );
                await pool.query('UPDATE transmission_queue SET status = "COMPLETED", attempts = attempts + 1 WHERE id = ?', [task.id]);

                // Create event
                await pool.query('INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "TRANSMITTED", "Documento aceptado por MH")', [task.dte_id]);
            } else {
                throw new Error(JSON.stringify(result.error || result.data));
            }

        } catch (error) {
            console.error(`Error processing task ${task.id}:`, error.message);
            
            // Check if it's a connectivity error to Hacienda
            const isConnectivityError = error.message.includes('ECONNREFUSED') || 
                                       error.message.includes('ETIMEDOUT') || 
                                       error.message.includes('ENOTFOUND') ||
                                       error.message.includes('502') ||
                                       error.message.includes('503');

            if (isConnectivityError) {
                const contingencyService = require('../contingency/contingencyService');
                await contingencyService.addToContingencyQueue({
                    codigoGeneracion: task.codigo_generacion,
                    tipoDocumento: task.tipo_dte,
                    jsonDte: task.json_original,
                    jsonFirmado: task.json_firmado
                });
                
                await pool.query('UPDATE transmission_queue SET status = "FAILED", last_error = "CONTINGENCIA" WHERE id = ?', [task.id]);
                return; // Stop processing this task here, it is now in contingency queue
            }

            const attempts = task.attempts + 1;
            const backoffMinutes = [1, 5, 15, 60, 360][attempts - 1] || 1440;
            const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60000);

            await pool.query(
                'UPDATE transmission_queue SET status = "FAILED", attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
                [attempts, nextAttemptAt, error.message, task.id]
            );

            await pool.query('INSERT INTO dte_errors (dte_id, codigo_error, mensaje_error) VALUES (?, "TRANS_ERR", ?)', [task.dte_id, error.message]);
        }
    }
}

let queueInterval = null;

function startQueueWorker(intervalMs = 60000) {
    if (queueInterval) return;
    queueInterval = setInterval(processQueue, intervalMs);
    console.log(`Queue worker started (interval: ${intervalMs}ms)`);
}

function stopQueueWorker() {
    if (queueInterval) {
        clearInterval(queueInterval);
        queueInterval = null;
    }
}

module.exports = { addToQueue, processQueue, startQueueWorker, stopQueueWorker };
