const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('=== Iniciando Migración v222: Limpieza de Menú Duplicado Descuentos y Promos ===');

        // 1. Obtener nodo raíz de Ventas
        const [ventasRows] = await pool.query(
            "SELECT id FROM menu_items WHERE (label = 'Ventas' OR id = 6) AND parent_id IS NULL LIMIT 1"
        );
        const ventasId = ventasRows.length > 0 ? ventasRows[0].id : 6;

        // 2. Buscar contenedores de Descuentos en Ventas
        const [descRows] = await pool.query(`
            SELECT id, label, path, sort_order,
                   (SELECT COUNT(*) FROM menu_items WHERE parent_id = m.id) as children_count
            FROM menu_items m
            WHERE parent_id = ? AND (label LIKE '%Descuentos y Promoc%' OR label LIKE '%Descuentos y Promo%')
        `, [ventasId]);

        console.log(`Encontrados ${descRows.length} contenedores de Descuentos:`, descRows);

        if (descRows.length > 1) {
            // El contenedor principal es el que tiene hijos, o el de id 224
            let mainContainer = descRows.find(d => d.children_count > 0) || descRows[0];
            const duplicates = descRows.filter(d => d.id !== mainContainer.id);

            for (const dup of duplicates) {
                // Reasignar cualquier hijo que pudiera tener al contenedor principal
                await pool.query(
                    'UPDATE menu_items SET parent_id = ? WHERE parent_id = ?',
                    [mainContainer.id, dup.id]
                );
                // Eliminar el duplicado huérfano
                await pool.query('DELETE FROM menu_items WHERE id = ?', [dup.id]);
                console.log(`  ✓ Eliminado contenedor duplicado huérfano id=${dup.id} ('${dup.label}')`);
            }

            // Normalizar el contenedor principal
            await pool.query(`
                UPDATE menu_items 
                SET label = 'Descuentos y Promociones', 
                    path = NULL, 
                    icon = 'BadgePercent', 
                    sort_order = 4, 
                    is_active = 1, 
                    hide_in_menu = 0
                WHERE id = ?
            `, [mainContainer.id]);
            console.log(`  ✓ Contenedor principal id=${mainContainer.id} normalizado como 'Descuentos y Promociones'`);
        } else if (descRows.length === 1) {
            await pool.query(`
                UPDATE menu_items 
                SET label = 'Descuentos y Promociones', 
                    path = NULL, 
                    icon = 'BadgePercent', 
                    sort_order = 4, 
                    is_active = 1, 
                    hide_in_menu = 0
                WHERE id = ?
            `, [descRows[0].id]);
            console.log(`  ✓ Contenedor único id=${descRows[0].id} normalizado.`);
        }

        // 3. Garantizar que los 4 hijos estén correctamente asignados al contenedor principal
        const [targetRows] = await pool.query(`
            SELECT id FROM menu_items 
            WHERE parent_id = ? AND label = 'Descuentos y Promociones' 
            LIMIT 1
        `, [ventasId]);

        if (targetRows.length > 0) {
            const parentId = targetRows[0].id;
            const childrenUpdates = [
                { path: '/ventas/combos', perm: 'manage_combos', order: 1, icon: 'Package' },
                { path: '/ventas/descuentos', perm: 'manage_customer_discounts', order: 2, icon: 'Tag' },
                { path: '/ventas/reglas-descuento', perm: 'manage_discount_rules', order: 3, icon: 'Tag' },
                { path: '/ventas/promociones', perm: 'manage_sales_promotions', order: 4, icon: 'Sparkles' },
            ];

            for (const child of childrenUpdates) {
                await pool.query(`
                    UPDATE menu_items 
                    SET parent_id = ?, sort_order = ?, icon = ?
                    WHERE path = ? OR permission_key = ?
                `, [parentId, child.order, child.icon, child.path, child.perm]);
            }
            console.log(`  ✓ Sub-ítems vinculados y ordenados bajo parent_id=${parentId}`);
        }

        console.log('=== Migración v222 completada exitosamente ===');
    } catch (error) {
        console.error('Error durante migración v222:', error);
        throw error;
    }
}

module.exports = { runMigration };
