/**
 * Background Job: Auto-Close Contingency Periods
 * Verifica periódicamente la estabilidad de conexión con el Ministerio de Hacienda.
 * Si Hacienda se encuentra operativa y el período ha cumplido el tiempo mínimo de enfriamiento,
 * cierra la contingencia automáticamente, transmite el informe oficial y dispara la retransmisión.
 */

const pool = require('../config/db');
const { authenticate } = require('../transmission/transmissionService');
const { stopContingency, sendContingencyReport } = require('../contingency/contingencyService');
const { contingencyQueue } = require('../queue');

const MIN_OPEN_MINUTES = parseInt(process.env.CONTINGENCY_AUTO_CLOSE_MIN_MINUTES, 10) || 5;

async function checkAndAutoCloseContingencies(options = {}) {
    try {
        const { isSimulatedOutage } = require('../config/haciendaConfig');
        // Chequeo en memoria y chequeo directo en base de datos para máxima consistencia
        const [flagRows] = await pool.query('SELECT flag_value FROM system_runtime_flags WHERE flag_key = "simulated_outage" LIMIT 1');
        const dbOutage = flagRows.length > 0 && (flagRows[0].flag_value === 'true' || flagRows[0].flag_value === '1');

        if (isSimulatedOutage() || dbOutage) {
            console.log('[AutoContingencyCloser] Simulación de corte activa en el POS (verificada en BD/memoria). Se suspende auto-cierre.');
            return;
        }

        const { bypassCooldown = false } = options;
        // 1. Buscar contingencias abiertas que hayan sido originadas por activación automática (tipo 1 o motivo automático)
        // y con al menos MIN_OPEN_MINUTES de duración (salvo que bypassCooldown sea true en pruebas).
        const [openContingencies] = await pool.query(
            'SELECT dc.id, dc.company_id, dc.branch_id, dc.fecha_inicio, ' +
            'TIMESTAMPDIFF(MINUTE, dc.fecha_inicio, NOW()) as minutes_open, ' +
            'c.api_user, c.api_password, c.ambiente, ' +
            'b.ambiente AS branch_ambiente ' +
            'FROM dte_contingencies dc ' +
            'JOIN companies c ON dc.company_id = c.id ' +
            'LEFT JOIN branches b ON dc.branch_id = b.id ' +
            'WHERE dc.estado = "OPEN" ' +
            'AND (dc.motivo LIKE "%activación automática%" OR dc.motivo LIKE "%auto%") ' +
            (bypassCooldown ? '' : 'AND TIMESTAMPDIFF(MINUTE, dc.fecha_inicio, NOW()) >= ' + pool.escape(MIN_OPEN_MINUTES))
        );

        if (openContingencies.length === 0) return;

        console.log(`[AutoContingencyCloser] Evaluando ${openContingencies.length} período(s) de contingencia abierto(s)...`);

        for (const task of openContingencies) {
            try {
                const ambiente = task.branch_ambiente || task.ambiente;

                // 2. Comprobar salud real de conexión y autenticación con Hacienda (forzando verificación sin token en caché)
                const auth = await authenticate(task.api_user, task.api_password, ambiente, true);

                if (auth.success) {
                    console.log(`[AutoContingencyCloser] 🟢 Hacienda restablecida para empresa ${task.company_id}. Cerrando automáticamente contingencia ${task.id} (${task.minutes_open} min abierta)...`);

                    // 3. Cerrar el período en base de datos
                    await stopContingency(task.id);

                    // 4. Generar, validar, firmar y transmitir el reporte oficial del evento a Hacienda
                    const reportResult = await sendContingencyReport(task.id);
                    if (reportResult.success) {
                        console.log(`[AutoContingencyCloser] ✅ Reporte de contingencia ${task.id} enviado exitosamente a Hacienda. Iniciando retransmisión de documentos...`);
                        // 5. Disparar cola BullMQ de retransmisión solo cuando el evento ya fue registrado en Hacienda
                        contingencyQueue.enqueueContingencyDocuments(task.company_id).catch(err => {
                            console.error('[AutoContingencyCloser] Error encolando documentos en BullMQ:', err.message);
                        });
                    } else {
                        console.warn(`[AutoContingencyCloser] ⚠️ Reporte de contingencia ${task.id} no pudo enviarse a MH (${reportResult.message}). Se pospone retransmisión para evitar rechazo 007.`);
                    }
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
    autoCloseWorker = setInterval(() => {
        checkAndAutoCloseContingencies().catch(err => {
            console.error('[AutoContingencyCloser] Error no capturado en worker:', err.message);
        });
    }, intervalMs);
    console.log(`[AutoContingencyCloser] Started (interval: ${intervalMs}ms, min cooldown: ${MIN_OPEN_MINUTES}m)`);
}

module.exports = {
    checkAndAutoCloseContingencies,
    startAutoCloseWorker
};
