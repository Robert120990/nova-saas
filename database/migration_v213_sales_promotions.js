const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Migration v213: Creación de tablas de Promociones y menú ---');

        // 1. Crear tabla sales_promotions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales_promotions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                name VARCHAR(150) NOT NULL,
                description TEXT NULL,
                promotion_type ENUM('nxm', 'second_unit_discount', 'bundle_fixed_price', 'volume_tier') NOT NULL,
                buy_quantity DECIMAL(10,2) NOT NULL DEFAULT 2,
                pay_quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
                discount_percentage DECIMAL(5,2) NULL DEFAULT NULL,
                bundle_price DECIMAL(10,2) NULL DEFAULT NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                days_of_week VARCHAR(30) NULL DEFAULT '1,2,3,4,5,6,7',
                start_time TIME NULL,
                end_time TIME NULL,
                max_applications_per_sale INT NULL DEFAULT NULL,
                is_cumulative BOOLEAN DEFAULT FALSE,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_sp_company_active (company_id, active),
                INDEX idx_sp_dates (start_date, end_date),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  ✓ Tabla sales_promotions creada o ya existe.');

        // 2. Crear tabla sales_promotion_products
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales_promotion_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                promotion_id INT NOT NULL,
                product_id INT NOT NULL,
                FOREIGN KEY (promotion_id) REFERENCES sales_promotions(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                UNIQUE KEY uk_promo_product (promotion_id, product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  ✓ Tabla sales_promotion_products creada o ya existe.');

        // 3. Encontrar el contenedor "Descuentos y Promociones" en menu_items
        const [descRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Descuentos y Promociones' LIMIT 1"
        );

        let parentId = null;
        if (descRows.length > 0) {
            parentId = descRows[0].id;
        } else {
            // Si no existe, buscar Ventas
            const [ventas] = await pool.query(
                "SELECT id FROM menu_items WHERE label = 'Ventas' AND parent_id IS NULL LIMIT 1"
            );
            if (ventas.length > 0) {
                const [ins] = await pool.query(
                    `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                     VALUES (?, 'Descuentos y Promociones', NULL, 'BadgePercent', NULL, 4, 1, 0)`,
                    [ventas[0].id]
                );
                parentId = ins.insertId;
            }
        }

        // 4. Insertar o actualizar opción Promociones en menu_items
        const [existingItem] = await pool.query(
            "SELECT id FROM menu_items WHERE path = '/ventas/promociones' OR permission_key = 'manage_sales_promotions' LIMIT 1"
        );

        if (existingItem.length > 0) {
            await pool.query(
                `UPDATE menu_items 
                 SET label = 'Promociones', 
                     path = '/ventas/promociones', 
                     icon = 'Sparkles', 
                     permission_key = 'manage_sales_promotions', 
                     parent_id = ?, 
                     sort_order = 4, 
                     is_active = 1, 
                     hide_in_menu = 0 
                 WHERE id = ?`,
                [parentId, existingItem[0].id]
            );
            console.log(`  ✓ Opción 'Promociones' actualizada en menu_items (id=${existingItem[0].id})`);
        } else {
            const [insPromo] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Promociones', '/ventas/promociones', 'Sparkles', 'manage_sales_promotions', 4, 1, 0)`,
                [parentId]
            );
            console.log(`  ✓ Opción 'Promociones' insertada en menu_items (id=${insPromo.insertId})`);
        }

        // 5. Asignar permiso manage_sales_promotions a roles
        const [roles] = await pool.query("SELECT id, name, permissions FROM roles");
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = [];
            try {
                perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
            } catch (e) {
                perms = [];
            }

            const isAdmin = ['superadmin', 'admin', 'administrador'].includes(String(role.name || '').toLowerCase());
            const hasDiscounts = perms.includes('manage_product_discounts') || perms.includes('manage_customer_discounts');

            if ((isAdmin || hasDiscounts) && !perms.includes('manage_sales_promotions')) {
                perms.push('manage_sales_promotions');
                await pool.query("UPDATE roles SET permissions = ? WHERE id = ?", [JSON.stringify(perms), role.id]);
                updatedRoles++;
            }
        }
        console.log(`  ✓ Permiso 'manage_sales_promotions' asignado a ${updatedRoles} roles.`);

        console.log('--- Migración v213 finalizada con éxito ---');
    } catch (err) {
        console.error('Error en migración v213:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
