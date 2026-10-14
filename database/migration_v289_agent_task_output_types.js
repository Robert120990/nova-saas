const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v289] Agregando soporte para tipos de salida (texto, pdf, excel, imagen) en ai_agent_tasks...');

    // 1. Agregar output_type
    const [cols] = await pool.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_agent_tasks' AND COLUMN_NAME = 'output_type'"
    );

    if (cols.length === 0) {
        await pool.query(`
            ALTER TABLE ai_agent_tasks
            ADD COLUMN output_type ENUM('texto', 'pdf', 'excel', 'imagen') NOT NULL DEFAULT 'texto' AFTER prompt,
            ADD COLUMN output_file_url VARCHAR(500) NULL AFTER result,
            ADD COLUMN output_metadata JSON NULL AFTER output_file_url
        `);
        console.log('  → Columnas output_type, output_file_url y output_metadata agregadas a ai_agent_tasks.');
    } else {
        console.log('  → Columnas de tipo de salida ya existen en ai_agent_tasks.');
    }
}

module.exports = { up };
