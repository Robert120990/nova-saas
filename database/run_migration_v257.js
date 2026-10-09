const { migrate } = require('./migration_v257_gas_closeout_cheques');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

migrate(pool)
    .then(() => {
        console.log('Migration v257 executed successfully');
        pool.end();
    })
    .catch((err) => {
        console.error('Migration v257 failed:', err);
        pool.end();
        process.exit(1);
    });
