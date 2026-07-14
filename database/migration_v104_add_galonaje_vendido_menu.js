const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_gas_galonaje_vendido_report';

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Adding menu item: Galonaje Vendido...');

    const [existing] = await pool.query("SELECT id FROM menu_items WHERE label = 'Galonaje Vendido' LIMIT 1");
    if (existing.length > 0) {
      console.log('  → Already exists, skipping');
      await pool.end();
      return;
    }

    const [gasolineraRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Gasolinera' AND parent_id IS NULL LIMIT 1");
    if (gasolineraRows.length === 0) {
      console.log('  → Gasolinera node not found, skipping');
      await pool.end();
      return;
    }
    const gasolineraId = gasolineraRows[0].id;

    const [parentRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1", [gasolineraId]);
    if (parentRows.length === 0) {
      console.log('  → Reportes (hijo de Gasolinera) not found, skipping');
      await pool.end();
      return;
    }
    const parentId = parentRows[0].id;

    const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [parentId]);
    const nextOrder = (maxOrder[0]?.max_o || 0) + 1;

    const result = await pool.query(
      `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [parentId, 'Galonaje Vendido', '/gas-station/galonaje-vendido', 'FileBarChart', PERMISSION_KEY, nextOrder]
    );
    console.log(`  → Inserted with id=${result[0]?.insertId}, sort_order=${nextOrder}`);

    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedCount = 0;

    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { continue; }
      }
      if (!Array.isArray(perms)) continue;

      if (!perms.includes(PERMISSION_KEY)) {
        perms.push(PERMISSION_KEY);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        console.log(`  → Role "${role.name}" (id=${role.id}): added ${PERMISSION_KEY}`);
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
