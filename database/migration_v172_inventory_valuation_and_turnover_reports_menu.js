const pool = require('../server/src/config/db');

const NEW_INVENTORY_REPORTS = [
    {
        label: 'Valorización y Márgenes',
        path: '/inventario/reportes/valorizacion',
        icon: 'TrendingUp',
        permission_key: 'view_stock_report',
        sort_order: 3,
    },
    {
        label: 'Rotación y Obsolescencia',
        path: '/inventario/reportes/rotacion',
        icon: 'Clock',
        permission_key: 'view_stock_report',
        sort_order: 4,
    },
];

async function runMigration() {
    try {
        console.log('Running migration v172 - Adding Inventory Valuation & Turnover reports to menu...');

        // 1. Localizar nodo "Inventario" raíz
        const [[invGroup]] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Inventario' AND parent_id IS NULL LIMIT 1"
        );

        if (!invGroup) {
            console.error('ERROR: No se encontró el grupo principal "Inventario".');
            return;
        }

        // 2. Localizar o crear submenú "Reportes" bajo "Inventario"
        let [[reportsParent]] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1",
            [invGroup.id]
        );

        if (!reportsParent) {
            const [maxOrder] = await pool.query(
                'SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?',
                [invGroup.id]
            );
            const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            const [result] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, icon, permission_key, sort_order, is_active)
                 VALUES (?, 'Reportes', 'BarChart3', NULL, ?, TRUE)`,
                [invGroup.id, nextOrder]
            );
            reportsParent = { id: result.insertId };
            console.log(`  → Submenú "Reportes" creado (id=${reportsParent.id})`);
        } else {
            console.log(`  → Submenú "Reportes" localizado (id=${reportsParent.id})`);
        }

        // 3. Insertar o actualizar los nuevos reportes
        for (const report of NEW_INVENTORY_REPORTS) {
            const [[existing]] = await pool.query(
                'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
                [report.path]
            );

            if (existing) {
                await pool.query(
                    `UPDATE menu_items 
                     SET label = ?, icon = ?, permission_key = ?, parent_id = ?, sort_order = ?, is_active = TRUE 
                     WHERE id = ?`,
                    [report.label, report.icon, report.permission_key, reportsParent.id, report.sort_order, existing.id]
                );
                console.log(`  → Reporte "${report.label}" actualizado (id=${existing.id})`);
            } else {
                const [ins] = await pool.query(
                    `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                    [reportsParent.id, report.label, report.path, report.icon, report.permission_key, report.sort_order]
                );
                console.log(`  → Reporte "${report.label}" insertado (id=${ins.insertId})`);
            }
        }

        console.log('Migration v172 completed successfully.');
    } catch (error) {
        console.error('Error in migration v172:', error);
        throw error;
    }
}

module.exports = runMigration;
