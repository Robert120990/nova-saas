const pool = require('../server/src/config/db');

async function migrate(dbPool = pool) {
    console.log('[Migration v254] Moviendo Sistema Energético del menú a Dashboard con permisos asignables...');

    // 1. Verificar si existe el ítem en menu_items
    const [existing] = await dbPool.query(`
        SELECT id, parent_id, label, path, permission_key 
        FROM menu_items 
        WHERE path = '/sistema-energetico' 
           OR permission_key = 'manage_energy_system' 
           OR permission_key = 'view_dashboard_energy'
    `);

    if (existing.length > 0) {
        await dbPool.query(`
            UPDATE menu_items
            SET parent_id = 1,
                label = 'Dashboard Sistema Energético',
                path = '/dashboard',
                icon = 'Zap',
                permission_key = 'view_dashboard_energy',
                is_active = 1,
                hide_in_menu = 1,
                sort_order = 6
            WHERE id = ?
        `, [existing[0].id]);
        console.log(`[Migration v254] Ítem de menú ID ${existing[0].id} actualizado a hijo de Dashboard (hide_in_menu=1, permission_key=view_dashboard_energy).`);
    } else {
        await dbPool.query(`
            INSERT INTO menu_items (parent_id, label, path, icon, permission_key, is_active, hide_in_menu, sort_order)
            VALUES (1, 'Dashboard Sistema Energético', '/dashboard', 'Zap', 'view_dashboard_energy', 1, 1, 6)
        `);
        console.log('[Migration v254] Ítem Dashboard Sistema Energético insertado como hijo de Dashboard.');
    }

    // 2. Asignar el nuevo permiso 'view_dashboard_energy' a los roles correspondientes
    const permKey = 'view_dashboard_energy';
    const [roles] = await dbPool.query('SELECT id, name, permissions FROM roles');
    
    for (const role of roles) {
        let perms = [];
        try {
            perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
        } catch {
            perms = [];
        }

        const shouldHave = role.name === 'SuperAdmin' || 
            role.name === 'Admin' || 
            perms.includes('manage_energy_system') || 
            perms.includes('view_dashboard');

        let updated = false;
        if (shouldHave && !perms.includes(permKey)) {
            perms.push(permKey);
            updated = true;
        }

        if (updated) {
            await dbPool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            console.log(`[Migration v254] Permiso '${permKey}' asignado al rol '${role.name}'.`);
        }
    }

    console.log('[Migration v254] Migración completada con éxito.');
}

module.exports = { migrate };
