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
        const migrationPath = path.join(__dirname, 'migration_v15_drop_aplica_iva.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v15: DROP aplica_iva from customers...');
        await pool.query(sql);
        console.log('Migration v15 completed successfully.');
    } catch (error) {
        console.error('Migration v15 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
