const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v297] Agregando columnas include_in_ai_prompt y ai_notes a support_tickets...');

    const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
    const colNames = cols.map((c) => c.Field);

    if (!colNames.includes('include_in_ai_prompt')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN include_in_ai_prompt TINYINT(1) NOT NULL DEFAULT 0 AFTER diagnostic_score
        `);
        console.log('  → Columna include_in_ai_prompt agregada a support_tickets.');
    }

    if (!colNames.includes('ai_notes')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN ai_notes TEXT NULL AFTER include_in_ai_prompt
        `);
        console.log('  → Columna ai_notes agregada a support_tickets.');
    }

    console.log('[Migration v297] Migración completada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration v297] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
