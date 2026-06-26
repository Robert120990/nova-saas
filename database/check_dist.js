const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
async function run() {
    const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    const [t] = await pool.query("SHOW TABLES LIKE '%dte%'");
    console.log('DTE tables:', t.map(r => Object.values(r)[0]));
    const [t2] = await pool.query("SHOW TABLES LIKE '%venta%'");
    console.log('Venta tables:', t2.map(r => Object.values(r)[0]));
    const [c] = await pool.query('SELECT id, nombre, departamento, municipio, distrito FROM customers WHERE company_id = 1');
    console.log('Customers:', JSON.stringify(c, null, 2));
    await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
