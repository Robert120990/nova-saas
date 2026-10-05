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
    console.log('Running migration v248 - Setting unique permission_key for "Atajos y Trucos"...');

    const permissionKey = 'view_keyboard_shortcuts';

    // 1. Update menu_items id 178
    const [result] = await pool.query(
      `UPDATE menu_items 
       SET permission_key = ? 
       WHERE id = 178 OR path = '/seguridad/atajos'`,
      [permissionKey]
    );
    console.log(`✓ Updated menu_items: ${result.affectedRows} rows affected.`);

    // 2. Add permission to administrative and operational roles
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    for (const r of roles) {
      let perms = [];
      try {
        perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
      } catch (e) {
        perms = [];
      }

      // Add to SuperAdmin and Admin automatically
      if (['SuperAdmin', 'Admin', 'Gerencia'].includes(r.name) && !perms.includes(permissionKey)) {
        perms.push(permissionKey);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), r.id]);
        console.log(`✓ Added ${permissionKey} to role: ${r.name}`);
      }
    }

    console.log('Migration v248 completed successfully.');
  } catch (error) {
    console.error('Migration v248 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
