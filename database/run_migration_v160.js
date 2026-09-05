const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
const fs = require('fs');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('--- Iniciando Migración v160: Calendario de Producción Inteligente, Roles y Pedidos ---');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const sqlPath = path.join(__dirname, 'migration_v160_egg_production_calendar.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Ejecutando sentencias SQL de v160...');
        await pool.query(sql);

        console.log('✅ Migración v160 ejecutada con éxito.');

        // Comprobar tablas creadas
        const [pTables] = await pool.query('SHOW TABLES LIKE "egg_scheduled_%"');
        console.log(`Tablas de calendario creadas: ${pTables.length}`);

        const [oTables] = await pool.query('SHOW TABLES LIKE "egg_customer_orders"');
        console.log(`Tabla de pedidos creada: ${oTables.length > 0 ? 'Sí' : 'No'}`);

        const [menuItem] = await pool.query('SELECT id, label, path FROM menu_items WHERE path = "/industrial/calendario"');
        console.log('Menu Item Calendario:', menuItem);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración v160:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
