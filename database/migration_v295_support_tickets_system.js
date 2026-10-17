const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v295] Creando tablas y permisos para el Sistema de Tickets de Soporte...');

    // 1. Tabla principal support_tickets
    await pool.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_code VARCHAR(30) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            branch_id INT NULL,
            user_id INT NOT NULL,
            user_name VARCHAR(150) NOT NULL,
            user_role VARCHAR(80) NULL,
            type ENUM('problema', 'requerimiento', 'mejora', 'consulta') NOT NULL DEFAULT 'problema',
            priority ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
            status ENUM('abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado') NOT NULL DEFAULT 'abierto',
            subject VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            page_url VARCHAR(255) NULL,
            module_name VARCHAR(150) NULL,
            screenshot_url VARCHAR(500) NULL,
            browser_info VARCHAR(255) NULL,
            assigned_to INT NULL,
            assigned_name VARCHAR(150) NULL,
            resolution_notes TEXT NULL,
            resolved_version VARCHAR(60) NULL,
            resolved_by_name VARCHAR(150) NULL,
            resolved_at DATETIME NULL,
            creator_notified_at DATETIME NULL,
            telegram_notified TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tickets_company_status (company_id, status),
            KEY idx_tickets_user_resolved (user_id, status, creator_notified_at),
            KEY idx_tickets_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Tabla support_tickets creada/verificada.');

    // 2. Tabla de mensajes / bitácora del ticket
    await pool.query(`
        CREATE TABLE IF NOT EXISTS support_ticket_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            sender_type ENUM('user', 'tech', 'telegram', 'system') NOT NULL DEFAULT 'user',
            sender_id INT NULL,
            sender_name VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            attachment_url VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ticket_msgs (ticket_id, created_at),
            CONSTRAINT fk_support_ticket_messages FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Tabla support_ticket_messages creada/verificada.');

    // 3. Columnas en telegram_chat_bindings y telegram_settings
    const [bindingCols] = await pool.query('SHOW COLUMNS FROM telegram_chat_bindings');
    const bindingColNames = bindingCols.map(c => c.Field);
    if (!bindingColNames.includes('receive_support_tickets')) {
        await pool.query(`
            ALTER TABLE telegram_chat_bindings
            ADD COLUMN receive_support_tickets TINYINT(1) NOT NULL DEFAULT 1 AFTER receive_dte_alerts
        `);
        console.log('  → Columna receive_support_tickets agregada a telegram_chat_bindings.');
    }

    const [settingCols] = await pool.query('SHOW COLUMNS FROM telegram_settings');
    const settingColNames = settingCols.map(c => c.Field);
    if (!settingColNames.includes('support_tickets_active')) {
        await pool.query(`
            ALTER TABLE telegram_settings
            ADD COLUMN support_tickets_active TINYINT(1) NOT NULL DEFAULT 1 AFTER reopen_requests_active
        `);
        console.log('  → Columna support_tickets_active agregada a telegram_settings.');
    }

    // 4. Registrar ítem de menú "Soporte y Tickets" bajo Seguridad (id=114)
    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE path = '/soporte/tickets' OR permission_key = 'view_support_tickets'"
    );

    const extraPerms = JSON.stringify(['manage_support_tickets']);
    if (existingMenu.length === 0) {
        const [ins] = await pool.query(`
            INSERT INTO menu_items (label, path, icon, permission_key, extra_permissions, parent_id, sort_order, is_active, hide_in_menu)
            VALUES ('Soporte y Tickets', '/soporte/tickets', 'Ticket', 'view_support_tickets', ?, 114, 8, 1, 0)
        `, [extraPerms]);
        console.log(`  → Menú 'Soporte y Tickets' creado con ID: ${ins.insertId}`);
    } else {
        await pool.query(`
            UPDATE menu_items
            SET label = 'Soporte y Tickets',
                path = '/soporte/tickets',
                icon = 'Ticket',
                permission_key = 'view_support_tickets',
                extra_permissions = ?,
                parent_id = 114,
                sort_order = 8,
                is_active = 1,
                hide_in_menu = 0
            WHERE id = ?
        `, [extraPerms, existingMenu[0].id]);
        console.log(`  → Menú 'Soporte y Tickets' actualizado con ID: ${existingMenu[0].id}`);
    }

    // 5. Asignar permisos por herencia a los roles existentes
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedCount = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { continue; }
        }
        if (!Array.isArray(perms)) continue;

        let changed = false;
        // Todos los roles pueden ver/crear sus propios tickets de soporte
        if (!perms.includes('view_support_tickets')) {
            perms.push('view_support_tickets');
            changed = true;
        }

        const roleLower = (role.name || '').toLowerCase();
        const isTechOrAdmin = role.name === 'SuperAdmin' ||
                              roleLower.includes('admin') ||
                              roleLower.includes('soporte') ||
                              roleLower.includes('sistemas') ||
                              roleLower.includes('tecnic') ||
                              roleLower.includes('técnic') ||
                              perms.includes('manage_system') ||
                              perms.includes('manage_users');

        if (isTechOrAdmin && !perms.includes('manage_support_tickets')) {
            perms.push('manage_support_tickets');
            changed = true;
        }

        if (changed) {
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedCount++;
        }
    }

    console.log(`  → Roles actualizados con permisos de tickets: ${updatedCount}`);
    console.log('[Migration v295] Migración completada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[Migration v295] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
