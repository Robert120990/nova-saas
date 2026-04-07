const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Uses .env in dte-api

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationFile = process.argv[2];
        if (!migrationFile) {
            console.error('Please provide a migration file name.');
            process.exit(1);
        }
        const migrationPath = path.resolve(__dirname, '../../database', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log(`Running migration ${migrationFile} from ${migrationPath}...`);
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
