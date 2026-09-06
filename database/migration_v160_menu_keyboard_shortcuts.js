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
    console.log('Running migration v160 - adding "Atajos y Trucos" under "Seguridad" menu...');

    // Find parent menu item for 'Seguridad'
    const [[parent]] = await pool.query(`
      SELECT id FROM menu_items 
      WHERE label = 'Seguridad' AND parent_id IS NULL
      LIMIT 1
    `);

    if (!parent) {
      console.error('ERROR: No se encontró el item padre "Seguridad".');
      process.exit(1);
    }

    const parentId = parent.id;

    // Check if the menu item already exists
    const [existing] = await pool.query(
      'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
      ['/seguridad/atajos']
    );

    if (existing.length > 0) {
      console.log('  → El item ya existe, actualizando configuracion...');
      await pool.query(
        `UPDATE menu_items 
         SET parent_id = ?, label = ?, icon = ?, permission_key = NULL, is_active = TRUE, hide_in_menu = FALSE
         WHERE id = ?`,
        [parentId, 'Atajos y Trucos', 'Keyboard', existing[0].id]
      );
      console.log('  → Item actualizado correctamente (sin permisos requeridos).');
    } else {
      const [maxOrder] = await pool.query(
        'SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?',
        [parentId]
      );
      const nextOrder = (maxOrder[0]?.max_o || 0) + 1;

      await pool.query(
        `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
         VALUES (?, ?, ?, ?, NULL, ?, TRUE, FALSE)`,
        [parentId, 'Atajos y Trucos', '/seguridad/atajos', 'Keyboard', nextOrder]
      );
      console.log(`  → Item insertado bajo "Seguridad" con sort_order=${nextOrder} y permission_key=NULL`);
    }

    console.log('Migration v160 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
