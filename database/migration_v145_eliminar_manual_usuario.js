const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_manual';

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Eliminando menu item: Manual de Usuario...');

    const [items] = await pool.query("SELECT id, parent_id, sort_order FROM menu_items WHERE label = 'Manual de Usuario' OR path = '/manual'");
    if (items.length === 0) {
      console.log('  → No existe, saltando');
    }

    for (const item of items) {
      await pool.query('DELETE FROM menu_items WHERE id = ?', [item.id]);
      console.log(`  → Eliminado menu_items id=${item.id}`);
      if (item.parent_id != null) {
        await pool.query(
          'UPDATE menu_items SET sort_order = sort_order - 1 WHERE parent_id = ? AND sort_order > ?',
          [item.parent_id, item.sort_order]
        );
      }
    }

    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let count = 0;
    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch (e) { continue; } }
      if (!Array.isArray(perms)) continue;
      if (perms.includes(PERMISSION_KEY)) {
        const filtered = perms.filter(p => p !== PERMISSION_KEY);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(filtered), role.id]);
        console.log(`  → Rol "${role.name}" (id=${role.id}): eliminado ${PERMISSION_KEY}`);
        count++;
      }
    }
    console.log(`\nMigración completa: ${count} roles actualizados`);
  } catch (error) {
    console.error('Migración falló:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
