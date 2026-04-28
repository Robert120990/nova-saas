const pool = require('./src/config/db');
async function check() {
    try {
        const [p] = await pool.query('SHOW COLUMNS FROM purchase_headers');
        console.log('--- PURCHASE_HEADERS ---');
        p.forEach(c => console.log(c.Field));
        const [s] = await pool.query('SHOW COLUMNS FROM sales_headers');
        console.log('--- SALES_HEADERS ---');
        s.forEach(c => console.log(c.Field));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
