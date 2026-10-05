const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Running migration v250 - Registering "Estado de Cuenta Detallado" report in menu and permissions...');

    const permissionKey = 'view_cxc_detailed_statement_report';
    const reportPath = '/cxc/reportes/estado-cuenta-detallado';

    // 1. Check if menu item already exists
    const [existing] = await pool.query(
      'SELECT id FROM menu_items WHERE path = ? OR permission_key = ?',
      [reportPath, permissionKey]
    );

    if (existing.length === 0) {
      const [insertRes] = await pool.query(
        `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
         VALUES (30, 'Estado de Cuenta Detallado', ?, 'FileText', ?, 4, 1, 0)`,
        [reportPath, permissionKey]
      );
      console.log(`✓ Inserted menu_item id ${insertRes.insertId}: Estado de Cuenta Detallado`);
    } else {
      console.log(`✓ Menu item already exists with id: ${existing[0].id}`);
    }

    // 2. Add permission to roles: SuperAdmin, Admin, Gerencia, or any role with view_cxc_statement_report or view_customer_statement
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    for (const r of roles) {
      let perms = [];
      try {
        perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
      } catch (e) {
        perms = [];
      }

      const shouldHavePermission = 
        ['SuperAdmin', 'Admin', 'Gerencia'].includes(r.name) ||
        perms.includes('view_cxc_statement_report') ||
        perms.includes('view_customer_statement');

      if (shouldHavePermission && !perms.includes(permissionKey)) {
        perms.push(permissionKey);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), r.id]);
        console.log(`✓ Added ${permissionKey} to role: ${r.name}`);
      }
    }

    console.log('Migration v250 completed successfully.');
  } catch (error) {
    console.error('Migration v250 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
