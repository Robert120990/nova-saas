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
        const sql = fs.readFileSync(path.join(__dirname, 'migration_v132_pozo.sql'), 'utf8');
        console.log('Running migration v132: Control de Pozo tables...');
        await pool.query(sql);
        console.log('Migration v132 (tables) completed.');
    } catch (error) {
        console.error('Migration v132 (tables) failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
