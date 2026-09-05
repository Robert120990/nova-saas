const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v158: Estandarizar códigos CAT-019 y clientes a 5 dígitos ---');

    // 1. Corregir los 79 códigos de cat_019_actividad_economica que perdieron el cero inicial (ej. 1612 -> 01612)
    const [catRows] = await pool.query('SELECT code, description FROM cat_019_actividad_economica WHERE LENGTH(code) = 4');
    console.log(`Códigos de 4 dígitos en cat_019_actividad_economica: ${catRows.length}`);

    if (catRows.length > 0) {
        const [updateCat] = await pool.query(`
            UPDATE cat_019_actividad_economica 
            SET code = LPAD(code, 5, '0') 
            WHERE LENGTH(code) = 4 AND code REGEXP '^[0-9]+$'
        `);
        console.log(`Códigos actualizados en cat_019_actividad_economica: ${updateCat.affectedRows}`);
    }

    // 2. Actualizar clientes que tenían códigos de 4 dígitos que corresponden al catálogo oficial
    const [updateCust1612] = await pool.query(`
        UPDATE customers 
        SET codigo_actividad = '01612' 
        WHERE codigo_actividad = '1612'
    `);
    console.log(`Clientes con actividad 1612 actualizados a 01612: ${updateCust1612.affectedRows}`);

    // Actualizar cualquier otro cliente con código de 4 dígitos que al agregar '0' exista en cat_019
    const [updateOtherCust] = await pool.query(`
        UPDATE customers c
        JOIN cat_019_actividad_economica a ON LPAD(c.codigo_actividad, 5, '0') = a.code
        SET c.codigo_actividad = a.code
        WHERE LENGTH(c.codigo_actividad) = 4 AND c.codigo_actividad REGEXP '^[0-9]+$'
    `);
    console.log(`Otros clientes con 4 dígitos actualizados: ${updateOtherCust.affectedRows}`);

    // 3. Actualizar proveedores si aplica
    const [updateProv] = await pool.query(`
        UPDATE providers p
        JOIN cat_019_actividad_economica a ON LPAD(p.codigo_actividad, 5, '0') = a.code
        SET p.codigo_actividad = a.code
        WHERE LENGTH(p.codigo_actividad) = 4 AND p.codigo_actividad REGEXP '^[0-9]+$'
    `);
    console.log(`Proveedores con 4 dígitos actualizados: ${updateProv.affectedRows}`);

    console.log('--- Migración v158 completada exitosamente ---');
}

module.exports = { migrate };
