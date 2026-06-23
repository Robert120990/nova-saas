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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v62_customer_toggles.sql'), 'utf8');
        console.log('Running migration v62: Add es_credito, es_anticipado to customers...');
        await pool.query(sql);
        console.log('Migration v62 completed.');
    } catch (error) {
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
            console.log('Migration v62: columns may already exist.');
        } else {
            console.error('Migration v62 failed:', error.message);
        }
    } finally {
        await pool.end();
    }
}
runMigration();
