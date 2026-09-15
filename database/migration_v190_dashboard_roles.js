const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const DASHBOARD_MENU_ITEMS = [
    {
        label: 'Dashboard General',
        path: '/dashboard',
        permission_key: 'view_dashboard_general',
        icon: 'BarChart2',
        sort_order: 1
    },
    {
        label: 'Dashboard Pista / Combustibles',
        path: '/dashboard',
        permission_key: 'view_dashboard_pista',
        icon: 'Fuel',
        sort_order: 2
    },
    {
        label: 'Dashboard Tienda / Supermarket',
        path: '/dashboard',
        permission_key: 'view_dashboard_tienda',
        icon: 'Store',
        sort_order: 3
    },
    {
        label: 'Dashboard Planta Andelsa',
        path: '/dashboard',
        permission_key: 'view_dashboard_andelsa',
        icon: 'Factory',
        sort_order: 4
    },
    {
        label: 'Dashboard Salud del Servidor',
        path: '/dashboard',
        permission_key: 'view_dashboard_server',
        icon: 'Server',
        sort_order: 5
    }
];

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Running Migration v190: Role-based Dashboards & Permissions ---');

        // 1. Add default_dashboard column to roles if not exists
        console.log('1. Checking default_dashboard column on roles table...');
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'roles' 
              AND COLUMN_NAME = 'default_dashboard'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE roles 
                ADD COLUMN default_dashboard VARCHAR(30) NOT NULL DEFAULT 'general'
            `);
            console.log('  ✓ Column default_dashboard added to roles table.');
        } else {
            console.log('  - Column default_dashboard already exists on roles table.');
        }

        // 2. Find dashboard root menu item
        const [dashRoot] = await pool.query(
            `SELECT id FROM menu_items WHERE path = '/dashboard' AND parent_id IS NULL LIMIT 1`
        );
        const parentId = dashRoot.length > 0 ? dashRoot[0].id : 1;

        // 3. Register or update the 5 dashboard menu items
        console.log('2. Registering dashboard items in menu_items...');
        for (const item of DASHBOARD_MENU_ITEMS) {
            const [existing] = await pool.query(
                `SELECT id FROM menu_items WHERE permission_key = ?`,
                [item.permission_key]
            );

            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
                    [parentId, item.label, item.path, item.icon, item.permission_key, item.sort_order]
                );
                console.log(`  ✓ Inserted menu item: ${item.label} (${item.permission_key})`);
            } else {
                await pool.query(
                    `UPDATE menu_items 
                     SET parent_id = ?, label = ?, path = ?, icon = ?, sort_order = ?, is_active = 1, hide_in_menu = 1
                     WHERE permission_key = ?`,
                    [parentId, item.label, item.path, item.icon, item.sort_order, item.permission_key]
                );
                console.log(`  ✓ Updated menu item: ${item.label} (${item.permission_key})`);
            }
        }

        // 4. Update roles with default_dashboard and permissions
        console.log('3. Updating roles permissions and default_dashboard...');
        const [roles] = await pool.query('SELECT id, name, permissions, default_dashboard FROM roles');
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { perms = []; }
                if (typeof perms === 'string') {
                    try { perms = JSON.parse(perms); } catch (e) {}
                }
            }
            if (!Array.isArray(perms)) perms = [];

            const permsSet = new Set(perms);
            const roleName = (role.name || '').toLowerCase();
            let newDefaultDashboard = role.default_dashboard || 'general';

            const isAdminRole = roleName.includes('superadmin') || roleName === 'admin' || roleName === 'administrador' || roleName.includes('gerencia');

            if (isAdminRole) {
                // Admin roles have access to all 5 dashboards
                permsSet.add('view_dashboard_general');
                permsSet.add('view_dashboard_pista');
                permsSet.add('view_dashboard_tienda');
                permsSet.add('view_dashboard_andelsa');
                permsSet.add('view_dashboard_server');
                permsSet.add('view_dashboard');
                if (!role.default_dashboard) newDefaultDashboard = 'general';
            } else if (roleName.includes('pista') || roleName.includes('gasolin')) {
                permsSet.add('view_dashboard_pista');
                permsSet.add('view_dashboard');
                newDefaultDashboard = 'pista';
            } else if (roleName.includes('tienda') || roleName.includes('caja')) {
                permsSet.add('view_dashboard_tienda');
                permsSet.add('view_dashboard');
                newDefaultDashboard = 'tienda';
            } else if (roleName.includes('operacion') || roleName.includes('bodega') || roleName.includes('planta') || roleName.includes('industrial')) {
                permsSet.add('view_dashboard_andelsa');
                permsSet.add('view_dashboard');
                newDefaultDashboard = 'andelsa';
            } else if (roleName.includes('sistemas') || roleName.includes('tecnic') || roleName.includes('soporte') || permsSet.has('view_server_metrics')) {
                permsSet.add('view_dashboard_server');
                permsSet.add('view_dashboard');
                newDefaultDashboard = 'server';
            }

            // Always grant view_dashboard_general if the role already had view_dashboard
            if (permsSet.has('view_dashboard') && !permsSet.has('view_dashboard_general')) {
                permsSet.add('view_dashboard_general');
            }

            const newPerms = Array.from(permsSet);
            await pool.query(
                `UPDATE roles SET permissions = ?, default_dashboard = ? WHERE id = ?`,
                [JSON.stringify(newPerms), newDefaultDashboard, role.id]
            );
            console.log(`  ✓ Rol "${role.name}" (id=${role.id}) -> default_dashboard: ${newDefaultDashboard}, perms: ${newPerms.length}`);
            updatedRoles++;
        }

        console.log(`\n--- Migration v190 Completed Successfully (${updatedRoles} roles updated) ---`);
    } catch (error) {
        console.error('Migration v190 failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
