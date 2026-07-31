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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v124_gas_settings_backfill.sql'), 'utf8');
        console.log('Running migration v124: Backfill gas_station_settings por sucursal...');
        const [result] = await pool.query(sql);
        console.log(`Migration v124 completed. Filas afectadas: ${result.affectedRows}`);
    } catch (error) {
        console.error('Migration v124 failed:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}
runMigration();
