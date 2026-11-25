const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v319: Creating egg_batch_modification_logs table & manage_egg_closed_batch_edit permission ---');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_batch_modification_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            batch_id INT NOT NULL,
            batch_code_display VARCHAR(100) NULL,
            batch_status_at_edit VARCHAR(50) NULL,
            was_closed TINYINT(1) NOT NULL DEFAULT 0,
            action_type VARCHAR(60) NOT NULL DEFAULT 'closed_batch_edit',
            reason TEXT NOT NULL,
            edited_by_user_id INT NULL,
            edited_by_name VARCHAR(150) NOT NULL,
            edited_by_role VARCHAR(100) NULL,
            changes_json JSON NOT NULL,
            impacts_json JSON NOT NULL,
            before_snapshot_json JSON NULL,
            after_snapshot_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_batch_mod_logs_company_batch (company_id, batch_id, created_at),
            INDEX idx_batch_mod_logs_created (company_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla egg_batch_modification_logs verificada/creada.');

    const [parentRows] = await pool.query(
        "SELECT id FROM menu_items WHERE parent_id IS NULL AND (label LIKE '%Huevo%' OR label LIKE '%Industrial%') ORDER BY id ASC LIMIT 1"
    );
    const parentId = parentRows[0]?.id || 67;

    const [existingMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE permission_key = 'manage_egg_closed_batch_edit'"
    );

    if (existingMenu.length === 0) {
        const [ins] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
             VALUES ('Editar Lotes Cerrados y Reutilizables', NULL, 'ShieldCheck', 'manage_egg_closed_batch_edit', ?, 98, 1, 1)`,
            [parentId]
        );
        console.log(`✅ Permiso 'Editar Lotes Cerrados y Reutilizables' creado en menu_items con ID: ${ins.insertId}`);
    } else {
        await pool.query(
            `UPDATE menu_items
             SET label = 'Editar Lotes Cerrados y Reutilizables',
                 path = NULL,
                 icon = 'ShieldCheck',
                 parent_id = ?,
                 is_active = 1,
                 hide_in_menu = 1
             WHERE id = ?`,
            [parentId, existingMenu[0].id]
        );
        console.log(`ℹ️ Permiso 'Editar Lotes Cerrados y Reutilizables' actualizado con ID: ${existingMenu[0].id}`);
    }

    // Heredar únicamente a roles administrativos (SuperAdmin / Admin); otros niveles deben habilitarse manualmente
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedRoles = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { continue; }
        }
        if (!Array.isArray(perms)) continue;

        const roleLower = (role.name || '').trim().toLowerCase();
        const isAdminRole =
            role.name === 'SuperAdmin' ||
            roleLower === 'admin' ||
            roleLower === 'administrador';

        if (isAdminRole && !perms.includes('manage_egg_closed_batch_edit')) {
            perms.push('manage_egg_closed_batch_edit');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedRoles++;
        }
    }
    console.log(`✅ Roles administrativos actualizados con manage_egg_closed_batch_edit: ${updatedRoles}`);
}

module.exports = migrate;
