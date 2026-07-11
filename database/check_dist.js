const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
async function run() {
    const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    const [colinfo] = await pool.query("SHOW COLUMNS FROM companies LIKE 'distrito'");
    console.log('Columns distrito:', JSON.stringify(colinfo, null, 2));
    const [c] = await pool.query('SELECT id, razon_social, departamento, distrito FROM companies');
    console.log('Companies:', JSON.stringify(c, null, 2));
    const [dist] = await pool.query('SELECT * FROM cat_008_distrito WHERE dep_code = ? LIMIT 5', [c[0]?.departamento || '06']);
    console.log('Distritos sample:', JSON.stringify(dist, null, 2));
    const [join] = await pool.query(`
        SELECT c.id, c.razon_social, c.departamento, c.distrito, d.description AS distrito_nombre
        FROM companies c
        LEFT JOIN cat_008_distrito d ON c.distrito = d.code AND c.departamento = d.dep_code
    `);
    console.log('Join test:', JSON.stringify(join, null, 2));
    await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
