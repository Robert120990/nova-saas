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
    console.log('Agregando menu item: Manual de Usuario...');

    const [existing] = await pool.query("SELECT id FROM menu_items WHERE label = 'Manual de Usuario' LIMIT 1");
    if (existing.length > 0) {
      console.log('  → Ya existe, saltando');
      await pool.end();
      return;
    }

    const [padre] = await pool.query("SELECT id FROM menu_items WHERE label = 'Seguridad' AND parent_id IS NULL LIMIT 1");
    if (padre.length === 0) {
      console.log('  → Nodo Seguridad no encontrado, saltando');
      await pool.end();
      return;
    }
    const padreId = padre[0].id;

    const [notif] = await pool.query("SELECT sort_order FROM menu_items WHERE label = 'Bandeja de Notificaciones' AND parent_id = ? LIMIT 1", [padreId]);
    const baseOrder = notif.length > 0 ? notif[0].sort_order : 10;

    await pool.query("UPDATE menu_items SET sort_order = sort_order + 1 WHERE parent_id = ? AND sort_order > ?", [padreId, baseOrder]);
    const nextOrder = baseOrder + 1;

    await pool.query(
      `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [padreId, 'Manual de Usuario', '/manual', 'BookOpen', PERMISSION_KEY, nextOrder]
    );
    console.log(`  → Insertado con sort_order=${nextOrder}`);

    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let count = 0;
    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch (e) { continue; } }
      if (!Array.isArray(perms)) continue;
      if (!perms.includes(PERMISSION_KEY)) {
        perms.push(PERMISSION_KEY);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        console.log(`  → Rol "${role.name}" (id=${role.id}): añadido ${PERMISSION_KEY}`);
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
