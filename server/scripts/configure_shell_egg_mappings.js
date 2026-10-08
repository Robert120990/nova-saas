const pool = require('../src/config/db');

async function run() {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Update row 13 for Unidad (HCU)
        await conn.query(`
            UPDATE egg_product_code_mappings
            SET catalog_product_id = 9751,
                catalog_product_name = 'Huevo en Cáscara (Unidad)',
                industrial_product_type = 'huevo en cascara',
                presentation = 'unidad',
                catalog_codes = 'HCU',
                code_weights_json = ?,
                unit_weight_lbs = 0.13,
                unit_weight_kg = 0.06,
                unit_of_measure = 'unidad',
                notes = 'Manejo y venta por unidad individual',
                updated_at = NOW()
            WHERE id = 13 AND company_id = 9
        `, [
            JSON.stringify([{ code: 'HCU', weight_lbs: 0.13, weight_kg: 0.06, product_id: 9751, product_name: 'HUEVO EN CASCARA UNIDAD UNID.' }])
        ]);

        // 2. Insert Cartón (HC, CARTONH)
        const [existingCarton] = await conn.query(`
            SELECT id FROM egg_product_code_mappings 
            WHERE company_id = 9 AND catalog_codes LIKE '%HC%' AND id != 13
        `);
        if (existingCarton.length === 0) {
            await conn.query(`
                INSERT INTO egg_product_code_mappings (
                    company_id, catalog_product_id, catalog_product_name, industrial_product_type,
                    presentation, catalog_codes, code_weights_json, unit_weight_lbs, unit_weight_kg,
                    unit_of_measure, notes, created_at, updated_at
                ) VALUES (
                    9, 9749, 'Huevo en Cáscara (Cartón 30U)', 'huevo en cascara',
                    'carton 30U', 'HC, CARTONH', ?, 3.90, 1.77,
                    'carton', 'Cartón comercial de 30 unidades', NOW(), NOW()
                )
            `, [
                JSON.stringify([
                    { code: 'HC', weight_lbs: 3.90, weight_kg: 1.77, product_id: 9749, product_name: 'HUEVO EN CASCARA CARTON' },
                    { code: 'CARTONH', weight_lbs: 3.90, weight_kg: 1.77, product_id: 9729, product_name: 'CARTON DE HUEVO' }
                ])
            ]);
        }

        // 3. Insert Caja (H1)
        const [existingCaja] = await conn.query(`
            SELECT id FROM egg_product_code_mappings 
            WHERE company_id = 9 AND catalog_codes LIKE '%H1%' AND id != 13
        `);
        if (existingCaja.length === 0) {
            await conn.query(`
                INSERT INTO egg_product_code_mappings (
                    company_id, catalog_product_id, catalog_product_name, industrial_product_type,
                    presentation, catalog_codes, code_weights_json, unit_weight_lbs, unit_weight_kg,
                    unit_of_measure, notes, created_at, updated_at
                ) VALUES (
                    9, 9702, 'Huevo en Cáscara (Caja 360U)', 'huevo en cascara',
                    'caja 360U', 'H1', ?, 45.00, 20.41,
                    'caja', 'Caja comercial de 12 cartones / 360 unidades', NOW(), NOW()
                )
            `, [
                JSON.stringify([
                    { code: 'H1', weight_lbs: 45.00, weight_kg: 20.41, product_id: 9702, product_name: 'CAJAS DE HUEVO BLANCO' }
                ])
            ]);
        }

        await conn.commit();
        console.log('SUCCESS: Shell egg mappings configured cleanly.');
    } catch (err) {
        await conn.rollback();
        console.error('ERROR:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

run();
