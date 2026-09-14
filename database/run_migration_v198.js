const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('Using DB_HOST:', process.env.DB_HOST);
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Running migration v198: Agregar columna aplica_renta a rh_empleados...');

        // Verificar si la columna ya existe
        const [cols] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rh_empleados' AND COLUMN_NAME = 'aplica_renta'`,
            [process.env.DB_NAME]
        );

        if (cols.length > 0) {
            console.log('Columna aplica_renta ya existe. Sin cambios.');
        } else {
            await pool.query(
                `ALTER TABLE rh_empleados
                 ADD COLUMN aplica_renta TINYINT NOT NULL DEFAULT 1
                 COMMENT 'Si 1, se aplica descuento de renta en 2da quincena. Si 0, no se aplica renta.'
                 AFTER es_jubilado`
            );
            console.log('Columna aplica_renta agregada exitosamente.');
        }

        console.log('Migration v198 completada.');
    } catch (error) {
        console.error('Migration v198 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
