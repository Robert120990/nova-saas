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
        const migrationPath = path.join(__dirname, 'migration_v20_customer_branches.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v20: Create customer_branches table...');
        await pool.query(sql);
        console.log('Migration v20 completed successfully.');
        const [r] = await pool.query('DESCRIBE customer_branches');
        console.table(r);
    } catch (error) {
        console.error('Migration v20 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
