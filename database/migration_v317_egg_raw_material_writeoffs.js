const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v317: Creating egg_raw_material_writeoffs table, menu item & unique permission ---');

    // 1. Tabla de bajas de tarimas de materia prima vinculadas a facturas u otros motivos no productivos
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_raw_material_writeoffs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            branch_id INT NULL,
            raw_material_id INT NOT NULL,
            sale_id INT NULL,
            invoice_number VARCHAR(120) NULL,
            invoice_dte_type VARCHAR(20) NULL,
            invoice_date DATE NULL,
            invoice_total DECIMAL(14, 2) NULL DEFAULT 0.00,
            customer_id INT NULL,
            customer_name VARCHAR(200) NULL,
            reason_type ENUM('venta_factura', 'merma_dano', 'donacion', 'ajuste_inventario', 'otro') NOT NULL DEFAULT 'venta_factura',
            tarimas_json JSON NOT NULL,
            tarimas_count INT NOT NULL DEFAULT 0,
            boxes_count INT NOT NULL DEFAULT 0,
            quantity_lbs DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            notes TEXT NULL,
            status ENUM('activo', 'revertido') NOT NULL DEFAULT 'activo',
            created_by INT NULL,
            operator_name VARCHAR(150) NULL,
            reverted_at DATETIME NULL,
            reverted_by INT NULL,
            reverted_by_name VARCHAR(150) NULL,
            revert_reason VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_writeoffs_company_status (company_id, status, created_at),
            INDEX idx_writeoffs_company_rm (company_id, raw_material_id, status),
            INDEX idx_writeoffs_company_sale (company_id, sale_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla egg_raw_material_writeoffs verificada/creada.');

    // 2. Localizar el grupo padre "Huevo Industrial" en menu_items
    const [parentRows] = await pool.query(
        "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label LIKE '%Huevo%' OR label LIKE '%Industrial%') ORDER BY id ASC LIMIT 1"
    );
    const parentId = parentRows[0]?.id || 67;

    // 3. Registrar ítem de menú único bajo Huevo Industrial (clave de permiso única)
    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE path = '/industrial/baja-tarimas' OR permission_key = 'manage_egg_tarima_writeoffs'"
    );

    if (existingMenu.length === 0) {
        const [ins] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
             VALUES ('Facturas y Baja de Tarimas', '/industrial/baja-tarimas', 'Receipt', 'manage_egg_tarima_writeoffs', ?, 1, 1, 0)`,
            [parentId]
        );
        console.log(`✅ Menú 'Facturas y Baja de Tarimas' creado con ID: ${ins.insertId}`);
    } else {
        await pool.query(
            `UPDATE menu_items
             SET label = 'Facturas y Baja de Tarimas',
                 path = '/industrial/baja-tarimas',
                 icon = 'Receipt',
                 permission_key = 'manage_egg_tarima_writeoffs',
                 parent_id = ?,
                 sort_order = 1,
                 is_active = 1,
                 hide_in_menu = 0
             WHERE id = ?`,
            [parentId, existingMenu[0].id]
        );
        console.log(`ℹ️ Menú 'Facturas y Baja de Tarimas' actualizado con ID: ${existingMenu[0].id}`);
    }

    // 4. Heredar permiso manage_egg_tarima_writeoffs a roles administrativos y roles con acceso industrial
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedRoles = 0;
    const industrialPerms = [
        'manage_mp_reception',
        'manage_production',
        'view_egg_inventory',
        'view_industrial_dashboard',
        'manage_egg_dispatch'
    ];

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { continue; }
        }
        if (!Array.isArray(perms)) continue;

        const roleLower = (role.name || '').toLowerCase();
        const isAdminOrIndustrial =
            role.name === 'SuperAdmin' ||
            roleLower.includes('admin') ||
            industrialPerms.some((p) => perms.includes(p));

        if (isAdminOrIndustrial && !perms.includes('manage_egg_tarima_writeoffs')) {
            perms.push('manage_egg_tarima_writeoffs');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedRoles++;
        }
    }
    console.log(`✅ Roles actualizados con manage_egg_tarima_writeoffs: ${updatedRoles}`);
}

module.exports = migrate;
