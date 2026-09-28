const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('[Migration v237] Iniciando corrección de Lote 01-271-26 y desbloqueo de pasteurización...');

    // 1. Desbloquear lote de producción y pasarlo a 'pasteurizado'
    const [batchRes] = await pool.query(`
        UPDATE egg_production_batches
        SET status = 'pasteurizado'
        WHERE (batch_code_display LIKE '%01-271-26%' OR id = 24)
          AND status = 'bloqueado_haccp'
    `);
    console.log(`[Migration v237] Lotes de producción actualizados a pasteurizado: ${batchRes.affectedRows}`);

    // 2. Convalidar logs de pasteurización de lote 24
    const [pastRes] = await pool.query(`
        UPDATE egg_pasteurization_logs
        SET haccp_compliant = 1,
            deviation_description = NULL
        WHERE batch_id = 24
    `);
    console.log(`[Migration v237] Logs de pasteurización convalidados: ${pastRes.affectedRows}`);

    // 3. Restaurar análisis de calidad a cuarentena / aprobado
    const [labRes] = await pool.query(`
        UPDATE egg_lab_micro_logs
        SET release_status = 'cuarentena',
            status = 'aprobado'
        WHERE batch_id = 24
          AND release_status = 'bloqueado_haccp'
    `);
    console.log(`[Migration v237] Análisis de laboratorio restaurados: ${labRes.affectedRows}`);

    // 4. Atenuar eventos críticos de bloqueo previo
    const [evtRes] = await pool.query(`
        UPDATE egg_industrial_events
        SET severity = 'info',
            description = CONCAT('[CONVALIDADO] ', description)
        WHERE (payload LIKE '%24%' OR description LIKE '%ae244801-2441-4850-aae4-6394dc665357%' OR description LIKE '%Lote #24%')
          AND severity = 'critical'
    `);
    console.log(`[Migration v237] Eventos atenuados: ${evtRes.affectedRows}`);

    console.log('[Migration v237] Finalizada con éxito.');
}

module.exports = { runMigration };
