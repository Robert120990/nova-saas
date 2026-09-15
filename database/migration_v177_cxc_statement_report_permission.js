const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('Running migration v177 - Differentiating CxC Statement Report permission...');

    // 1. Update menu_items for Reporte de Estado de Cuenta
    const [result] = await pool.query(
        `UPDATE menu_items 
         SET permission_key = 'view_cxc_statement_report' 
         WHERE path = '/cxc/reportes/estado-cuenta'`
    );
    console.log(`  → Updated menu_items: ${result.affectedRows} row(s) updated to 'view_cxc_statement_report'`);

    // 2. Add 'view_cxc_statement_report' to all roles that have 'view_customer_statement'
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let rolesUpdated = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { continue; }
        }
        if (!Array.isArray(perms)) continue;

        if (perms.includes('view_customer_statement') && !perms.includes('view_cxc_statement_report')) {
            perms.push('view_cxc_statement_report');
            await pool.query(
                'UPDATE roles SET permissions = ? WHERE id = ?',
                [JSON.stringify(perms), role.id]
            );
            rolesUpdated++;
            console.log(`  → Role '${role.name}' (id=${role.id}) granted 'view_cxc_statement_report'`);
        }
    }

    console.log(`  → Total roles updated: ${rolesUpdated}`);
    console.log('Migration v177 completed successfully.');
}

module.exports = runMigration;
