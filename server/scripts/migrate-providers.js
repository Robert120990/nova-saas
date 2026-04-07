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
        console.log('Agregando columnas faltantes a providers...');

        const columns = [
            { name: 'tipo_documento', type: 'VARCHAR(20)', after: 'company_id' },
            { name: 'numero_documento', type: 'VARCHAR(20)', after: 'tipo_documento' },
            { name: 'id_actividad', type: 'INT', after: 'nombre_comercial' },
            { name: 'departamento', type: 'VARCHAR(50)', after: 'direccion' },
            { name: 'municipio', type: 'VARCHAR(50)', after: 'departamento' }
        ];

        for (const col of columns) {
            try {
                await connection.query(`ALTER TABLE providers ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}`);
                console.log(`Columna ${col.name} agregada.`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Columna ${col.name} ya existe.`);
                } else {
                    console.error(`Error en ${col.name}:`, err.message);
                }
            }
        }

        console.log('Columnas agregadas correctamente.');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
