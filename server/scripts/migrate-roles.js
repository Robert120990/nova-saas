require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Migrando tabla de roles...');
        await connection.query(`
            ALTER TABLE roles ADD COLUMN company_id INT AFTER id;
            UPDATE roles SET company_id = 1;
            ALTER TABLE roles MODIFY company_id INT NOT NULL;
            ALTER TABLE roles ADD CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
            ALTER TABLE roles DROP INDEX name;
            ALTER TABLE roles ADD UNIQUE KEY (company_id, name);
        `);
        console.log('Migración completada.');
    } catch (error) {
        console.error('Error en migración:', error);
    } finally {
        await connection.end();
    }
}
migrate();
