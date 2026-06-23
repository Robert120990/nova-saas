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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v61_gas_anticipos_desp.sql'), 'utf8');
        console.log('Running migration v61: Create gas_station_closeout_anticipos_despachados...');
        await pool.query(sql);
        console.log('Migration v61 completed.');
    } catch (error) {
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
            console.log('Migration v61: table may already exist.');
        } else {
            console.error('Migration v61 failed:', error.message);
        }
    } finally {
        await pool.end();
    }
}
runMigration();
