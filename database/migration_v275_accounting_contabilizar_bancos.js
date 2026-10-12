const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v275: Contabilizar Bancos y Cheques ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert menu item under parent 168 (Contabilizar)
        const [existingItem] = await conn.query(
            "SELECT id FROM menu_items WHERE permission_key = 'manage_accounting_contabilizar_bancos' OR path = '/contabilidad/contabilizar/bancos'"
        );

        if (existingItem.length === 0) {
            await conn.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (168, 'Bancos / Cheques', '/contabilidad/contabilizar/bancos', 'Landmark', 'manage_accounting_contabilizar_bancos', 4, 1, 0)
            `);
            console.log('Ítem de menú Bancos / Cheques creado.');
        } else {
            console.log('Ítem de menú ya existía, omitiendo creación.');
        }

        // 2. Inherit permission to roles that have access to accounting or admin
        const [roles] = await conn.query('SELECT id, name, permissions FROM roles');
        for (const role of roles) {
            let perms = [];
            try {
                perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
            } catch (e) {
                perms = [];
            }

            const isSuperOrAdmin = ['superadmin', 'admin', 'administrador', 'contador', 'auditor'].some(n => 
                (role.name || '').toLowerCase().includes(n)
            );
            const hasConta = perms.includes('manage_accounting_contabilizar_ventas_compras') || perms.includes('view_accounting');

            if ((isSuperOrAdmin || hasConta) && !perms.includes('manage_accounting_contabilizar_bancos')) {
                perms.push('manage_accounting_contabilizar_bancos');
                await conn.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`Permiso agregado al rol ${role.name} (ID: ${role.id})`);
            }
        }

        await conn.commit();
        console.log('--- Migración v275 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v275:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
