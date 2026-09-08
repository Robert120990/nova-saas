const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v173 - Adding "Liquidación IVA y Pago a Cuenta" to menu and permissions...');

        // 1. Localizar nodo padre "Libros de IVA" (id: 63 o por label)
        let [[vatParent]] = await pool.query(
            "SELECT id FROM menu_items WHERE id = 63 AND parent_id IS NULL LIMIT 1"
        );

        if (!vatParent) {
            [[vatParent]] = await pool.query(
                "SELECT id FROM menu_items WHERE label = 'Libros de IVA' AND parent_id IS NULL LIMIT 1"
            );
        }

        if (!vatParent) {
            console.error('ERROR: No se encontró el grupo principal "Libros de IVA".');
            return;
        }

        console.log(`  → Grupo "Libros de IVA" localizado (id=${vatParent.id})`);

        // 2. Insertar o actualizar el nuevo ítem de menú
        const reportPath = '/iva/liquidacion';
        const reportLabel = 'Liquidación IVA y Pago a Cuenta';
        const permissionKey = 'view_vat_liquidation';

        const [[existing]] = await pool.query(
            'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
            [reportPath]
        );

        if (existing) {
            await pool.query(
                `UPDATE menu_items 
                 SET label = ?, icon = 'Calculator', permission_key = ?, parent_id = ?, sort_order = 5, is_active = TRUE 
                 WHERE id = ?`,
                [reportLabel, permissionKey, vatParent.id, existing.id]
            );
            console.log(`  → Menú "${reportLabel}" actualizado (id=${existing.id})`);
        } else {
            const [ins] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                 VALUES (?, ?, ?, 'Calculator', ?, 5, TRUE)`,
                [vatParent.id, reportLabel, reportPath, permissionKey]
            );
            console.log(`  → Menú "${reportLabel}" insertado (id=${ins.insertId})`);
        }

        // 3. Asignar permiso a roles administradores si tienen view_purchase_ledger o view_ccf_sales_ledger
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        for (const role of roles) {
            let perms = [];
            try {
                perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || []);
            } catch (e) {
                perms = [];
            }

            if (!Array.isArray(perms)) perms = [];

            const isSuperOrAdmin = role.name === 'SuperAdmin' || role.name === 'Administrador' || role.name === 'Admin';
            const hasVatBookAccess = perms.includes('view_purchase_ledger') || perms.includes('view_ccf_sales_ledger') || perms.includes('view_iva_anexos');

            if ((isSuperOrAdmin || hasVatBookAccess) && !perms.includes(permissionKey)) {
                perms.push(permissionKey);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`  → Permiso "${permissionKey}" asignado al rol "${role.name}" (id=${role.id})`);
            }
        }

        console.log('Migration v173 completed successfully.');
    } catch (error) {
        console.error('Error in migration v173:', error);
        throw error;
    }
}

module.exports = runMigration;
