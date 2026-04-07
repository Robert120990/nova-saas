const pool = require('./config/db');

async function check() {
    try {
        const [rows] = await pool.query('SELECT id, username, nombre, email FROM users');
        console.log('USERS IN DB:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
