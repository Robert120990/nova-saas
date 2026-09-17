const fs = require('fs');
const path = require('path');
const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('--- Iniciando Migración v199: Mejoras Integrales Huevo Industrial ---');

    try {
        // 1. Ejecutar DDL principal sentencia por sentencia
        const sqlPath = path.join(__dirname, 'migration_v199_egg_industrial_complete_enhancements.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            await pool.query(stmt);
        }
        console.log('✓ Tablas egg_batch_waste_logs, egg_batch_remanentes y egg_product_code_mappings verificadas/creadas.');

        // 2. Agregar columnas a egg_production_batches si no existen
        const [pkgStatusCol] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'packaging_status'"
        );
        if (pkgStatusCol.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN packaging_status ENUM('pendiente', 'en_envasado', 'cerrado') NOT NULL DEFAULT 'pendiente' AFTER status");
            console.log('✓ Columna packaging_status agregada a egg_production_batches.');
        }

        const [pkgLossCol] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'packaging_loss_lbs'"
        );
        if (pkgLossCol.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN packaging_loss_lbs DECIMAL(12,2) DEFAULT 0.00 AFTER packaging_status");
            console.log('✓ Columna packaging_loss_lbs agregada a egg_production_batches.');
        }

        const [pkgEffCol] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'packaging_efficiency_pct'"
        );
        if (pkgEffCol.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN packaging_efficiency_pct DECIMAL(5,2) DEFAULT 0.00 AFTER packaging_loss_lbs");
            console.log('✓ Columna packaging_efficiency_pct agregada a egg_production_batches.');
        }

        const [notesCol] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'notes'"
        );
        if (notesCol.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN notes TEXT NULL AFTER packaging_efficiency_pct");
            console.log('✓ Columna notes agregada a egg_production_batches.');
        }

        // 3. Menú e ítems de navegación para Huevo Industrial
        const [parentRows] = await pool.query(
            "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%') LIMIT 1"
        );
        const industrialParentId = parentRows[0]?.id || 67;

        // Corregir clave de permiso única para Despachos y Rutas
        await pool.query(
            "UPDATE menu_items SET permission_key = 'manage_egg_dispatch' WHERE path = '/industrial/despachos'"
        );

        // Submenú Inventario Industrial
        const [invMenu] = await pool.query("SELECT id FROM menu_items WHERE path = '/industrial/inventario' LIMIT 1");
        if (invMenu.length === 0) {
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, extra_permissions, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Inventario Industrial', '/industrial/inventario', 'Boxes', 'view_egg_inventory', NULL, 65, 1, 0)`,
                [industrialParentId]
            );
            console.log('✓ Menú Inventario Industrial creado.');
        }

        // Submenú Reportes de Planta
        const [repMenu] = await pool.query("SELECT id FROM menu_items WHERE path = '/industrial/reportes' LIMIT 1");
        if (repMenu.length === 0) {
            const reportExtras = JSON.stringify([
                'view_egg_raw_materials_report',
                'view_egg_production_report',
                'view_egg_packaging_report',
                'view_egg_quality_report',
                'view_egg_inventory_report'
            ]);
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, extra_permissions, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Reportes de Planta', '/industrial/reportes', 'FileBarChart', 'view_egg_reports', ?, 75, 1, 0)`,
                [industrialParentId, reportExtras]
            );
            console.log('✓ Menú Reportes de Planta creado.');
        }

        // Actualizar extra_permissions en Producción y Recepción para incluir permisos de edición y eliminación
        const prodExtras = JSON.stringify(['edit_egg_production', 'delete_egg_production', 'manage_egg_packaging_close']);
        await pool.query(
            "UPDATE menu_items SET extra_permissions = ? WHERE path = '/industrial/produccion'",
            [prodExtras]
        );

        const recExtras = JSON.stringify(['edit_egg_quality', 'delete_egg_reception']);
        await pool.query(
            "UPDATE menu_items SET extra_permissions = ? WHERE path = '/industrial/recepcion'",
            [recExtras]
        );

        // 4. Poblar mapeos iniciales según documento para ANDELSA (company_id = 9 o empresas avícolas)
        const [existingMappings] = await pool.query('SELECT COUNT(*) as count FROM egg_product_code_mappings');
        if (existingMappings[0]?.count === 0) {
            const seedMappings = [
                [9, 'huevo entero', 'galón 8LB', 'HEGL8,hd4kg,167347', 8.00, 3.63, 'Mapeo inicial galón huevo entero'],
                [9, 'huevo entero', 'litro 2LB', 'hel2,48758943', 2.00, 0.91, 'Mapeo inicial litro huevo entero'],
                [9, 'huevo entero', 'cubeta 32LB', 'hec32', 32.00, 14.51, 'Mapeo inicial cubeta huevo entero'],
                [9, 'clara', 'galón 8LB', 'CL2b', 8.00, 3.63, 'Mapeo inicial clara']
            ];
            await pool.query(
                'INSERT INTO egg_product_code_mappings (company_id, industrial_product_type, presentation, catalog_codes, unit_weight_lbs, unit_weight_kg, notes) VALUES ?',
                [seedMappings]
            );
            console.log('✓ Mapeos de códigos iniciales sembrados con éxito.');
        }

        // 5. Herencia de permisos a roles existentes
        const newPerms = [
            'manage_egg_dispatch',
            'view_egg_inventory',
            'view_egg_reports',
            'view_egg_raw_materials_report',
            'view_egg_production_report',
            'view_egg_packaging_report',
            'view_egg_quality_report',
            'view_egg_inventory_report',
            'edit_egg_quality',
            'delete_egg_reception',
            'edit_egg_production',
            'delete_egg_production',
            'manage_egg_packaging_close'
        ];

        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        for (const role of roles) {
            let perms = [];
            if (role.permissions) {
                if (Array.isArray(role.permissions)) perms = [...role.permissions];
                else if (typeof role.permissions === 'string') {
                    try { perms = JSON.parse(role.permissions); } catch (e) { perms = []; }
                }
            }

            const isSuperOrAdmin = role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('super');
            const hasEggAccess = perms.includes('manage_production') || perms.includes('manage_mp_reception') || perms.includes('view_industrial_dashboard');

            if (isSuperOrAdmin || hasEggAccess) {
                let changed = false;
                for (const np of newPerms) {
                    if (!perms.includes(np)) {
                        perms.push(np);
                        changed = true;
                    }
                }
                if (changed) {
                    await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                    console.log(`  → Permisos heredados a rol "${role.name}" (id=${role.id})`);
                }
            }
        }

        console.log('--- Migración v199 completada con éxito. ---');
    } catch (error) {
        console.error('Error durante la migración v199:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
