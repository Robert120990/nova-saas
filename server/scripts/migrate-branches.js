require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'sysadmin',
        password: process.env.DB_PASSWORD || 'QwErTy123',
        database: 'db_sistema_saas'
    });

    try {
        console.log('Migrando tabla branches...');

        const columns = [
            { name: 'tipo_establecimiento', type: 'VARCHAR(10) DEFAULT "01"' },
            { name: 'telefono', type: 'VARCHAR(20)' },
            { name: 'correo', type: 'VARCHAR(100)' }
        ];

        for (const col of columns) {
            try {
                await connection.query(`ALTER TABLE branches ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Columna ${col.name} agregada.`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Columna ${col.name} ya existe.`);
                } else {
                    console.error(`Error en ${col.name}:`, err.message);
                }
            }
        }

        console.log('Migración completada.');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
