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
        const migrationPath = path.join(__dirname, 'migration_v150_entry_types_cxc_cxp.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v150 aplicada: entry_types CXC/CXP y menu verificados');

        const [[cxc]] = await pool.query(`SELECT id FROM entry_types WHERE code = 'CXC'`);
        const [[cxp]] = await pool.query(`SELECT id FROM entry_types WHERE code = 'CXP'`);
        if (!cxc || !cxp) throw new Error('Los tipos de partida CXC/CXP no existen tras la migracion');
        console.log('OK: migracion v150 completa');
    } catch (err) {
        console.error('Error en migracion v150:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
