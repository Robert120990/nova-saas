const mysql = require('../server/node_modules/mysql2/promise');
const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function rollback() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    console.log('[Rollback v226] Reverting migration v226...');

    // 1. Drop tables
    await connection.query('DROP TABLE IF EXISTS egg_seller_commissions;');
    console.log('- Dropped table egg_seller_commissions');

    await connection.query('DROP TABLE IF EXISTS egg_seller_goals;');
    console.log('- Dropped table egg_seller_goals');

    // 2. Drop column seller_id from egg_customer_orders
    try {
        await connection.query('ALTER TABLE egg_customer_orders DROP FOREIGN KEY fk_egg_orders_seller;');
    } catch (e) { /* ignore if no fk */ }
    try {
        await connection.query('ALTER TABLE egg_customer_orders DROP COLUMN seller_id;');
        console.log('- Dropped column seller_id from egg_customer_orders');
    } catch (e) { /* ignore if not exists */ }

    // 3. Drop columns employee_id and is_egg_seller from sellers
    try {
        await connection.query('ALTER TABLE sellers DROP FOREIGN KEY fk_sellers_employee;');
    } catch (e) { /* ignore if no fk */ }
    try {
        await connection.query('ALTER TABLE sellers DROP COLUMN employee_id;');
        console.log('- Dropped column employee_id from sellers');
    } catch (e) { /* ignore if not exists */ }
    try {
        await connection.query('ALTER TABLE sellers DROP COLUMN is_egg_seller;');
        console.log('- Dropped column is_egg_seller from sellers');
    } catch (e) { /* ignore if not exists */ }

    console.log('[Rollback v216] Rollback completed successfully.');
    await connection.end();
}

rollback().catch(err => {
    console.error('[Rollback v216] ERROR:', err);
    process.exit(1);
});
