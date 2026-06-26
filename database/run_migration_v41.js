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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v41_gas_closeouts_branch.sql'), 'utf8');
        console.log('Running migration v41: Add branch_id to closeouts...');
        await pool.query(sql);
        console.log('Migration v41 completed.');
    } catch (error) {
        if (error.message.includes('Duplicate column')) {
            console.log('Migration v41: column already exists.');
        } else {
            console.error('Migration v41 failed:', error.message);
        }
    } finally {
        await pool.end();
    }
}
runMigration();
