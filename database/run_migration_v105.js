const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    try {
        console.log('Running migration v105: rh_descuentos_programados cuenta_id link...');

        // 1. Check if column cuenta_id exists
        const [cols] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'rh_descuentos_programados' 
              AND COLUMN_NAME = 'cuenta_id'
        `);

        if (cols.length === 0) {
            console.log('Adding column cuenta_id to rh_descuentos_programados...');
            await pool.query(`
                ALTER TABLE rh_descuentos_programados 
                ADD COLUMN cuenta_id INT NULL AFTER company_id
            `);
            console.log('Column cuenta_id added.');
        } else {
            console.log('Column cuenta_id already exists.');
        }

        // 2. Check and add foreign key
        const [fks] = await pool.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'rh_descuentos_programados' 
              AND CONSTRAINT_NAME = 'fk_rh_descuentos_cuenta'
        `);

        if (fks.length === 0) {
            try {
                await pool.query(`
                    ALTER TABLE rh_descuentos_programados 
                    ADD CONSTRAINT fk_rh_descuentos_cuenta 
                    FOREIGN KEY (cuenta_id) REFERENCES rh_cuentas_planillas(id) ON DELETE SET NULL
                `);
                console.log('Foreign key fk_rh_descuentos_cuenta created.');
            } catch (fkErr) {
                console.warn('FK creation warning:', fkErr.message);
            }
        }

        // 3. Link existing 'Pago de Prestamo' to account '09' (PRESTAMOS)
        await pool.query(`
            UPDATE rh_descuentos_programados dp
            JOIN rh_cuentas_planillas cp ON cp.company_id = dp.company_id AND cp.codigo = '09'
            SET dp.cuenta_id = cp.id
            WHERE dp.cuenta_id IS NULL AND (dp.codigo = '01' OR LOWER(dp.descripcion) LIKE '%prestamo%')
        `);

        // 4. Seed standard discounts for each company if they don't exist
        const [companies] = await pool.query('SELECT id FROM companies');
        for (const comp of companies) {
            const cid = comp.id;

            // Procuraduría (Account 10)
            const [c10] = await pool.query("SELECT id FROM rh_cuentas_planillas WHERE company_id = ? AND codigo = '10'", [cid]);
            if (c10.length > 0) {
                const [d2] = await pool.query("SELECT id FROM rh_descuentos_programados WHERE company_id = ? AND (codigo = '02' OR LOWER(descripcion) LIKE '%procuraduria%')", [cid]);
                if (d2.length === 0) {
                    await pool.query(
                        "INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id) VALUES (?, '02', 'Descuento de Procuraduría', ?)",
                        [cid, c10[0].id]
                    );
                } else if (!d2[0].cuenta_id) {
                    await pool.query("UPDATE rh_descuentos_programados SET cuenta_id = ? WHERE id = ?", [c10[0].id, d2[0].id]);
                }
            }

            // FSV (Account 12)
            const [c12] = await pool.query("SELECT id FROM rh_cuentas_planillas WHERE company_id = ? AND codigo = '12'", [cid]);
            if (c12.length > 0) {
                const [d3] = await pool.query("SELECT id FROM rh_descuentos_programados WHERE company_id = ? AND (codigo = '03' OR LOWER(descripcion) LIKE '%fondo social%' OR LOWER(descripcion) LIKE '%fsv%')", [cid]);
                if (d3.length === 0) {
                    await pool.query(
                        "INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id) VALUES (?, '03', 'Fondo Social para la Vivienda', ?)",
                        [cid, c12[0].id]
                    );
                } else if (!d3[0].cuenta_id) {
                    await pool.query("UPDATE rh_descuentos_programados SET cuenta_id = ? WHERE id = ?", [c12[0].id, d3[0].id]);
                }
            }

            // Anticipos (Account 06)
            const [c06] = await pool.query("SELECT id FROM rh_cuentas_planillas WHERE company_id = ? AND codigo = '06'", [cid]);
            if (c06.length > 0) {
                const [d4] = await pool.query("SELECT id FROM rh_descuentos_programados WHERE company_id = ? AND (codigo = '04' OR LOWER(descripcion) LIKE '%anticipo%')", [cid]);
                if (d4.length === 0) {
                    await pool.query(
                        "INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id) VALUES (?, '04', 'Anticipos de Sueldo', ?)",
                        [cid, c06[0].id]
                    );
                } else if (!d4[0].cuenta_id) {
                    await pool.query("UPDATE rh_descuentos_programados SET cuenta_id = ? WHERE id = ?", [c06[0].id, d4[0].id]);
                }
            }
        }

        const [results] = await pool.query(`
            SELECT dp.id, dp.company_id, dp.codigo, dp.descripcion, dp.cuenta_id, cp.codigo as cuenta_codigo, cp.descripcion as cuenta_descripcion
            FROM rh_descuentos_programados dp
            LEFT JOIN rh_cuentas_planillas cp ON dp.cuenta_id = cp.id
            ORDER BY dp.company_id, dp.codigo
        `);
        console.log('Migration v105 completed successfully!');
        console.table(results);

    } catch (error) {
        console.error('Migration v105 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
