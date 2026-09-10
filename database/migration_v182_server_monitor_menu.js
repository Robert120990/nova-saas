const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('Running migration v182 - Replace Visor de Logs with Monitor del Servidor...');

    // 1. Update menu_items: replace 'Visor de Logs' with 'Monitor del Servidor'
    const [result] = await pool.query(
        `UPDATE menu_items 
         SET label = 'Monitor del Servidor',
             path = '/configuracion/servidor',
             icon = 'Activity',
             permission_key = 'view_server_metrics'
         WHERE path = '/configuracion/logs' OR label = 'Visor de Logs'`
    );
    console.log(`  → Updated menu_items: ${result.affectedRows} row(s) updated to 'Monitor del Servidor'`);

    // 2. Add 'view_server_metrics' to all roles that have 'view_logs' or 'SuperAdmin'
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let rolesUpdated = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { continue; }
        }
        if (!Array.isArray(perms)) continue;

        const shouldHaveAccess = perms.includes('view_logs') || role.name === 'SuperAdmin' || role.name === 'Administrador' || role.name === 'Admin';

        if (shouldHaveAccess && !perms.includes('view_server_metrics')) {
            perms.push('view_server_metrics');
            await pool.query(
                'UPDATE roles SET permissions = ? WHERE id = ?',
                [JSON.stringify(perms), role.id]
            );
            rolesUpdated++;
            console.log(`  → Role '${role.name}' (id=${role.id}) granted 'view_server_metrics'`);
        }
    }

    console.log(`  → Total roles updated: ${rolesUpdated}`);
    console.log('Migration v182 completed successfully.');
}

module.exports = runMigration;
