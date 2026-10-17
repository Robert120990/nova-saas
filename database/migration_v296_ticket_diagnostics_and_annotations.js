const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v296] Agregando soporte de multi-adjuntos anotados y diagnóstico inteligente a support_tickets...');

    const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('attachments_json')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN attachments_json JSON NULL AFTER screenshot_url
        `);
        console.log('  → Columna attachments_json agregada a support_tickets.');
    }

    if (!colNames.includes('diagnostics_json')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN diagnostics_json JSON NULL AFTER browser_info
        `);
        console.log('  → Columna diagnostics_json agregada a support_tickets.');
    }

    if (!colNames.includes('diagnostic_relevance')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN diagnostic_relevance VARCHAR(30) NOT NULL DEFAULT 'sin_errores' AFTER diagnostics_json
        `);
        console.log('  → Columna diagnostic_relevance agregada a support_tickets.');
    }

    if (!colNames.includes('diagnostic_score')) {
        await pool.query(`
            ALTER TABLE support_tickets
            ADD COLUMN diagnostic_score INT NOT NULL DEFAULT 0 AFTER diagnostic_relevance
        `);
        console.log('  → Columna diagnostic_score agregada a support_tickets.');
    }

    console.log('[Migration v296] Migración completada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[Migration v296] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
