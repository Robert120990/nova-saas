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
        const migrationPath = path.join(__dirname, 'migration_v18_column_sizes.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration v18: Change pais, departamento, municipio to varchar(10)...');
        await pool.query(sql);
        console.log('Migration v18 completed successfully.');

        const [r] = await pool.query("DESCRIBE customers");
        console.log('\n=== customers (pais, departamento, municipio) ===');
        console.table(r.filter(c => ['pais', 'departamento', 'municipio'].includes(c.Field)));
    } catch (error) {
        console.error('Migration v18 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
