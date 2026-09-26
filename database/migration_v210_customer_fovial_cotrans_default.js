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
        console.log('Altering customers table defaults for aplica_fovial and aplica_cotrans to 1...');
        await pool.query(`
            ALTER TABLE customers 
            MODIFY COLUMN aplica_fovial TINYINT(1) DEFAULT 1,
            MODIFY COLUMN aplica_cotrans TINYINT(1) DEFAULT 1
        `);

        console.log('Updating existing customers with aplica_fovial = 0 or NULL to 1...');
        const [resFovial] = await pool.query(`
            UPDATE customers 
            SET aplica_fovial = 1 
            WHERE aplica_fovial = 0 OR aplica_fovial IS NULL
        `);
        console.log(`Updated ${resFovial.affectedRows} customers for aplica_fovial.`);

        console.log('Updating existing customers with aplica_cotrans = 0 or NULL to 1...');
        const [resCotrans] = await pool.query(`
            UPDATE customers 
            SET aplica_cotrans = 1 
            WHERE aplica_cotrans = 0 OR aplica_cotrans IS NULL
        `);
        console.log(`Updated ${resCotrans.affectedRows} customers for aplica_cotrans.`);

        console.log('Migration v210 finished successfully!');
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
