const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Migration v212: Reorganización de submenús en Ventas ---');

        // 1. Encontrar el nodo raíz de Ventas
        const [ventasRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Ventas' AND parent_id IS NULL LIMIT 1"
        );

        if (ventasRows.length === 0) {
            throw new Error("No se encontró el nodo raíz de 'Ventas' en menu_items.");
        }

        const ventasId = ventasRows[0].id;
        console.log(`  ✓ Nodo raíz 'Ventas' encontrado (id=${ventasId})`);

        // 2. Crear o actualizar contenedor: "Descuentos y Promociones"
        let descuentosParentId;
        const [descRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Descuentos y Promociones' AND parent_id = ? LIMIT 1",
            [ventasId]
        );

        if (descRows.length > 0) {
            descuentosParentId = descRows[0].id;
            console.log(`  → Submenú 'Descuentos y Promociones' ya existe (id=${descuentosParentId}). Actualizando...`);
            await pool.query(
                `UPDATE menu_items 
                 SET icon = 'BadgePercent', path = NULL, permission_key = NULL, sort_order = 4, is_active = 1, hide_in_menu = 0
                 WHERE id = ?`,
                [descuentosParentId]
            );
        } else {
            const [ins] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Descuentos y Promociones', NULL, 'BadgePercent', NULL, 4, 1, 0)`,
                [ventasId]
            );
            descuentosParentId = ins.insertId;
            console.log(`  ✓ Submenú 'Descuentos y Promociones' creado (id=${descuentosParentId})`);
        }

        // 3. Mover hijos a "Descuentos y Promociones":
        //    - Combos de Productos (sort_order: 1)
        //    - Descuentos por Cliente (sort_order: 2)
        //    - Reglas de Descuento (sort_order: 3)
        await pool.query(
            `UPDATE menu_items 
             SET parent_id = ?, sort_order = 1, icon = 'Package'
             WHERE path = '/ventas/combos' OR permission_key = 'manage_combos'`,
            [descuentosParentId]
        );
        console.log("  ✓ 'Combos de Productos' movido a 'Descuentos y Promociones'");

        await pool.query(
            `UPDATE menu_items 
             SET parent_id = ?, sort_order = 2, icon = 'Tag'
             WHERE path = '/ventas/descuentos' OR permission_key = 'manage_customer_discounts'`,
            [descuentosParentId]
        );
        console.log("  ✓ 'Descuentos por Cliente' movido a 'Descuentos y Promociones'");

        await pool.query(
            `UPDATE menu_items 
             SET parent_id = ?, sort_order = 3, icon = 'Tag'
             WHERE path = '/ventas/reglas-descuento' OR permission_key = 'manage_discount_rules'`,
            [descuentosParentId]
        );
        console.log("  ✓ 'Reglas de Descuento' movido a 'Descuentos y Promociones'");

        // 4. Crear o actualizar contenedor: "Eventos MH"
        let eventosParentId;
        const [eventosRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Eventos MH' AND parent_id = ? LIMIT 1",
            [ventasId]
        );

        if (eventosRows.length > 0) {
            eventosParentId = eventosRows[0].id;
            console.log(`  → Submenú 'Eventos MH' ya existe (id=${eventosParentId}). Actualizando...`);
            await pool.query(
                `UPDATE menu_items 
                 SET icon = 'FileCheck', path = NULL, permission_key = NULL, sort_order = 6, is_active = 1, hide_in_menu = 0
                 WHERE id = ?`,
                [eventosParentId]
            );
        } else {
            const [ins] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Eventos MH', NULL, 'FileCheck', NULL, 6, 1, 0)`,
                [ventasId]
            );
            eventosParentId = ins.insertId;
            console.log(`  ✓ Submenú 'Eventos MH' creado (id=${eventosParentId})`);
        }

        // 5. Mover hijos a "Eventos MH":
        //    - Contingencia DTE (sort_order: 1)
        //    - Retorno / ERET (sort_order: 2)
        await pool.query(
            `UPDATE menu_items 
             SET parent_id = ?, sort_order = 1, icon = 'AlertTriangle'
             WHERE path = '/ventas/contingencia' OR permission_key = 'manage_dte_contingency'`,
            [eventosParentId]
        );
        console.log("  ✓ 'Contingencia DTE' movido a 'Eventos MH'");

        await pool.query(
            `UPDATE menu_items 
             SET parent_id = ?, sort_order = 2, icon = 'Undo2'
             WHERE path = '/ventas/retorno' OR permission_key = 'manage_dte_return'`,
            [eventosParentId]
        );
        console.log("  ✓ 'Retorno / ERET' movido a 'Eventos MH'");

        // 6. Normalizar sort_order de los ítems directos en Ventas
        const directOrders = [
            { path: '/ventas/nueva', sort_order: 1 },
            { path: '/ventas', sort_order: 2 },
            { path: '/ventas/cierre', sort_order: 3 },
            // Descuentos y Promociones: 4
            { path: '/ventas/combustibles', sort_order: 5 },
            // Eventos MH: 6
            { path: '/ventas/dtes-turno', sort_order: 7 },
            { path: '/ventas/entrega-remesas', sort_order: 8 },
            { path: '/ventas/configuracion', sort_order: 9 },
        ];

        for (const item of directOrders) {
            await pool.query(
                'UPDATE menu_items SET sort_order = ? WHERE parent_id = ? AND path = ?',
                [item.sort_order, ventasId, item.path]
            );
        }

        // Reportes en Ventas
        await pool.query(
            "UPDATE menu_items SET sort_order = 10 WHERE parent_id = ? AND label = 'Reportes'",
            [ventasId]
        );

        console.log('\n--- Migración v212 completada exitosamente ---');
    } catch (error) {
        console.error('Error en migración v212:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
