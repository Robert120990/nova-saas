const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('Using DB_HOST:', process.env.DB_HOST);
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v152_trupput.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v152 aplicada: modulo Trupput (tablas y flag de cliente)');

        const [[t1]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'gas_station_trupput'`,
            [process.env.DB_NAME]
        );
        const [[t2]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'gas_station_closeout_trupput_despachos'`,
            [process.env.DB_NAME]
        );
        if (!t1 || t1.n === 0) throw new Error('La tabla gas_station_trupput no existe tras la migracion');
        if (!t2 || t2.n === 0) throw new Error('La tabla gas_station_closeout_trupput_despachos no existe tras la migracion');
        console.log('OK: migracion v152 completa');
    } catch (err) {
        console.error('Error en migracion v152:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
