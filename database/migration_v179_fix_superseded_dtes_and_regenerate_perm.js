/**
 * Migración v179: Desvinculación de DTEs históricos/fallidos y registro de permiso 'regenerate_dte'
 */

const pool = require('../server/src/config/db');

async function migrate() {
    console.log('Iniciando migración v179...');

    // 1. Desvincular DTEs históricos/fallidos donde d.codigo_generacion != s.codigo_generacion
    console.log('  1. Analizando DTEs desfasados/fallidos vinculados a ventas...');
    const [desfasados] = await pool.query(`
        SELECT d.id as dte_id, d.venta_id, d.numero_control as dte_control, d.codigo_generacion as dte_cg,
               s.numero_control as sale_control, s.codigo_generacion as sale_cg
        FROM dtes d
        JOIN sales_headers s ON s.id = d.venta_id
        WHERE d.codigo_generacion != s.codigo_generacion
    `);

    console.log(`  → Se encontraron ${desfasados.length} registros en 'dtes' que no corresponden al DTE activo de la venta.`);

    if (desfasados.length > 0) {
        const [updateResult] = await pool.query(`
            UPDATE dtes d
            JOIN sales_headers s ON s.id = d.venta_id
            SET d.venta_id = NULL
            WHERE d.codigo_generacion != s.codigo_generacion
        `);
        console.log(`  ✓ Actualizados ${updateResult.affectedRows} registros en 'dtes' estableciendo venta_id = NULL (conservados para auditoría).`);
    }

    // 2. Registrar el permiso 'regenerate_dte' en extra_permissions de menu_items para /ventas
    console.log('  2. Registrando permiso en el catálogo de opciones...');
    const [menuVentas] = await pool.query("SELECT id, extra_permissions FROM menu_items WHERE path = '/ventas' LIMIT 1");
    
    if (menuVentas.length > 0) {
        let extras = [];
        if (menuVentas[0].extra_permissions) {
            try {
                extras = typeof menuVentas[0].extra_permissions === 'string'
                    ? JSON.parse(menuVentas[0].extra_permissions)
                    : menuVentas[0].extra_permissions;
            } catch (e) {
                extras = [];
            }
        }
        if (!Array.isArray(extras)) extras = [];
        
        if (!extras.includes('regenerate_dte')) {
            extras.push('regenerate_dte');
            await pool.query(
                "UPDATE menu_items SET extra_permissions = ? WHERE id = ?",
                [JSON.stringify(extras), menuVentas[0].id]
            );
            console.log("  ✓ Permiso 'regenerate_dte' registrado en extra_permissions de '/ventas'.");
        } else {
            console.log("  ✓ Permiso 'regenerate_dte' ya existía en extra_permissions de '/ventas'.");
        }
    }

    // 3. Regla explícita del usuario: NO asignar 'regenerate_dte' a ningún rol por defecto.
    console.log("  3. Verificando roles: 'regenerate_dte' NO se asignará a ningún rol por defecto (quedará configurable por el admin).");

    console.log('Migración v179 completada con éxito.');
}

module.exports = migrate;
