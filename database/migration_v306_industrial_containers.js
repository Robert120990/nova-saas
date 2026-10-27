const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v306: Creating egg_storage_containers, egg_storage_container_logs, menu item & permissions ---');

    // 1. Tabla principal de Contenedores de Almacenamiento Industrial
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_storage_containers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            container_number INT NOT NULL,
            code VARCHAR(30) NOT NULL,
            name VARCHAR(120) NOT NULL,
            is_active_power TINYINT(1) NOT NULL DEFAULT 0,
            days_on DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 195.00,
            turned_on_at DATETIME NULL,
            turned_off_at DATETIME NULL,
            notes VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_egg_container_company_num (company_id, container_number),
            KEY idx_egg_container_company (company_id, is_active_power)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_storage_containers creada/verificada');

    // 2. Bitácora histórica de ciclos y movimientos de contenedores
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_storage_container_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            container_id INT NOT NULL,
            container_name VARCHAR(120) NOT NULL,
            action_type ENUM('encendido', 'apagado', 'ajuste_dias', 'cierre_ciclo') NOT NULL,
            days_on DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 195.00,
            subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            iva_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            total_with_iva DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            started_at DATETIME NULL,
            ended_at DATETIME NULL,
            notes VARCHAR(255) NULL,
            user_id INT NULL,
            user_name VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_egg_container_logs_company (company_id, created_at),
            KEY idx_egg_container_logs_container (container_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_storage_container_logs creada/verificada');

    // 3. Sembrar los 10 contenedores iniciales por empresa si no existen
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const comp of companies) {
        const [existing] = await pool.query(
            'SELECT COUNT(*) as cnt FROM egg_storage_containers WHERE company_id = ?',
            [comp.id]
        );
        if ((existing[0]?.cnt || 0) === 0) {
            for (let num = 1; num <= 10; num++) {
                const code = `CONT-${String(num).padStart(2, '0')}`;
                const name = `Contenedor #${num}`;
                await pool.query(
                    `INSERT IGNORE INTO egg_storage_containers
                     (company_id, container_number, code, name, is_active_power, days_on, daily_rate)
                     VALUES (?, ?, ?, ?, 0, 0, 195.00)`,
                    [comp.id, num, code, name]
                );
            }
            console.log(`  → Sembrados 10 contenedores iniciales para empresa ID=${comp.id}`);
        }
    }

    // 4. Registrar ítem de menú bajo Huevo Industrial
    const [indRoots] = await pool.query(
        "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label LIKE '%Industrial%' OR label LIKE '%Huevo%') LIMIT 1"
    );
    const parentId = indRoots.length > 0 ? indRoots[0].id : 67;

    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE path = '/industrial/contenedores' OR permission_key = 'manage_egg_containers'"
    );

    if (existingMenu.length === 0) {
        const [ins] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
             VALUES ('Contenedores de Frío', '/industrial/contenedores', 'Container', 'manage_egg_containers', ?, 4, 1, 0)`,
            [parentId]
        );
        console.log(`✅ Menú 'Contenedores de Frío' creado con ID: ${ins.insertId}`);
    } else {
        await pool.query(
            `UPDATE menu_items
             SET label = 'Contenedores de Frío',
                 path = '/industrial/contenedores',
                 icon = 'Container',
                 permission_key = 'manage_egg_containers',
                 parent_id = ?,
                 sort_order = 4,
                 is_active = 1,
                 hide_in_menu = 0
             WHERE id = ?`,
            [parentId, existingMenu[0].id]
        );
        console.log(`ℹ️ Menú 'Contenedores de Frío' actualizado con ID: ${existingMenu[0].id}`);
    }

    // 5. Heredar permiso manage_egg_containers en roles administrativos y roles con acceso industrial
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedRoles = 0;
    const industrialPerms = [
        'view_industrial_dashboard',
        'manage_packaging',
        'manage_production',
        'manage_industrial_costs',
        'view_egg_inventory',
        'manage_egg_dispatch',
        'manage_mp_reception'
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
            industrialPerms.some(p => perms.includes(p));

        if (isAdminOrIndustrial && !perms.includes('manage_egg_containers')) {
            perms.push('manage_egg_containers');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedRoles++;
        }
    }
    console.log(`✅ Roles actualizados con manage_egg_containers: ${updatedRoles}`);
}

module.exports = migrate;
