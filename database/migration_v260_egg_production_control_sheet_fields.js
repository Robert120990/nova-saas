/**
 * migration_v260_egg_production_control_sheet_fields.js
 * Agrega campos oficiales de la Hoja de Control Diario de Producción (PRO:006):
 * - Quebraje: Inicio y Fin de Quebraje, Condiciones del Huevo
 * - Pasteurización: Inicio/Fin, T° Agua (inicio/fin), T° Huevo (inicio/fin),
 *   V.B. Tiempo (inicio/fin), V.B. Booster (inicio/fin), Flujo (inicio/fin)
 * - Empaque / Envasado: Inicio y Fin de Empaque
 */

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_sistema_saas',
    port: process.env.DB_PORT || 3306
};

async function columnExists(connection, table, column) {
    const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.columns 
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
    );
    return rows[0].count > 0;
}

async function runMigration() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('--- Iniciando Migración v260: Campos de Control Diario PRO:006 ---');

        // 1. Campos en egg_production_batches (Quebraje y Empaque)
        const batchFields = [
            { name: 'quebraje_inicio', type: 'time NULL' },
            { name: 'quebraje_fin', type: 'time NULL' },
            { name: 'egg_condition', type: 'varchar(100) NULL DEFAULT "Buenas"' },
            { name: 'empaque_inicio', type: 'time NULL' },
            { name: 'empaque_fin', type: 'time NULL' }
        ];

        for (const f of batchFields) {
            if (!(await columnExists(connection, 'egg_production_batches', f.name))) {
                await connection.query(`ALTER TABLE egg_production_batches ADD COLUMN ${f.name} ${f.type}`);
                console.log(`[egg_production_batches] Columna agregada: ${f.name}`);
            }
        }

        // 2. Campos en egg_pasteurization_logs (Parámetros PRO:006)
        const pastFields = [
            { name: 'start_time', type: 'time NULL' },
            { name: 'end_time', type: 'time NULL' },
            { name: 'temp_agua_inicio', type: 'decimal(6,2) NULL' },
            { name: 'temp_agua_fin', type: 'decimal(6,2) NULL' },
            { name: 'temp_huevo_inicio', type: 'decimal(6,2) NULL' },
            { name: 'temp_huevo_fin', type: 'decimal(6,2) NULL' },
            { name: 'vb_tiempo_inicio', type: 'decimal(6,2) NULL' },
            { name: 'vb_tiempo_fin', type: 'decimal(6,2) NULL' },
            { name: 'vb_booster_inicio', type: 'decimal(6,2) NULL' },
            { name: 'vb_booster_fin', type: 'decimal(6,2) NULL' },
            { name: 'flujo_inicio', type: 'decimal(6,2) NULL' },
            { name: 'flujo_fin', type: 'decimal(6,2) NULL' },
            { name: 'empaque_inicio', type: 'time NULL' },
            { name: 'empaque_fin', type: 'time NULL' },
            { name: 'cycle_number', type: 'int NULL DEFAULT 1' }
        ];

        for (const f of pastFields) {
            if (!(await columnExists(connection, 'egg_pasteurization_logs', f.name))) {
                await connection.query(`ALTER TABLE egg_pasteurization_logs ADD COLUMN ${f.name} ${f.type}`);
                console.log(`[egg_pasteurization_logs] Columna agregada: ${f.name}`);
            }
        }

        // 3. Campos en egg_packaging_records
        const pkgFields = [
            { name: 'packaging_start_time', type: 'time NULL' },
            { name: 'packaging_end_time', type: 'time NULL' }
        ];

        for (const f of pkgFields) {
            if (!(await columnExists(connection, 'egg_packaging_records', f.name))) {
                await connection.query(`ALTER TABLE egg_packaging_records ADD COLUMN ${f.name} ${f.type}`);
                console.log(`[egg_packaging_records] Columna agregada: ${f.name}`);
            }
        }

        console.log(' Migración v260 ejecutada con éxito.');
    } catch (error) {
        console.error('Error durante la migración v260:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
