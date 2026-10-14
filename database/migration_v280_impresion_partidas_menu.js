const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v280: Menú y Permiso de Impresión de Partidas Contables ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Localizar el id padre de 'Reportes' en Contabilidad (parent_id: 153)
        let parentId = 153;
        const [parentRow] = await conn.query(
            "SELECT id FROM menu_items WHERE (label = 'Reportes' OR label = 'Reportes Contables') AND parent_id = 21 LIMIT 1"
        );
        if (parentRow.length > 0) {
            parentId = parentRow[0].id;
        }

        // 2. Verificar si ya existe 'Impresión de Partidas'
        const permissionKey = 'view_accounting_impresion_partidas';
        const reportPath = '/contabilidad/reportes/impresion-partidas';
        const [existingItem] = await conn.query(
            "SELECT id FROM menu_items WHERE permission_key = ? OR path = ?",
            [permissionKey, reportPath]
        );

        if (existingItem.length === 0) {
            await conn.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (?, 'Impresión de Partidas', ?, 'Printer', ?, 15, 1, 0)
            `, [parentId, reportPath, permissionKey]);
            console.log('Ítem de menú "Impresión de Partidas" creado exitosamente.');
        } else {
            await conn.query(
                "UPDATE menu_items SET label = 'Impresión de Partidas', path = ?, icon = 'Printer', permission_key = ?, sort_order = 15, is_active = 1 WHERE id = ?",
                [reportPath, permissionKey, existingItem[0].id]
            );
            console.log('Ítem de menú actualizado a "Impresión de Partidas".');
        }

        // 3. Heredar permiso a roles administrativos y de contabilidad
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
            const hasAccountingAccess = perms.includes('view_accounting_libro_diario') || 
                                        perms.includes('view_accounting_listado_partidas') || 
                                        perms.includes('manage_accounting_entries');

            if ((isSuperOrAdmin || hasAccountingAccess) && !perms.includes(permissionKey)) {
                perms.push(permissionKey);
                await conn.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`Permiso ${permissionKey} otorgado al rol ${role.name} (ID: ${role.id})`);
            }
        }

        await conn.commit();
        console.log('--- Migración v280 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v280:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
