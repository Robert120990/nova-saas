const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const TABLE_NAME = 'egg_product_code_mappings';

const columnExists = async (pool, columnName) => {
    const [rows] = await pool.query(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [TABLE_NAME, columnName]
    );
    return rows.length > 0;
};

const indexExists = async (pool, indexName) => {
    const [rows] = await pool.query(
        `SELECT 1
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1`,
        [TABLE_NAME, indexName]
    );
    return rows.length > 0;
};

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas'
    });

    try {
        console.log('--- Migración v201: Catálogos de mapeo para Huevo Industrial ---');

        const [tables] = await pool.query(
            `SELECT 1
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
             LIMIT 1`,
            [TABLE_NAME]
        );

        if (tables.length === 0) {
            throw new Error(`No existe la tabla ${TABLE_NAME}. Ejecute primero la migración v199.`);
        }

        if (!(await columnExists(pool, 'catalog_product_id'))) {
            await pool.query(
                `ALTER TABLE ${TABLE_NAME}
                 ADD COLUMN catalog_product_id INT NULL AFTER company_id`
            );
            console.log('  ✓ Columna catalog_product_id agregada.');
        } else {
            console.log('  → catalog_product_id ya existe.');
        }

        if (!(await columnExists(pool, 'catalog_product_name'))) {
            await pool.query(
                `ALTER TABLE ${TABLE_NAME}
                 ADD COLUMN catalog_product_name VARCHAR(255) NULL AFTER catalog_product_id`
            );
            console.log('  ✓ Columna catalog_product_name agregada.');
        } else {
            console.log('  → catalog_product_name ya existe.');
        }

        if (!(await columnExists(pool, 'unit_of_measure'))) {
            await pool.query(
                `ALTER TABLE ${TABLE_NAME}
                 ADD COLUMN unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'lb' AFTER unit_weight_kg`
            );
            console.log('  ✓ Columna unit_of_measure agregada.');
        } else {
            console.log('  → unit_of_measure ya existe.');
        }

        await pool.query(
            `UPDATE ${TABLE_NAME}
             SET unit_of_measure = 'lb'
             WHERE unit_of_measure IS NULL
                OR TRIM(unit_of_measure) = ''`
        );

        if (!(await indexExists(pool, 'idx_epcm_catalog_product'))) {
            await pool.query(
                `ALTER TABLE ${TABLE_NAME}
                 ADD INDEX idx_epcm_catalog_product (company_id, catalog_product_id)`
            );
            console.log('  ✓ Índice de producto de catálogo agregado.');
        } else {
            console.log('  → idx_epcm_catalog_product ya existe.');
        }

        console.log('--- Migración v201 completada correctamente. ---');
    } catch (error) {
        console.error('Migración v201 falló:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(error => {
        console.error(error);
        process.exit(1);
    });
}
