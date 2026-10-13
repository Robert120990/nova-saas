const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v279: Menú y Permiso de Auditoría Contable ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Localizar el id padre de 'Contabilidad'
        const [parentRow] = await conn.query(
            "SELECT id FROM menu_items WHERE label = 'Contabilidad' AND parent_id IS NULL LIMIT 1"
        );
        const parentId = parentRow[0]?.id || 21;

        // 2. Verificar si ya existe 'Auditoría Contable'
        const [existingItem] = await conn.query(
            "SELECT id FROM menu_items WHERE permission_key = 'manage_accounting_audit' OR path = '/contabilidad/auditoria'"
        );

        if (existingItem.length === 0) {
            await conn.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (?, 'Auditoría Contable', '/contabilidad/auditoria', 'Shield', 'manage_accounting_audit', 8, 1, 0)
            `, [parentId]);
            console.log('Ítem de menú "Auditoría Contable" creado exitosamente.');
        } else {
            await conn.query(
                "UPDATE menu_items SET label = 'Auditoría Contable', path = '/contabilidad/auditoria', icon = 'Shield', permission_key = 'manage_accounting_audit' WHERE id = ?",
                [existingItem[0].id]
            );
            console.log('Ítem de menú actualizado a "Auditoría Contable".');
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
            const hasAccountingAccess = perms.includes('manage_accounting_entries') || 
                                        perms.includes('manage_account_chart') || 
                                        perms.includes('manage_annual_close');

            if ((isSuperOrAdmin || hasAccountingAccess) && !perms.includes('manage_accounting_audit')) {
                perms.push('manage_accounting_audit');
                await conn.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`Permiso manage_accounting_audit otorgado al rol ${role.name} (ID: ${role.id})`);
            }
        }

        await conn.commit();
        console.log('--- Migración v279 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v279:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
