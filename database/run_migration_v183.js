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
        console.log('Running migration v183 - Add branch_id to rh_empleados...');

        // Check if column already exists
        const [[exists]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rh_empleados' AND COLUMN_NAME = 'branch_id'`,
            [process.env.DB_NAME]
        );

        if (exists && exists.n > 0) {
            console.log('  → Column branch_id already exists in rh_empleados.');
        } else {
            const migrationPath = path.join(__dirname, 'migration_v183_rh_empleados_branch_id.sql');
            const sql = fs.readFileSync(migrationPath, 'utf8');
            await pool.query(sql);
            console.log('  → Column branch_id and foreign key added successfully.');
        }

        console.log('OK: migration v183 completed successfully.');
    } catch (err) {
        console.error('Error in migration v183:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
