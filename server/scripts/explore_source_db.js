const mysql = require('mysql2/promise');

async function main() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: 'db_sipe_chalchuapa'
    });

    try {
        const [tables] = await conn.query('SHOW TABLES');
        console.log('Tables in db_sipe_chalchuapa:');
        tables.forEach(t => console.log(Object.values(t)[0]));

        const relevantTables = ['productos', 'clientes', 'proveedores', 'product', 'customer', 'provider', 'items', 'suppliers'];
        for (const table of tables) {
            const tableName = Object.values(table)[0];
            if (relevantTables.some(r => tableName.toLowerCase().includes(r))) {
                const [columns] = await conn.query(`DESCRIBE ${tableName}`);
                console.log(`\nStructure of ${tableName}:`);
                columns.forEach(c => console.log(`${c.Field} (${c.Type})` ));
            }
        }

    } catch (err) {
        console.error('Error connecting to db_sipe_chalchuapa:', err);
    } finally {
        await conn.end();
    }
}

main();
