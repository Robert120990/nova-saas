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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v48_gas_settings_branch.sql'), 'utf8');
        console.log('Running migration v48: Add branch_id to gas_station_settings...');
        await pool.query(sql);
        console.log('Migration v48 completed.');
    } catch (error) {
        console.error('Migration v48 failed:', error.message);
    } finally {
        await pool.end();
    }
}
runMigration();
