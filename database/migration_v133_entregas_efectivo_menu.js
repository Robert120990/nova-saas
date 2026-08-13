const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PARENT_LABEL = 'Control de Pozo';
const NEW_PERMISSION = 'manage_pozo_entregas_efectivo';
const CHILDREN = [
  { label: 'Entregas de Efectivo', path: '/pozo/entregas-efectivo', icon: 'Wallet', permission: NEW_PERMISSION, order: 4 },
];

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [roots] = await pool.query("SELECT id FROM menu_items WHERE label = ? AND parent_id IS NULL LIMIT 1", [PARENT_LABEL]);
    if (roots.length === 0) {
      console.log(`${PARENT_LABEL} menu not found, skipping. Run migration_v132_pozo_menu first.`);
    } else {
      const rootId = roots[0].id;
      for (const child of CHILDREN) {
        const [existing] = await pool.query(
          "SELECT id FROM menu_items WHERE parent_id = ? AND path = ? LIMIT 1",
          [rootId, child.path]
        );
        if (existing.length > 0) {
          console.log(`  → ${child.label} already exists, skipping.`);
          continue;
        }
        await pool.query(
          `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
          [rootId, child.label, child.path, child.icon, child.permission, child.order]
        );
        console.log(`  → Inserted ${child.label}`);
      }
    }

    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedCount = 0;

    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { continue; }
      }
      if (!Array.isArray(perms)) continue;

      if (!perms.includes(NEW_PERMISSION)) {
        perms.push(NEW_PERMISSION);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        updatedCount++;
      }
    }

    console.log(`\nMigration complete: ${updatedCount} roles updated`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
