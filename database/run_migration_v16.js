const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v16_pais_default_222.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v16: Set pais=222 on all customers...');
        await pool.query(sql);
        console.log('Migration v16 completed successfully.');
    } catch (error) {
        console.error('Migration v16 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
