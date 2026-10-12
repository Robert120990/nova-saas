const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v276: Renombrar Anexos de IVA en Menú ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Localizar el id padre de 'Libros de IVA'
        const [parentRow] = await conn.query(
            "SELECT id FROM menu_items WHERE label = 'Libros de IVA' AND parent_id IS NULL LIMIT 1"
        );
        const parentId = parentRow[0]?.id || 63;

        // 2. Renombrar o insertar 'Anexo de IVA Compras'
        const [existingItem] = await conn.query(
            "SELECT id FROM menu_items WHERE permission_key = 'view_iva_declaraciones' OR path = '/iva/declaraciones'"
        );

        if (existingItem.length === 0) {
            await conn.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (?, 'Anexo de IVA Compras', '/iva/declaraciones', 'FileSpreadsheet', 'view_iva_declaraciones', 6, 1, 0)
            `, [parentId]);
            console.log('Ítem de menú "Anexo de IVA Compras" creado exitosamente.');
        } else {
            await conn.query(
                "UPDATE menu_items SET label = 'Anexo de IVA Compras' WHERE id = ?",
                [existingItem[0].id]
            );
            console.log('Ítem de menú renombrado a "Anexo de IVA Compras".');
        }

        // 3. Renombrar la opción de ventas a 'Anexo de IVA Ventas'
        const [anexosVentas] = await conn.query(
            "UPDATE menu_items SET label = 'Anexo de IVA Ventas' WHERE path = '/iva/anexos-iva' OR permission_key = 'view_iva_anexos'"
        );
        console.log('Ítem de ventas actualizado a "Anexo de IVA Ventas".');

        // 4. Heredar permisos a roles administrativos y de contabilidad
        const [roles] = await conn.query('SELECT id, name, permissions FROM roles');
        for (const role of roles) {
            let perms = [];
            try {
                perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
            } catch (e) {
                perms = [];
            }

            const roleNameLower = (role.name || '').toLowerCase();
            const isSuperOrAdmin = ['superadmin', 'admin', 'administrador', 'contador', 'auditor'].some(n => 
                roleNameLower.includes(n)
            );
            const hasIvaAccess = perms.includes('view_vat_liquidation') || 
                                 perms.includes('view_purchase_ledger') || 
                                 perms.includes('view_ccf_sales_ledger') || 
                                 perms.includes('view_iva_anexos');

            if ((isSuperOrAdmin || hasIvaAccess) && !perms.includes('view_iva_declaraciones')) {
                perms.push('view_iva_declaraciones');
                await conn.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`Permiso view_iva_declaraciones otorgado al rol ${role.name} (ID: ${role.id})`);
            }
        }

        await conn.commit();
        console.log('--- Migración v276 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v276:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
