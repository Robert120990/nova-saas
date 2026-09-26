const mysql = require('../server/node_modules/mysql2/promise');
const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    console.log('[Migration v231] Starting migration v231...');

    const [existing] = await connection.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_cip_logs' AND COLUMN_NAME = 'batch_id'"
    );
    if (existing.length === 0) {
        await connection.query('ALTER TABLE egg_cip_logs ADD COLUMN batch_id INT NULL AFTER operator_name, ADD INDEX idx_cip_batch (batch_id)');
        console.log('[Migration v231] Added column batch_id to egg_cip_logs.');
    } else {
        console.log('[Migration v231] Column batch_id already exists in egg_cip_logs.');
    }

    console.log('[Migration v231] Migration completed successfully.');
    await connection.end();
}

run().catch(err => {
    console.error('[Migration v231] ERROR:', err);
    process.exit(1);
});
