const pool = require('../server/src/config/db');

async function addColIfMissing(table, colName, colDef) {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, colName]
    );
    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${colDef}`);
        console.log(`✅ Columna ${table}.${colName} agregada.`);
    } else {
        console.log(`ℹ️ Columna ${table}.${colName} ya existe.`);
    }
}

async function runMigration() {
    try {
        console.log('🚀 Ejecutando migración v639: Modos de IA (API vs Prompt Agente Externo) y Carga de Logs...');

        await addColIfMissing('support_tickets', 'ai_mode', "VARCHAR(30) NOT NULL DEFAULT 'agent_prompt'");
        await addColIfMissing('support_tickets', 'agent_platform', "VARCHAR(40) NOT NULL DEFAULT 'antigravity'");
        await addColIfMissing('support_tickets', 'custom_logs', 'LONGTEXT NULL');

        await addColIfMissing('ai_agent_tasks', 'execution_mode', "VARCHAR(30) NOT NULL DEFAULT 'api'");
        await addColIfMissing('ai_agent_tasks', 'agent_platform', "VARCHAR(40) NOT NULL DEFAULT 'antigravity'");
        await addColIfMissing('ai_agent_tasks', 'custom_logs', 'LONGTEXT NULL');

        // Ensure ticket-linked tasks default to agent_prompt mode
        await pool.query(`
            UPDATE ai_agent_tasks
            SET execution_mode = 'agent_prompt', agent_platform = 'antigravity'
            WHERE assigned_agent_code = 'support' OR title LIKE '[Ticket #%'
        `);

        console.log('✅ Migración v639 completada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración v639:', error);
        process.exit(1);
    }
}

runMigration();
