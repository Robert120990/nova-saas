const pool = require('../src/config/db');

async function test() {
  const [menu] = await pool.query(`
    SELECT id, parent_id, label, path, icon, permission_key, sort_order
    FROM menu_items 
    WHERE label LIKE '%Contabiliz%' OR path LIKE '%contabiliz%' OR parent_id = 21
    ORDER BY parent_id, sort_order
  `);
  console.log('Menu items for Contabilizar:');
  console.table(menu);
}

test().then(() => process.exit());
