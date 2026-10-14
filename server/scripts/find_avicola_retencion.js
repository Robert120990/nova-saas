const pool = require('../src/config/db');

(async () => {
    try {
        const [rows] = await pool.query(`
            SELECT id, company_id, tipo_documento_id, numero_documento, num_control, total_gravada, retencion, percepcion, monto_total, observaciones
            FROM expense_headers
            WHERE tipo_documento_id = '06' AND (retencion > 0 OR percepcion > 0)
            LIMIT 10
        `);
        console.log('Sample 06 records:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
})();
