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
        const [[fk]] = await pool.query(
            `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'entry_types' AND REFERENCED_TABLE_NAME = 'companies'
             LIMIT 1`,
            [process.env.DB_NAME]
        );
        if (fk) {
            await pool.query(`ALTER TABLE entry_types DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
            console.log('FK eliminada:', fk.CONSTRAINT_NAME);
        } else {
            console.log('No se encontró FK de entry_types -> companies');
        }

        const migrationPath = path.join(__dirname, 'migration_v142_entry_types_global.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();