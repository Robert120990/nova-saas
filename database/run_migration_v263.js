const { migrate } = require('./migration_v263_transfer_pos_to_tarjetas');
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
        console.log('Migration v263 executed successfully');
        pool.end();
    })
    .catch((err) => {
        console.error('Migration v263 failed:', err);
        pool.end();
        process.exit(1);
    });
