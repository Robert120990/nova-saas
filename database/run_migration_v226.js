const mysql = require('../server/node_modules/mysql2/promise');
const fs = require('fs');
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

    console.log('[Migration v226] Running migration_v226_egg_sales_commissions_and_goals.sql...');
    const sql = fs.readFileSync(path.join(__dirname, 'migration_v226_egg_sales_commissions_and_goals.sql'), 'utf8');

    await connection.query(sql);
    console.log('[Migration v226] Migration completed successfully.');
    await connection.end();
}

run().catch(err => {
    console.error('[Migration v226] ERROR:', err);
    process.exit(1);
});
