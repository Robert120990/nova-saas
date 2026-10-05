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
    console.log('Running migration v249 - Adding multi-tenant indexes to inventory_movements...');

    // Check existing indexes
    const [existingIndexes] = await pool.query('SHOW INDEX FROM inventory_movements');
    const indexNames = new Set(existingIndexes.map(i => i.Key_name));

    // 1. Index on (company_id, branch_id, created_at)
    if (!indexNames.has('idx_mov_comp_branch_date')) {
      console.log('  → Creating index idx_mov_comp_branch_date (company_id, branch_id, created_at)...');
      await pool.query('ALTER TABLE inventory_movements ADD INDEX idx_mov_comp_branch_date (company_id, branch_id, created_at)');
      console.log('  ✓ Index idx_mov_comp_branch_date created.');
    } else {
      console.log('  → Index idx_mov_comp_branch_date already exists.');
    }

    // 2. Index on (company_id, product_id)
    if (!indexNames.has('idx_mov_comp_prod')) {
      console.log('  → Creating index idx_mov_comp_prod (company_id, product_id)...');
      await pool.query('ALTER TABLE inventory_movements ADD INDEX idx_mov_comp_prod (company_id, product_id)');
      console.log('  ✓ Index idx_mov_comp_prod created.');
    } else {
      console.log('  → Index idx_mov_comp_prod already exists.');
    }

    console.log('Migration v249 completed successfully.');
  } catch (error) {
    console.error('Migration v249 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
