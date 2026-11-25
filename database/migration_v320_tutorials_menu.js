const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v320: Creating Centro de Tutoriales menu_items entry & view_tutorials permission ---');

    const [existing] = await pool.query(
        "SELECT id FROM menu_items WHERE permission_key = 'view_tutorials' OR path = '/tutoriales' LIMIT 1"
    );

    if (existing.length === 0) {
        const [ins] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
             VALUES ('Centro de Tutoriales', '/tutoriales', 'GraduationCap', 'view_tutorials', NULL, 155, 1, 0)`
        );
        console.log(`✅ Menú 'Centro de Tutoriales' creado con ID: ${ins.insertId}`);
    } else {
        await pool.query(
            `UPDATE menu_items
             SET label = 'Centro de Tutoriales',
                 path = '/tutoriales',
                 icon = 'GraduationCap',
                 permission_key = 'view_tutorials',
                 parent_id = NULL,
                 sort_order = 155,
                 is_active = 1,
                 hide_in_menu = 0
             WHERE id = ?`,
            [existing[0].id]
        );
        console.log(`ℹ️ Menú 'Centro de Tutoriales' actualizado con ID: ${existing[0].id}`);
    }

    // Heredar view_tutorials a todos los roles activos para que cada usuario acceda a los tutoriales filtrados de su rol
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedRoles = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { continue; }
        }
        if (!Array.isArray(perms)) continue;

        if (!perms.includes('view_tutorials')) {
            perms.push('view_tutorials');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            updatedRoles++;
        }
    }
    console.log(`✅ Roles actualizados con view_tutorials: ${updatedRoles}`);
}

module.exports = migrate;
