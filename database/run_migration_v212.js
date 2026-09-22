const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v212: Descuentos por POS, Reglas por Sucursal y Permisos de Descuento ---');

        // 1. Columna allow_discounts en points_of_sale
        const [posCols] = await pool.query('DESCRIBE points_of_sale');
        const posColNames = posCols.map(c => c.Field);

        if (!posColNames.includes('allow_discounts')) {
            await pool.query('ALTER TABLE points_of_sale ADD COLUMN allow_discounts BOOLEAN DEFAULT FALSE AFTER status');
            console.log('  → Columna allow_discounts agregada a points_of_sale (DEFAULT FALSE).');
        } else {
            await pool.query('ALTER TABLE points_of_sale MODIFY COLUMN allow_discounts BOOLEAN DEFAULT FALSE');
            console.log('  ✓ Columna allow_discounts asegurada como DEFAULT FALSE en points_of_sale.');
        }

        // 2. Columnas de reglas de descuento en branches
        const [branchCols] = await pool.query('DESCRIBE branches');
        const branchColNames = branchCols.map(c => c.Field);

        if (!branchColNames.includes('discount_percentages')) {
            await pool.query("ALTER TABLE branches ADD COLUMN discount_percentages JSON DEFAULT NULL AFTER omitir_digito_verificador");
            console.log('  → Columna discount_percentages agregada a branches.');
        } else {
            console.log('  ✓ Columna discount_percentages ya existe en branches.');
        }

        if (!branchColNames.includes('max_discount_amount')) {
            await pool.query("ALTER TABLE branches ADD COLUMN max_discount_amount DECIMAL(10,2) DEFAULT NULL AFTER discount_percentages");
            console.log('  → Columna max_discount_amount agregada a branches.');
        } else {
            console.log('  ✓ Columna max_discount_amount ya existe en branches.');
        }

        if (!branchColNames.includes('max_discount_percentage')) {
            await pool.query("ALTER TABLE branches ADD COLUMN max_discount_percentage DECIMAL(5,2) DEFAULT NULL AFTER max_discount_amount");
            console.log('  → Columna max_discount_percentage agregada a branches.');
        } else {
            console.log('  ✓ Columna max_discount_percentage ya existe en branches.');
        }

        // Backfill valores iniciales para discount_percentages en branches existentes
        await pool.query(`
            UPDATE branches 
            SET discount_percentages = '["5", "10", "15", "20"]'
            WHERE discount_percentages IS NULL
        `);
        console.log('  ✓ Configuración predeterminada de discount_percentages asignada a las sucursales.');

        // 3. Permisos en menu_items
        const [permItem] = await pool.query("SELECT id FROM menu_items WHERE permission_key = 'apply_item_discount' LIMIT 1");
        if (permItem.length === 0) {
            await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (6, 'Aplicar Descuentos por Ítem en POS', NULL, 'Tag', 'apply_item_discount', 91, 1, 1)
            `);
            console.log("  → Permiso 'apply_item_discount' insertado en menu_items.");
        } else {
            console.log("  ✓ Permiso 'apply_item_discount' ya existe en menu_items.");
        }

        const [permGen] = await pool.query("SELECT id FROM menu_items WHERE permission_key = 'apply_general_discount' LIMIT 1");
        if (permGen.length === 0) {
            await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (6, 'Aplicar Descuento General en POS', NULL, 'Percent', 'apply_general_discount', 92, 1, 1)
            `);
            console.log("  → Permiso 'apply_general_discount' insertado en menu_items.");
        } else {
            console.log("  ✓ Permiso 'apply_general_discount' ya existe en menu_items.");
        }

        // 4. Permisos desactivados por defecto en todos los roles (para que el administrador los configure según necesidad)
        console.log('  ✓ Permisos de descuento desactivados por defecto en todos los roles.');

        console.log('--- Migración v212 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v212:', error);
        process.exit(1);
    }
}

runMigration();
