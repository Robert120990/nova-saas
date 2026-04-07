require('dotenv').config();
const mysql = require('mysql2/promise');

const allPermissions = [
    'view_dashboard', 'manage_companies', 'manage_branches', 'manage_pos', 
    'manage_customers', 'manage_products', 'manage_security', 'manage_users', 'manage_roles'
];

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Seeding default admin permissions...');
        await connection.query(
            'UPDATE roles SET permissions = ? WHERE name = ?',
            [JSON.stringify(allPermissions), 'SuperAdmin']
        );
        await connection.query(
            'UPDATE roles SET permissions = ? WHERE name = ?',
            [JSON.stringify(allPermissions), 'Admin']
        );
        console.log('Seeding completado.');
    } catch (error) {
        console.error('Error en seeding:', error);
    } finally {
        await connection.end();
    }
}
seed();
