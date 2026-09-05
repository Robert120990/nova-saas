const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
const fs = require('fs');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('--- Iniciando Migración v159: Mejoras Integrales Huevo Industrial (Literales A - F) ---');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const sqlPath = path.join(__dirname, 'migration_v159_egg_industrial_enhancements.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Ejecutando sentencias SQL de v159...');
        await pool.query(sql);

        console.log('✅ Migración v159 ejecutada con éxito.');
        
        // Comprobar tablas creadas
        const [tables] = await pool.query('SHOW TABLES LIKE "egg_costing_%"');
        console.log(`Tablas de costeo creadas: ${tables.length}`);
        
        const [agreements] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_customer_agreements');
        console.log(`Acuerdos de clientes sembrados: ${agreements[0].c}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración v159:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
