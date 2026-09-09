/**
 * Background Job: Auto-Close Contingency Periods
 * Verifica periódicamente la estabilidad de conexión con el Ministerio de Hacienda.
 * Si Hacienda se encuentra operativa y el período ha cumplido el tiempo mínimo de enfriamiento,
 * cierra la contingencia automáticamente, transmite el informe oficial y dispara la retransmisión.
 */

const pool = require('../config/db');
const { authenticate } = require('../transmission/transmissionService');
const { stopContingency, sendContingencyReport } = require('../contingency/contingencyService');
const { processContingencyQueue } = require('./resendContingencyDTE');

const MIN_OPEN_MINUTES = parseInt(process.env.CONTINGENCY_AUTO_CLOSE_MIN_MINUTES, 10) || 5;

async function checkAndAutoCloseContingencies() {
    try {
        // 1. Buscar contingencias abiertas con al menos MIN_OPEN_MINUTES de duración
        const [openContingencies] = await pool.query(
            'SELECT dc.id, dc.company_id, dc.branch_id, dc.fecha_inicio, ' +
            'TIMESTAMPDIFF(MINUTE, dc.fecha_inicio, NOW()) as minutes_open, ' +
            'c.api_user, c.api_password, c.ambiente, ' +
            'b.ambiente AS branch_ambiente ' +
            'FROM dte_contingencies dc ' +
            'JOIN companies c ON dc.company_id = c.id ' +
            'LEFT JOIN branches b ON dc.branch_id = b.id ' +
            'WHERE dc.estado = "OPEN" AND TIMESTAMPDIFF(MINUTE, dc.fecha_inicio, NOW()) >= ?',
            [MIN_OPEN_MINUTES]
        );

        if (openContingencies.length === 0) return;

        console.log(`[AutoContingencyCloser] Evaluando ${openContingencies.length} período(s) de contingencia abierto(s)...`);

        for (const task of openContingencies) {
            try {
                const ambiente = task.branch_ambiente || task.ambiente;

                // 2. Comprobar salud de conexión y autenticación con Hacienda
                const auth = await authenticate(task.api_user, task.api_password, ambiente);

                if (auth.success) {
                    console.log(`[AutoContingencyCloser] 🟢 Hacienda restablecida para empresa ${task.company_id}. Cerrando automáticamente contingencia ${task.id} (${task.minutes_open} min abierta)...`);

                    // 3. Cerrar el período en base de datos
                    await stopContingency(task.id);

                    // 4. Generar, validar, firmar y transmitir el reporte oficial del evento a Hacienda
                    const reportResult = await sendContingencyReport(task.id);
                    if (reportResult.success) {
                        console.log(`[AutoContingencyCloser] ✅ Reporte de contingencia ${task.id} enviado exitosamente a Hacienda.`);
                    } else {
                        console.warn(`[AutoContingencyCloser] ⚠️ Reporte de contingencia ${task.id} finalizado con nota:`, reportResult.message);
                    }

                    // 5. Disparar worker de retransmisión inmediatamente para procesar la cola
                    processContingencyQueue().catch(err => {
                        console.error('[AutoContingencyCloser] Error activando retransmisión:', err.message);
                    });
                } else {
                    console.log(`[AutoContingencyCloser] ⏳ Hacienda continúa no disponible para empresa ${task.company_id}: ${auth.message}`);
                }
            } catch (innerErr) {
                console.error(`[AutoContingencyCloser] Error evaluando contingencia ${task.id}:`, innerErr.message);
            }
        }
    } catch (err) {
        console.error('[AutoContingencyCloser] Error general en job:', err.message);
    }
}

let autoCloseWorker = null;

function startAutoCloseWorker(intervalMs = 300000) {
    if (autoCloseWorker) return;
    autoCloseWorker = setInterval(checkAndAutoCloseContingencies, intervalMs);
    console.log(`[AutoContingencyCloser] Started (interval: ${intervalMs}ms, min cooldown: ${MIN_OPEN_MINUTES}m)`);
}

module.exports = {
    checkAndAutoCloseContingencies,
    startAutoCloseWorker
};
