const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: 'db_sistema_saas'
    });
    try {
        console.log('Altering inventory_movements...');
        await connection.query('ALTER TABLE inventory_movements MODIFY COLUMN documento_id BIGINT');
        console.log('Successfully altered inventory_movements.');
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}
run();
