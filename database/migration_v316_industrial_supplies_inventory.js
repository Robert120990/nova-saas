const pool = require('../server/src/config/db');

const DEFAULT_SUPPLIES = [
    // 1. Material de Empaque
    { code: 'CUBETA-30LB', name: 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', category: 'empaque', subcategory: 'recipiente', unit: 'unidad', min_stock: 200, unit_cost: 2.4000 },
    { code: 'TAPA-30LB', name: 'Tapadera Hermética para Cubeta 30 LBS', category: 'empaque', subcategory: 'tapadera', unit: 'unidad', min_stock: 200, unit_cost: 0.6500 },
    { code: 'LINER-30LB', name: 'Bolsa Plástica Liner Polietileno Virgen 30 LBS', category: 'empaque', subcategory: 'liner', unit: 'unidad', min_stock: 300, unit_cost: 0.3000 },
    { code: 'GALON-8LB', name: 'Envase Plástico Galón 8 LBS con Asa', category: 'empaque', subcategory: 'recipiente', unit: 'unidad', min_stock: 250, unit_cost: 0.3639 },
    { code: 'TAPA-GALON', name: 'Tapa con Sello de Seguridad para Galón', category: 'empaque', subcategory: 'tapadera', unit: 'unidad', min_stock: 250, unit_cost: 0.0215 },
    { code: 'MEDIO-GALON', name: 'Envase Plástico Medio Galón 4 LBS', category: 'empaque', subcategory: 'recipiente', unit: 'unidad', min_stock: 250, unit_cost: 0.2441 },
    { code: 'TAPA-MEDIO-GALON', name: 'Tapa con Sello para Medio Galón', category: 'empaque', subcategory: 'tapadera', unit: 'unidad', min_stock: 250, unit_cost: 0.0215 },
    { code: 'LITRO-2LB', name: 'Botella Plástica Litro 2 LBS', category: 'empaque', subcategory: 'recipiente', unit: 'unidad', min_stock: 300, unit_cost: 0.1522 },
    { code: 'TAPA-LITRO', name: 'Tapa con Sello para Botella 2 LBS', category: 'empaque', subcategory: 'tapadera', unit: 'unidad', min_stock: 300, unit_cost: 0.0215 },
    { code: 'MEDIO-LITRO-1LB', name: 'Botella Plástica Medio Litro 1 LB', category: 'empaque', subcategory: 'recipiente', unit: 'unidad', min_stock: 200, unit_cost: 0.2500 },
    { code: 'TAPA-MEDIO-LITRO', name: 'Tapa con Sello para Botella 1 LB', category: 'empaque', subcategory: 'tapadera', unit: 'unidad', min_stock: 200, unit_cost: 0.0215 },
    { code: 'ETIQ-4X2', name: 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', category: 'empaque', subcategory: 'etiqueta', unit: 'unidad', min_stock: 1000, unit_cost: 0.0350 },
    { code: 'ETIQ-4X4', name: 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', category: 'empaque', subcategory: 'etiqueta', unit: 'unidad', min_stock: 1000, unit_cost: 0.0500 },
    // 2. Ingredientes y Aditivos de Producción
    { code: 'ADIT-SAL', name: 'Sal Refinada Grado Alimenticio (Yema Salada)', category: 'aditivo', subcategory: 'ingrediente', unit: 'kg', min_stock: 100, unit_cost: 0.4500, dose_per_batch: 25 },
    { code: 'ADIT-AZUCAR', name: 'Azúcar Refinada Grado Alimenticio (Yema Azucarada 4%)', category: 'aditivo', subcategory: 'ingrediente', unit: 'kg', min_stock: 150, unit_cost: 0.8500, dose_per_batch: 40 },
    { code: 'ADIT-CITRICO', name: 'Ácido Cítrico Anhidro USP (Huevo Entero Plus 0.1%)', category: 'aditivo', subcategory: 'ingrediente', unit: 'kg', min_stock: 25, unit_cost: 3.2000, dose_per_batch: 5.44 },
    { code: 'ADIT-PPG', name: 'Propilenglicol USP Grado Alimenticio (Clara PPG)', category: 'aditivo', subcategory: 'ingrediente', unit: 'kg', min_stock: 30, unit_cost: 4.5000, dose_per_batch: 5 },
    { code: 'ADIT-LECHE', name: 'Leche Pasteurizada para Formulación (Huevo con Leche)', category: 'aditivo', subcategory: 'ingrediente', unit: 'litro', min_stock: 50, unit_cost: 1.3500, dose_per_batch: 20 },
    // 3. Químicos CIP y Sanitización
    { code: 'CIP-SODA', name: 'Soda Cáustica (Hidróxido de Sodio)', category: 'quimico_cip', subcategory: 'sanitizante', unit: 'kg', min_stock: 75, unit_cost: 1.0500, dose_per_batch: 15 },
    { code: 'CIP-HIPOCLORITO', name: 'Hipoclorito de Sodio 13%', category: 'quimico_cip', subcategory: 'sanitizante', unit: 'gal', min_stock: 20, unit_cost: 1.2000, dose_per_batch: 3.5 },
    { code: 'CIP-ACIDO', name: 'Ácido Fosfórico / Nítrico (Desincrustante)', category: 'quimico_cip', subcategory: 'sanitizante', unit: 'kg', min_stock: 25, unit_cost: 2.4167, dose_per_batch: 4 },
    { code: 'CIP-FOAM', name: 'Detergente Espumante Clean Foam', category: 'quimico_cip', subcategory: 'sanitizante', unit: 'kg', min_stock: 15, unit_cost: 2.7500, dose_per_batch: 2 }
];

async function migrate() {
    console.log('--- Migration v316: Creating egg_industrial_supplies, egg_industrial_supply_movements, menu & permissions ---');

    // 1. Tabla principal de Inventario de Insumos de Huevo Industrial
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_industrial_supplies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            item_code VARCHAR(40) NOT NULL,
            item_name VARCHAR(160) NOT NULL,
            category VARCHAR(40) NOT NULL DEFAULT 'empaque',
            subcategory VARCHAR(50) NULL,
            unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'unidad',
            current_stock DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            min_stock DECIMAL(14, 2) NOT NULL DEFAULT 50.00,
            unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
            product_id INT NULL,
            costing_source_type VARCHAR(30) NULL,
            costing_source_id INT NULL,
            dose_per_batch DECIMAL(10, 4) NULL,
            location VARCHAR(100) NULL DEFAULT 'Bodega de Insumos Planta',
            status VARCHAR(20) NOT NULL DEFAULT 'activo',
            notes VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_egg_supplies_company_code (company_id, item_code),
            KEY idx_egg_supplies_company_cat (company_id, category, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_industrial_supplies creada/verificada');

    // 2. Tabla de Kárdex / Movimientos de Insumos
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_industrial_supply_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            supply_id INT NOT NULL,
            item_code VARCHAR(40) NOT NULL,
            item_name VARCHAR(160) NOT NULL,
            category VARCHAR(40) NOT NULL DEFAULT 'empaque',
            movement_type VARCHAR(30) NOT NULL,
            quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            previous_stock DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            new_stock DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
            total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            reference_doc VARCHAR(80) NULL,
            batch_id INT NULL,
            batch_code VARCHAR(50) NULL,
            provider_name VARCHAR(150) NULL,
            notes VARCHAR(255) NULL,
            user_id INT NULL,
            user_name VARCHAR(150) NULL,
            movement_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_egg_supply_mov_company (company_id, movement_date, id),
            KEY idx_egg_supply_mov_supply (supply_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_industrial_supply_movements creada/verificada');

    // 3. Sembrar catálogo inicial de insumos para todas las empresas
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const comp of companies) {
        const companyId = comp.id;
        const placeholders = [];
        const values = [];

        for (const item of DEFAULT_SUPPLIES) {
            placeholders.push('(?, ?, ?, ?, ?, ?, 0, ?, ?, ?, \'Bodega de Insumos Planta\', \'activo\')');
            values.push(
                companyId,
                item.code,
                item.name,
                item.category,
                item.subcategory,
                item.unit,
                item.min_stock,
                item.unit_cost,
                item.dose_per_batch || null
            );
        }

        await pool.query(
            `INSERT IGNORE INTO egg_industrial_supplies
             (company_id, item_code, item_name, category, subcategory, unit_of_measure, current_stock, min_stock, unit_cost, dose_per_batch, location, status)
             VALUES ${placeholders.join(', ')}`,
            values
        );

        // Sincronizar precios y product_id con egg_costing_packaging si existen para esa empresa
        await pool.query(`
            UPDATE egg_industrial_supplies s
            INNER JOIN egg_costing_packaging p
                ON p.company_id = s.company_id AND p.item_code = s.item_code
            SET s.unit_cost = CASE WHEN p.unit_cost > 0 THEN p.unit_cost ELSE s.unit_cost END,
                s.product_id = COALESCE(s.product_id, p.product_id),
                s.costing_source_type = 'packaging',
                s.costing_source_id = p.id
            WHERE s.company_id = ?
        `, [companyId]);
    }
    console.log('✅ Catálogo inicial de insumos sincronizado con Costeo por empresa');

    // 4. Registrar ítem de menú 'Inventario de Insumos' bajo Huevo Industrial
    const [indRoots] = await pool.query(
        "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label LIKE '%Industrial%' OR label LIKE '%Huevo%') LIMIT 1"
    );
    const parentId = indRoots.length > 0 ? indRoots[0].id : 67;

    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE path = '/industrial/insumos' OR permission_key = 'manage_egg_supplies'"
    );

    if (existingMenu.length === 0) {
        const [ins] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
             VALUES ('Inventario de Insumos', '/industrial/insumos', 'Boxes', 'manage_egg_supplies', ?, 6, 1, 0)`,
            [parentId]
        );
        console.log(`✅ Menú 'Inventario de Insumos' creado con ID: ${ins.insertId}`);
    } else {
        await pool.query(
            `UPDATE menu_items
             SET label = 'Inventario de Insumos',
                 path = '/industrial/insumos',
                 icon = 'Boxes',
                 permission_key = 'manage_egg_supplies',
                 parent_id = ?,
                 sort_order = 6,
                 is_active = 1,
                 hide_in_menu = 0
             WHERE id = ?`,
            [parentId, existingMenu[0].id]
        );
        console.log(`ℹ️ Menú 'Inventario de Insumos' actualizado con ID: ${existingMenu[0].id}`);
    }

    // 5. Heredar permiso manage_egg_supplies en roles administrativos y roles con acceso industrial
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedRoles = 0;
    const industrialPerms = [
        'view_industrial_dashboard',
        'manage_packaging',
        'manage_production',
        'manage_industrial_costs',
        'view_egg_inventory',
        'manage_egg_dispatch',
        'manage_mp_reception',
        'manage_egg_containers'
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

        if (isAdminOrIndustrial && !perms.includes('manage_egg_supplies')) {
            perms.push('manage_egg_supplies');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedRoles++;
        }
    }
    console.log(`✅ Roles actualizados con manage_egg_supplies: ${updatedRoles}`);
}

module.exports = migrate;
