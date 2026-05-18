const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
const fs = require('fs');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v19_cat014_complete.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v19: Complete CAT-014 catalog...');
        await pool.query(sql);
        console.log('Migration v19 completed successfully.');

        const [r] = await pool.query('SELECT * FROM cat_014_unidad_medida ORDER BY CAST(code AS UNSIGNED)');
        console.log(`\n=== cat_014_unidad_medida (${r.length} registros) ===`);
        console.table(r);
    } catch (error) {
        console.error('Migration v19 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
