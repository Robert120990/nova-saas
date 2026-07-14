const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_MAP = {
  'manage_purchase_checks': 'manage_purchase_quedan',
  'view_gas_readings_history': 'view_gas_closeout_detail',
  'view_gas_fuel_sales_report': 'view_gas_fuel_inventory_report',
};

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Fixing duplicate permission keys...');

    // 1. Update menu_items table
    console.log('Updating menu_items...');
    const quedan = await pool.query("SELECT id FROM menu_items WHERE label = 'Quedan' LIMIT 1");
    if (quedan[0].length > 0) {
      await pool.query('UPDATE menu_items SET permission_key = ? WHERE id = ?', ['manage_purchase_quedan', quedan[0][0].id]);
      console.log(`  → Quedan: manage_purchase_quedan`);
    }

    const detalle = await pool.query("SELECT id FROM menu_items WHERE label = 'Detalle del Cierre' LIMIT 1");
    if (detalle[0].length > 0) {
      await pool.query('UPDATE menu_items SET permission_key = ? WHERE id = ?', ['view_gas_closeout_detail', detalle[0][0].id]);
      console.log(`  → Detalle del Cierre: view_gas_closeout_detail`);
    }

    const inventario = await pool.query("SELECT id FROM menu_items WHERE label = 'Inventario Combustible' LIMIT 1");
    if (inventario[0].length > 0) {
      await pool.query('UPDATE menu_items SET permission_key = ? WHERE id = ?', ['view_gas_fuel_inventory_report', inventario[0][0].id]);
      console.log(`  → Inventario Combustible: view_gas_fuel_inventory_report`);
    }

    // 2. Update roles - add new permissions
    console.log('Updating roles...');
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let updatedCount = 0;

    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { continue; }
      }
      if (!Array.isArray(perms)) continue;

      const origLen = perms.length;

      // For each old permission, add the new one if the old one exists
      for (const [oldPerm, newPerm] of Object.entries(PERMISSION_MAP)) {
        if (perms.includes(oldPerm) && !perms.includes(newPerm)) {
          perms.push(newPerm);
        }
      }

      if (perms.length !== origLen) {
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        console.log(`  Role "${role.name}" (id=${role.id}): ${origLen} → ${perms.length} permissions`);
        updatedCount++;
      }
    }

    console.log(`\nMigration complete: ${updatedCount} roles updated`);

    // 3. Invalidate menu cache hint (just informational)
    console.log('Done. The sidebar and roles page will reflect changes on next load.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
