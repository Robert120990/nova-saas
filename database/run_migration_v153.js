const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v153_formas_pago_y_credito.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v153 aplicada: Cat-017 oficial, cat_018_plazo, migracion sales_payments y dias_credito');

        const [[c017]] = await pool.query('SELECT COUNT(*) AS n FROM cat_017_forma_pago');
        if (!c017 || c017.n !== 12) throw new Error(`cat_017_forma_pago debe tener 12 registros, tiene ${c017 && c017.n}`);
        const [[c018]] = await pool.query('SELECT COUNT(*) AS n FROM cat_018_plazo');
        if (!c018 || c018.n !== 3) throw new Error(`cat_018_plazo debe tener 3 registros, tiene ${c018 && c018.n}`);
        const [[col]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'dias_credito'`,
            [process.env.DB_NAME]
        );
        if (!col || col.n === 0) throw new Error('Columna customers.dias_credito no existe tras la migracion');
        const [[p]] = await pool.query("SELECT COUNT(*) AS n FROM sales_payments WHERE metodo_pago IN ('10','20','30')");
        console.log('OK: migracion v153 completa. Viejos codigos restantes en sales_payments:', p.n);
    } catch (err) {
        console.error('Error en migracion v153:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
