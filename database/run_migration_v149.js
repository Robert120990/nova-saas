const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function columnExists(pool, table, column) {
    const [[row]] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_NAME, table, column]
    );
    return row.n > 0;
}

async function fkExists(pool, table, constraint) {
    const [[row]] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
        [process.env.DB_NAME, table, constraint]
    );
    return row.n > 0;
}

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
        const migrationPath = path.join(__dirname, 'migration_v149_accounting_generation.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v149 aplicada: entry_types VENTAS/COMPRAS verificados');

        for (const table of ['customers', 'providers']) {
            if (!(await columnExists(pool, table, 'account_id'))) {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN account_id INT NULL DEFAULT NULL`);
                console.log(`Columna ${table}.account_id agregada`);
            } else {
                console.log(`Columna ${table}.account_id ya existe`);
            }
            const fkName = `fk_${table}_aux_account`;
            if (!(await fkExists(pool, table, fkName))) {
                await pool.query(
                    `ALTER TABLE ${table} ADD CONSTRAINT ${fkName} FOREIGN KEY (account_id)
                     REFERENCES chart_of_accounts(id) ON DELETE SET NULL`
                );
                console.log(`FK ${fkName} agregada`);
            }
        }
        console.log('OK: migracion v149 completa');
    } catch (err) {
        console.error('Error en migracion v149:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
