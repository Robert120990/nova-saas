const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const MENU = [
  {
    label: 'Control de Pozo',
    icon: 'Droplets',
    parent: null,
    order: 115,
    children: [
      { label: 'Servicios', path: '/pozo/servicios', icon: 'Wrench', permission: 'manage_pozo_servicios', order: 1 },
      { label: 'Despachos', path: '/pozo/despachos', icon: 'Truck', permission: 'manage_pozo_despachos', order: 2 },
      { label: 'Corte', path: '/pozo/corte', icon: 'Calculator', permission: 'manage_pozo_corte', order: 3 },
    ],
  },
];

const ALL_PERMISSIONS = MENU.flatMap(m => m.children.map(c => c.permission));

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [existingRoot] = await pool.query("SELECT id FROM menu_items WHERE label = 'Control de Pozo' LIMIT 1");
    if (existingRoot.length > 0) {
      console.log('Control de Pozo menu already exists, skipping.');
    } else {
      const [rootResult] = await pool.query(
        `INSERT INTO menu_items (label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
         VALUES (?, NULL, ?, NULL, ?, 1, 0)`,
        ['Control de Pozo', MENU[0].icon, MENU[0].order]
      );
      const rootId = rootResult.insertId;

      for (const child of MENU[0].children) {
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

      let changed = false;
      for (const perm of ALL_PERMISSIONS) {
        if (!perms.includes(perm)) {
          perms.push(perm);
          changed = true;
        }
      }

      if (changed) {
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
