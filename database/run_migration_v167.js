const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    let pool;
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'db_sistema_saas',
            waitForConnections: true,
            connectionLimit: 5
        });

        console.log('--- Iniciando Migración v167: Acceso Definitivo a CRM y Calendario Industrial ---');

        // 1. Encontrar o crear el grupo raíz 'Huevo Industrial'
        const [industrialRows] = await pool.query(
            "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%' OR label LIKE '%Huevo%') ORDER BY id ASC LIMIT 1"
        );
        let industrialGroupId;
        if (industrialRows.length > 0) {
            industrialGroupId = industrialRows[0].id;
            console.log(`✓ Grupo raíz 'Huevo Industrial' encontrado con id=${industrialGroupId}.`);
            await pool.query("UPDATE menu_items SET permission_key = NULL, is_active = 1, hide_in_menu = 0 WHERE id = ?", [industrialGroupId]);
        } else {
            const [insRes] = await pool.query(
                "INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu) VALUES (NULL, 'Huevo Industrial', NULL, 'Sparkles', NULL, 30, 1, 0)"
            );
            industrialGroupId = insRes.insertId;
            console.log(`✓ Grupo raíz 'Huevo Industrial' creado con id=${industrialGroupId}.`);
        }

        // 2. Vincular y activar 'Calendario de Producción' (/industrial/calendario)
        const [calendarRows] = await pool.query("SELECT id FROM menu_items WHERE path = '/industrial/calendario' LIMIT 1");
        if (calendarRows.length > 0) {
            await pool.query(
                "UPDATE menu_items SET parent_id = ?, label = 'Calendario de Producción', icon = 'Calendar', permission_key = 'manage_production', is_active = 1, hide_in_menu = 0, sort_order = 4 WHERE id = ?",
                [industrialGroupId, calendarRows[0].id]
            );
            console.log(`✓ Menú 'Calendario de Producción' vinculado exitosamente al padre id=${industrialGroupId}.`);
        } else {
            await pool.query(
                "INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu) VALUES (?, 'Calendario de Producción', '/industrial/calendario', 'Calendar', 'manage_production', 4, 1, 0)",
                [industrialGroupId]
            );
            console.log(`✓ Menú 'Calendario de Producción' insertado bajo el padre id=${industrialGroupId}.`);
        }

        // 3. Encontrar o crear el grupo raíz 'CRM'
        const [crmRows] = await pool.query(
            "SELECT id FROM menu_items WHERE parent_id IS NULL AND label = 'CRM' LIMIT 1"
        );
        let crmGroupId;
        if (crmRows.length > 0) {
            crmGroupId = crmRows[0].id;
            console.log(`✓ Grupo raíz 'CRM' encontrado con id=${crmGroupId}.`);
            await pool.query("UPDATE menu_items SET permission_key = NULL, is_active = 1, hide_in_menu = 0 WHERE id = ?", [crmGroupId]);
        } else {
            const [insCrm] = await pool.query(
                "INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu) VALUES (NULL, 'CRM', NULL, 'Handshake', NULL, 32, 1, 0)"
            );
            crmGroupId = insCrm.insertId;
            console.log(`✓ Grupo raíz 'CRM' creado con id=${crmGroupId}.`);
        }

        // 4. Vincular y activar 'Acuerdos con Clientes' (/crm/acuerdos)
        const [crmAgrRows] = await pool.query("SELECT id FROM menu_items WHERE path = '/crm/acuerdos' LIMIT 1");
        if (crmAgrRows.length > 0) {
            await pool.query(
                "UPDATE menu_items SET parent_id = ?, label = 'Acuerdos con Clientes', icon = 'FileSignature', permission_key = 'manage_customer_agreements', is_active = 1, hide_in_menu = 0, sort_order = 1 WHERE id = ?",
                [crmGroupId, crmAgrRows[0].id]
            );
            console.log(`✓ Menú 'Acuerdos con Clientes' vinculado exitosamente al padre CRM id=${crmGroupId}.`);
        } else {
            await pool.query(
                "INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu) VALUES (?, 'Acuerdos con Clientes', '/crm/acuerdos', 'FileSignature', 'manage_customer_agreements', 1, 1, 0)",
                [crmGroupId]
            );
            console.log(`✓ Menú 'Acuerdos con Clientes' insertado bajo el padre CRM id=${crmGroupId}.`);
        }

        // 5. Asegurar módulos 'egg_industrial' y 'crm' en empresas ANDELSA
        const [andelsaCompanies] = await pool.query(
            "SELECT id, razon_social, enabled_modules FROM companies WHERE id = 9 OR razon_social LIKE '%ANDELSA%' OR nombre_comercial LIKE '%ANDELSA%'"
        );
        for (const comp of andelsaCompanies) {
            let mods = [];
            try {
                mods = typeof comp.enabled_modules === 'string' ? JSON.parse(comp.enabled_modules) : (comp.enabled_modules || []);
            } catch (e) {
                mods = [];
            }
            if (!Array.isArray(mods) || mods.length === 0) {
                mods = ['sales', 'purchases', 'inventory', 'egg_industrial', 'crm', 'accounting', 'human_resources'];
            } else {
                if (!mods.includes('egg_industrial')) mods.push('egg_industrial');
                if (!mods.includes('crm')) mods.push('crm');
            }
            await pool.query("UPDATE companies SET enabled_modules = ? WHERE id = ?", [JSON.stringify(mods), comp.id]);
            console.log(`✓ Módulos 'egg_industrial' y 'crm' habilitados para empresa ${comp.id} (${comp.razon_social}).`);
        }

        // 6. Asignar permisos a roles clave
        const targetPerms = ['view_crm', 'manage_customer_agreements', 'manage_production', 'view_industrial_dashboard'];
        const [roles] = await pool.query(
            "SELECT id, name, permissions FROM roles WHERE name IN ('SuperAdmin', 'Administrador', 'Admin', 'Gerencia', 'Supervisor', 'Operaciones', 'Ventas', 'Contador')"
        );
        for (const r of roles) {
            let perms = [];
            try {
                perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
                if (typeof perms === 'string') perms = JSON.parse(perms);
            } catch (e) {
                perms = [];
            }
            if (!Array.isArray(perms)) perms = [];

            let changed = false;
            for (const p of targetPerms) {
                if (!perms.includes(p)) {
                    perms.push(p);
                    changed = true;
                }
            }
            if (changed) {
                await pool.query("UPDATE roles SET permissions = ? WHERE id = ?", [JSON.stringify(perms), r.id]);
                console.log(`✓ Permisos de CRM y Producción agregados al rol: ${r.name}.`);
            }
        }

        // 7. Asegurar existencia de tablas de calendario si no existieran
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_scheduled_productions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                production_date DATE NOT NULL,
                start_time TIME NOT NULL DEFAULT '06:00:00',
                end_time TIME NOT NULL DEFAULT '14:00:00',
                lot_code VARCHAR(50) NOT NULL,
                product_profile VARCHAR(100) NOT NULL DEFAULT 'Huevo Entero Pasteurizado',
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                target_quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 12000.00,
                target_solids_pct DECIMAL(5,2) NOT NULL DEFAULT 23.50,
                status ENUM('programado', 'confirmado', 'en_proceso', 'completado', 'cancelado') NOT NULL DEFAULT 'programado',
                priority ENUM('baja', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
                mix_formula_json JSON NULL,
                batch_id INT NULL,
                assigned_operator_id INT NULL,
                assigned_operator_name VARCHAR(150) NULL,
                suggestion_source VARCHAR(50) NULL,
                notes TEXT NULL,
                created_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_esp_company_date (company_id, production_date),
                INDEX idx_esp_status (company_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_scheduled_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scheduled_production_id INT NOT NULL,
                company_id INT NOT NULL,
                user_id INT NULL,
                user_name VARCHAR(150) NOT NULL,
                factory_role VARCHAR(100) NOT NULL,
                task_description VARCHAR(255) NOT NULL,
                checklist_status ENUM('pendiente', 'en_progreso', 'completado', 'no_aplica') NOT NULL DEFAULT 'pendiente',
                completed_at DATETIME NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_est_scheduled (scheduled_production_id),
                INDEX idx_est_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_customer_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                order_number VARCHAR(50) NULL,
                product_type VARCHAR(100) NOT NULL DEFAULT 'Huevo Entero Pasteurizado',
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                required_delivery_date DATE NOT NULL,
                status ENUM('pendiente', 'programado', 'en_proceso', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
                price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_eco_comp_date (company_id, required_delivery_date),
                INDEX idx_eco_comp_status (company_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('--- Migración v167 completada exitosamente ---');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración v167:', err);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

runMigration();
