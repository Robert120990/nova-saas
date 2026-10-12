const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v273: Contabilizar Cierres de Turno ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Create table gas_station_closeout_costs
        await conn.query(`
            CREATE TABLE IF NOT EXISTS gas_station_closeout_costs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                date DATE NOT NULL,
                product_id INT NOT NULL,
                costo_unitario DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_company_branch_date_product (company_id, branch_id, date, product_id),
                INDEX idx_company_branch_date (company_id, branch_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Tabla gas_station_closeout_costs creada o verificada.');

        // 2. Insert menu item
        const [existingItem] = await conn.query(
            "SELECT id FROM menu_items WHERE permission_key = 'manage_accounting_contabilizar_turnos' OR path = '/contabilidad/contabilizar/turnos'"
        );

        if (existingItem.length === 0) {
            await conn.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (168, 'Cierres de Turno', '/contabilidad/contabilizar/turnos', 'Fuel', 'manage_accounting_contabilizar_turnos', 3, 1, 0)
            `);
            console.log('Ítem de menú Cierres de Turno creado.');
        } else {
            console.log('Ítem de menú ya existía, omitiendo creación.');
        }

        // 3. Inherit permission to roles that have access to accounting or admin
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

            if ((isSuperOrAdmin || hasConta) && !perms.includes('manage_accounting_contabilizar_turnos')) {
                perms.push('manage_accounting_contabilizar_turnos');
                await conn.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`Permiso agregado al rol ${role.name} (ID: ${role.id})`);
            }
        }

        await conn.commit();
        console.log('--- Migración v273 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v273:', err);
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { migrate };
