const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_sales_detail_report';

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Running migration v135 - adding "Detalle de Facturación" menu item...');

    const [[parent]] = await pool.query(`
      SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = (
        SELECT id FROM menu_items WHERE label = 'Ventas' AND parent_id IS NULL
      )
    `);

    if (!parent) {
      console.error('ERROR: No se encontró el item padre "Reportes" bajo "Ventas". Ejecute primero migration_v102_menu_items.js');
      process.exit(1);
    }

    const parentId = parent.id;

    const [existing] = await pool.query(
      'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
      ['/ventas/reportes/detalle-facturacion']
    );

    if (existing.length > 0) {
      console.log('  → El item ya existe, saltando inserción.');
    } else {
      const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [parentId]);
      const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
      await pool.query(
        `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [parentId, 'Detalle de Facturación', '/ventas/reportes/detalle-facturacion', 'FileText', PERMISSION_KEY, nextOrder]
      );
      console.log(`  → Item insertado con sort_order=${nextOrder}`);
    }

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

    console.log(`Migration v135 completed: ${updatedCount} roles updated`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
