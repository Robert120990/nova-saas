const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v288] Creando tablas para el sistema de Tareas Agénticas en segundo plano...');

    // 1. Tabla de tareas agénticas
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            branch_id INT NULL,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            prompt TEXT NOT NULL,
            priority ENUM('alta', 'media', 'baja') NOT NULL DEFAULT 'media',
            status ENUM('pendiente', 'analizando', 'en_proceso', 'completada', 'fallida', 'cancelada') NOT NULL DEFAULT 'pendiente',
            assigned_agent_code VARCHAR(50) NULL,
            progress INT NOT NULL DEFAULT 0,
            current_step VARCHAR(255) NULL,
            result LONGTEXT NULL,
            error_message TEXT NULL,
            notify_telegram TINYINT(1) NOT NULL DEFAULT 1,
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tasks_company (company_id),
            KEY idx_tasks_status_prio (status, priority, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Tabla ai_agent_tasks creada/verificada.');

    // 2. Tabla de bitácora y logs de pasos en tiempo real
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_task_logs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            agent_code VARCHAR(50) NOT NULL,
            log_type ENUM('info', 'thinking', 'tool_call', 'tool_result', 'delegation', 'warning', 'error') NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            metadata JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_task_logs (task_id, created_at),
            CONSTRAINT fk_agent_task_logs FOREIGN KEY (task_id) REFERENCES ai_agent_tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Tabla ai_agent_task_logs creada/verificada.');

    // 3. Asegurar visibilidad del menú padre 'Inteligencia Artificial' (id: 125)
    await pool.query(`UPDATE menu_items SET hide_in_menu = 0 WHERE id = 125`);

    // 4. Crear ítem de menú bajo "Inteligencia Artificial" (id: 125)
    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE path = '/ai-tasks' OR permission_key = 'manage_ai_tasks'"
    );

    let menuId;
    if (existingMenu.length === 0) {
        const [insertResult] = await pool.query(`
            INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order)
            VALUES ('Tareas Agénticas', '/ai-tasks', 'Bot', 'manage_ai_tasks', 125, 2)
        `);
        menuId = insertResult.insertId;
        console.log(`  → Menú 'Tareas Agénticas' creado con ID: ${menuId}`);
    } else {
        menuId = existingMenu[0].id;
        await pool.query(`
            UPDATE menu_items 
            SET label = 'Tareas Agénticas', path = '/ai-tasks', icon = 'Bot', parent_id = 125, sort_order = 2
            WHERE id = ?
        `, [menuId]);
        console.log(`  → Menú 'Tareas Agénticas' actualizado con ID: ${menuId}`);
    }

    // 4. Asignar el nuevo permiso a los roles correspondientes
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let rolesUpdated = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { continue; }
        }
        if (!Array.isArray(perms)) continue;

        const isSuperOrAdmin = role.name === 'SuperAdmin' || 
                               role.name === 'Administrador' || 
                               role.name === 'Admin' ||
                               perms.includes('ai_assistant_access') ||
                               perms.includes('all');

        if (isSuperOrAdmin && !perms.includes('manage_ai_tasks')) {
            perms.push('manage_ai_tasks');
            await pool.query(
                'UPDATE roles SET permissions = ? WHERE id = ?',
                [JSON.stringify(perms), role.id]
            );
            rolesUpdated++;
            console.log(`  → Rol '${role.name}' (id=${role.id}) actualizado con permiso 'manage_ai_tasks'`);
        }
    }

    console.log(`  → Total roles actualizados: ${rolesUpdated}`);
    console.log('[Migration v288] Completada exitosamente.');
}

module.exports = { up };
