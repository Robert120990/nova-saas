const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
    console.log('Testing connection to:', process.env.DB_HOST);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('Connection successful!');
        await connection.end();
    } catch (error) {
        console.error('Connection failed:');
        console.error(error);
    }
}

test();
