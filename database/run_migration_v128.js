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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v128_sales_remesa_deliveries.sql'), 'utf8');
        console.log('Running migration v128: Sales remesa deliveries...');
        await pool.query(sql);
        console.log('Migration v128 (tables) completed.');
    } catch (error) {
        if (error.message.includes('Duplicate') && error.message.includes('idx_shift_remesa_codigo')) {
            console.log('Migration v128: already applied.');
        } else {
            console.error('Migration v128 (tables) failed:', error.message);
        }
    } finally {
        await pool.end();
    }
}

runMigration();
