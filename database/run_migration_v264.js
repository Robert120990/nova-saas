const { migrate } = require('./migration_v264_add_rrs_num_cheque_to_purchase_quedans');
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
        console.log('Migration v264 executed successfully');
        pool.end();
    })
    .catch((err) => {
        console.error('Migration v264 failed:', err);
        pool.end();
        process.exit(1);
    });
