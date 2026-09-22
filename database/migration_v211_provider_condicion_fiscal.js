const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    console.log('Connecting to database...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Checking if providers.condicion_fiscal column exists...');
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'providers' AND COLUMN_NAME = 'condicion_fiscal'
        `, [process.env.DB_NAME]);

        if (columns.length === 0) {
            console.log('Adding condicion_fiscal to providers table...');
            await pool.query(`
                ALTER TABLE providers 
                ADD COLUMN condicion_fiscal VARCHAR(50) DEFAULT 'otro' AFTER codigo_actividad
            `);
            console.log('Column condicion_fiscal added successfully.');
        } else {
            console.log('Column condicion_fiscal already exists.');
        }

        console.log('Backfilling providers.condicion_fiscal based on existing data...');
        // Gran Contribuyente
        await pool.query(`
            UPDATE providers 
            SET condicion_fiscal = 'gran contribuyente' 
            WHERE es_gran_contribuyente = 1 OR tipo_contribuyente = 'Gran Contribuyente'
        `);

        // Exento IVA
        await pool.query(`
            UPDATE providers 
            SET condicion_fiscal = 'exento IVA' 
            WHERE (condicion_fiscal IS NULL OR condicion_fiscal = 'otro')
              AND exento_iva = 1
        `);

        // Extranjero
        await pool.query(`
            UPDATE providers 
            SET condicion_fiscal = 'extranjero' 
            WHERE (condicion_fiscal IS NULL OR condicion_fiscal = 'otro')
              AND (tipo_contribuyente = 'No Domiciliado' OR (pais != '9579' AND pais IS NOT NULL AND pais != ''))
        `);

        // Contribuyente (con NRC)
        await pool.query(`
            UPDATE providers 
            SET condicion_fiscal = 'contribuyente' 
            WHERE (condicion_fiscal IS NULL OR condicion_fiscal = 'otro')
              AND nrc IS NOT NULL AND TRIM(nrc) != '' AND nrc != '0'
        `);

        // Resto como 'otro'
        await pool.query(`
            UPDATE providers 
            SET condicion_fiscal = 'otro' 
            WHERE condicion_fiscal IS NULL OR condicion_fiscal = ''
        `);

        console.log('Migration v211 finished successfully!');
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
