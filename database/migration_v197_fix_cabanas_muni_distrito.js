const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    console.log('=== INICIANDO MIGRACIÓN V197: CORRECCIÓN DE ASOCIACIÓN MUNICIPIO-DISTRITO EN CABAÑAS (09) ===');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas'
    });

    try {
        // 1. Corregir descripciones en cat_013_municipio según Decreto Legislativo N° 761 y matriz MH:
        // Código 10 = CABAÑAS ESTE (Sensuntepeque, Guacotecti, San Isidro, Victoria, Dolores)
        // Código 11 = CABAÑAS OESTE (Ilobasco, Tejutepeque, Jutiapa, Cinquera)
        console.log('1. Actualizando cat_013_municipio para dep 09...');
        await pool.query("UPDATE cat_013_municipio SET description = 'CABAÑAS ESTE' WHERE dep_code = '09' AND code = '10'");
        await pool.query("UPDATE cat_013_municipio SET description = 'CABAÑAS OESTE' WHERE dep_code = '09' AND code = '11'");

        // 2. Corregir muni_code en cat_008_distrito para dep 09:
        // Distritos de Cabañas Este -> muni_code = '10':
        // '02' (Guacotecti), '05' (San Isidro), '06' (Sensuntepeque), '08' (Victoria), '09' (Dolores)
        console.log('2. Actualizando cat_008_distrito (muni_code) para dep 09...');
        const [resEste] = await pool.query(
            "UPDATE cat_008_distrito SET muni_code = '10' WHERE dep_code = '09' AND code IN ('02', '05', '06', '08', '09')"
        );
        console.log(`   - Cabañas Este (muni 10): ${resEste.affectedRows} distritos actualizados.`);

        // Distritos de Cabañas Oeste -> muni_code = '11':
        // '01' (Cinquera), '03' (Ilobasco), '04' (Jutiapa), '07' (Tejutepeque)
        const [resOeste] = await pool.query(
            "UPDATE cat_008_distrito SET muni_code = '11' WHERE dep_code = '09' AND code IN ('01', '03', '04', '07')"
        );
        console.log(`   - Cabañas Oeste (muni 11): ${resOeste.affectedRows} distritos actualizados.`);

        // 3. Sincronizar clientes existentes en tabla customers
        console.log('3. Sincronizando municipio de clientes con departamento 09...');
        const [resCust] = await pool.query(`
            UPDATE customers c
            JOIN cat_008_distrito d 
              ON d.dep_code = c.departamento 
             AND d.code = c.distrito
            SET c.municipio = d.muni_code
            WHERE c.departamento = '09' 
              AND c.distrito IS NOT NULL
        `);
        console.log(`   - Clientes de Cabañas actualizados: ${resCust.affectedRows}`);

        // 4. Sincronizar sucursales de clientes en tabla customer_branches
        console.log('4. Sincronizando customer_branches con departamento 09...');
        const [resBranches] = await pool.query(`
            UPDATE customer_branches b
            JOIN cat_008_distrito d 
              ON d.dep_code = b.departamento 
             AND d.code = b.distrito
            SET b.municipio = d.muni_code
            WHERE b.departamento = '09' 
              AND b.distrito IS NOT NULL
        `);
        console.log(`   - Sucursales de clientes actualizadas: ${resBranches.affectedRows}`);

        // 5. Verificación
        console.log('\n=== VERIFICACIÓN FINAL ===');
        const [catMunis] = await pool.query("SELECT code, description FROM cat_013_municipio WHERE dep_code = '09' ORDER BY code");
        console.log('cat_013_municipio (dep 09):', catMunis);

        const [catDists] = await pool.query("SELECT code, description, muni_code FROM cat_008_distrito WHERE dep_code = '09' ORDER BY code");
        console.log('cat_008_distrito (dep 09):', catDists);

        const [sampleCust] = await pool.query("SELECT id, nombre, departamento, municipio, distrito FROM customers WHERE id = 1468");
        console.log('Cliente 1468 (REPUESTOS Y LUBRICANTES EL MANGUITO):', sampleCust);

        console.log('\n✓ Migración v197 ejecutada con éxito.');
    } catch (err) {
        console.error('Error durante la migración v197:', err);
        throw err;
    } finally {
        await pool.end();
    }
}

module.exports = { run };

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
