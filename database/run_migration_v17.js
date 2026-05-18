const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
const fs = require('fs');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v17_fix_catalog_codes.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v17: Fix catalog codes in customers (pais, departamento, municipio)...');
        await pool.query(sql);
        console.log('Migration v17 completed successfully.');
    } catch (error) {
        console.error('Migration v17 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
