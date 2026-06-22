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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v55_gas_despachador_remesas.sql'), 'utf8');
        console.log('Running migration v55: Add despachador_id to remesas...');
        await pool.query(sql);
        console.log('Migration v55 completed.');
    } catch (error) {
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
            console.log('Migration v55: column(s) may already exist.');
        } else {
            console.error('Migration v55 failed:', error.message);
        }
    } finally {
        await pool.end();
    }
}
runMigration();
