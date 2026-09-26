const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    console.log('Connecting to database...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Altering customers.condicion_fiscal to VARCHAR(50) DEFAULT \'otro\'...');
        await pool.query(`
            ALTER TABLE customers 
            MODIFY COLUMN condicion_fiscal VARCHAR(50) DEFAULT 'otro'
        `);

        console.log('Updating customers without NRC from contribuyente to otro...');
        const [res1] = await pool.query(`
            UPDATE customers 
            SET condicion_fiscal = 'otro' 
            WHERE (condicion_fiscal IS NULL OR condicion_fiscal = '' OR condicion_fiscal = 'contribuyente')
              AND (nrc IS NULL OR TRIM(nrc) = '')
        `);
        console.log(`Updated ${res1.affectedRows} customers without NRC to 'otro'.`);

        console.log('Normalizing any remaining empty condicion_fiscal to otro...');
        const [res2] = await pool.query(`
            UPDATE customers 
            SET condicion_fiscal = 'otro' 
            WHERE condicion_fiscal = '' OR condicion_fiscal IS NULL
        `);
        console.log(`Updated ${res2.affectedRows} empty records.`);

        console.log('Migration v209 finished successfully!');
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
