const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v268: Módulo de Restaurante, Comandas y KDS ---');

        // 1. restaurant_config
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                enable_tips BOOLEAN NOT NULL DEFAULT 1,
                default_tip_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
                tip_is_optional BOOLEAN NOT NULL DEFAULT 1,
                kds_warning_minutes INT NOT NULL DEFAULT 10,
                kds_danger_minutes INT NOT NULL DEFAULT 18,
                auto_print_comanda BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_rest_config_comp_branch (company_id, branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_config verificada/creada');

        // 2. restaurant_areas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                name VARCHAR(100) NOT NULL,
                order_index INT NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_areas_comp (company_id, branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_areas verificada/creada');

        // 3. restaurant_tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                area_id INT NULL,
                table_number VARCHAR(50) NOT NULL,
                capacity INT NOT NULL DEFAULT 4,
                status ENUM('disponible', 'ocupada', 'cuenta_pedida', 'reservada') NOT NULL DEFAULT 'disponible',
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_tables_area (area_id),
                INDEX idx_rest_tables_comp (company_id, branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_tables verificada/creada');

        // 4. restaurant_stations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_stations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                name VARCHAR(100) NOT NULL,
                printer_ip_or_name VARCHAR(150) NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_stations_comp (company_id, branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_stations verificada/creada');

        // 5. restaurant_modifier_groups
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_modifier_groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                is_required BOOLEAN NOT NULL DEFAULT 0,
                min_options INT NOT NULL DEFAULT 0,
                max_options INT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_mod_groups_comp (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_modifier_groups verificada/creada');

        // 6. restaurant_modifiers
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_modifiers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                extra_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_mods_group (group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_modifiers verificada/creada');

        // 7. restaurant_orders
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                table_id INT NULL,
                order_type ENUM('mesa', 'para_llevar', 'delivery') NOT NULL DEFAULT 'mesa',
                customer_name VARCHAR(150) NULL,
                customer_phone VARCHAR(50) NULL,
                delivery_address TEXT NULL,
                waiter_id INT NULL,
                status ENUM('abierta', 'en_cocina', 'lista', 'facturada', 'cancelada') NOT NULL DEFAULT 'abierta',
                guest_count INT NOT NULL DEFAULT 1,
                subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                tip_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
                tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_with_tip DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                notes TEXT NULL,
                opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME NULL,
                INDEX idx_rest_orders_comp_status (company_id, branch_id, status),
                INDEX idx_rest_orders_table (table_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_orders verificada/creada');

        // 8. restaurant_order_items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                station_id INT NULL,
                quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
                unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                course ENUM('bebida', 'entrada', 'fuerte', 'postre') NOT NULL DEFAULT 'fuerte',
                course_status ENUM('en_espera', 'marchado') NOT NULL DEFAULT 'marchado',
                seat_number INT NOT NULL DEFAULT 1,
                status ENUM('pendiente', 'en_preparacion', 'listo', 'servido', 'cancelado') NOT NULL DEFAULT 'pendiente',
                notes TEXT NULL,
                selected_modifiers JSON NULL,
                cancellation_reason TEXT NULL,
                cancelled_by INT NULL,
                sent_at DATETIME NULL,
                prepared_at DATETIME NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rest_items_order (order_id),
                INDEX idx_rest_items_station (station_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_order_items verificada/creada');

        // 9. restaurant_unavailable_products (Plato 86)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurant_unavailable_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                product_id INT NOT NULL,
                marked_by INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_rest_unavail (company_id, branch_id, product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla restaurant_unavailable_products verificada/creada');

        // 10. Datos semilla iniciales si no existen
        const [companies] = await pool.query("SELECT id FROM companies LIMIT 5");
        for (const comp of companies) {
            // Config inicial
            await pool.query(`
                INSERT INTO restaurant_config (company_id, enable_tips, default_tip_percentage, tip_is_optional, kds_warning_minutes, kds_danger_minutes)
                VALUES (?, 1, 10.00, 1, 10, 18)
                ON DUPLICATE KEY UPDATE enable_tips = VALUES(enable_tips);
            `, [comp.id]);

            // Estaciones iniciales
            const [existingStations] = await pool.query("SELECT id FROM restaurant_stations WHERE company_id = ? LIMIT 1", [comp.id]);
            if (existingStations.length === 0) {
                await pool.query(`
                    INSERT INTO restaurant_stations (company_id, name) VALUES
                    (?, 'Cocina Caliente'),
                    (?, 'Bar / Bebidas'),
                    (?, 'Parrilla'),
                    (?, 'Postres')
                `, [comp.id, comp.id, comp.id, comp.id]);
            }

            // Áreas iniciales
            const [existingAreas] = await pool.query("SELECT id FROM restaurant_areas WHERE company_id = ? LIMIT 1", [comp.id]);
            if (existingAreas.length === 0) {
                const [salonRes] = await pool.query("INSERT INTO restaurant_areas (company_id, name, order_index) VALUES (?, 'Salón Principal', 1)", [comp.id]);
                const [terrazaRes] = await pool.query("INSERT INTO restaurant_areas (company_id, name, order_index) VALUES (?, 'Terraza', 2)", [comp.id]);

                // Mesas iniciales
                await pool.query(`
                    INSERT INTO restaurant_tables (company_id, area_id, table_number, capacity, status) VALUES
                    (?, ?, 'Mesa 1', 4, 'disponible'),
                    (?, ?, 'Mesa 2', 4, 'disponible'),
                    (?, ?, 'Mesa 3', 6, 'disponible'),
                    (?, ?, 'Mesa 4', 2, 'disponible'),
                    (?, ?, 'Mesa 5', 4, 'disponible'),
                    (?, ?, 'Terraza 1', 4, 'disponible'),
                    (?, ?, 'Terraza 2', 6, 'disponible')
                `, [comp.id, salonRes.insertId, comp.id, salonRes.insertId, comp.id, salonRes.insertId, comp.id, salonRes.insertId, comp.id, salonRes.insertId, comp.id, terrazaRes.insertId, comp.id, terrazaRes.insertId]);
            }

            // Modificadores iniciales
            const [existingModGroups] = await pool.query("SELECT id FROM restaurant_modifier_groups WHERE company_id = ? LIMIT 1", [comp.id]);
            if (existingModGroups.length === 0) {
                const [terminoGroup] = await pool.query("INSERT INTO restaurant_modifier_groups (company_id, name, is_required, min_options, max_options) VALUES (?, 'Término de Carne', 0, 0, 1)", [comp.id]);
                await pool.query(`
                    INSERT INTO restaurant_modifiers (group_id, name, extra_price) VALUES
                    (?, 'Término Medio', 0.00),
                    (?, 'Tres Cuartos', 0.00),
                    (?, 'Bien Cocido', 0.00)
                `, [terminoGroup.insertId, terminoGroup.insertId, terminoGroup.insertId]);

                const [extrasGroup] = await pool.query("INSERT INTO restaurant_modifier_groups (company_id, name, is_required, min_options, max_options) VALUES (?, 'Adicionales y Extras', 0, 0, 5)", [comp.id]);
                await pool.query(`
                    INSERT INTO restaurant_modifiers (group_id, name, extra_price) VALUES
                    (?, 'Extra Queso', 0.75),
                    (?, 'Extra Tocino', 1.00),
                    (?, 'Sin Cebolla', 0.00),
                    (?, 'Salsa Aparte', 0.00)
                `, [extrasGroup.insertId, extrasGroup.insertId, extrasGroup.insertId, extrasGroup.insertId]);
            }
        }
        console.log('✓ Semillas iniciales registradas');

        console.log('--- Migración v268 completada con éxito ---');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v268:', error);
        process.exit(1);
    }
}

migrate();
