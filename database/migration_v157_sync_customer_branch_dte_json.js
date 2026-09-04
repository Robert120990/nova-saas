const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v157: Sincronizar sucursales de cliente a DTEs existentes ---');

    const [sales] = await pool.query(`
        SELECT h.id as sale_id, h.codigo_generacion, h.customer_id, h.customer_branch_id,
               c.nombre as customer_name, c.departamento as cust_depto, c.municipio as cust_muni, c.distrito as cust_dist, c.direccion as cust_dir,
               cb.nombre as branch_name, cb.departamento as branch_depto, cb.municipio as branch_muni, cb.distrito as branch_dist, cb.direccion as branch_dir,
               d.id as dte_id, d.json_original
        FROM sales_headers h
        JOIN customers c ON h.customer_id = c.id
        JOIN customer_branches cb ON h.customer_branch_id = cb.id
        JOIN dtes d ON h.codigo_generacion = d.codigo_generacion
        WHERE h.customer_branch_id IS NOT NULL
    `);

    console.log(`Ventas encontradas con sucursal y DTE: ${sales.length}`);
    let updated = 0;

    for (const s of sales) {
        if (!s.json_original) continue;

        let json = s.json_original;
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
            } catch (err) {
                console.warn(`Error parseando JSON para venta ${s.sale_id}:`, err.message);
                continue;
            }
        }

        if (!json.receptor) {
            json.receptor = {};
        }

        const depto = (s.branch_depto && String(s.branch_depto).trim()) || s.cust_depto || '06';
        const muni = (s.branch_muni && String(s.branch_muni).trim()) || s.cust_muni || '01';
        const dist = (s.branch_dist && String(s.branch_dist).trim()) || s.cust_dist || '01';
        const complemento = (s.branch_dir && String(s.branch_dir).trim()) || s.cust_dir || 'Direccion no definida';

        json.receptor.direccion = {
            departamento: String(depto).replace(/\D/g, '').slice(-2).padStart(2, '0'),
            municipio: String(muni).replace(/\D/g, '').slice(-2).padStart(2, '0'),
            distrito: String(dist).replace(/\D/g, '').slice(-2).padStart(2, '0'),
            complemento: complemento.substring(0, 200).padEnd(5, '.')
        };

        const updatedJsonStr = JSON.stringify(json);

        await pool.query(
            'UPDATE dtes SET json_original = ? WHERE codigo_generacion = ?',
            [updatedJsonStr, s.codigo_generacion]
        );

        updated++;
        console.log(`✓ Venta ${s.sale_id} (${s.codigo_generacion}): Actualizado receptor a Sucursal "${s.branch_name}" -> ${json.receptor.direccion.complemento.substring(0, 60)}...`);
    }

    console.log(`\nMigración v157 completada. Total DTEs actualizados: ${updated}`);
}

module.exports = { migrate };

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error en migración v157:', err);
            process.exit(1);
        });
}
