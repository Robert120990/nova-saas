const pool = require('../src/config/db');

async function checkCols() {
  const [cCols] = await pool.query('DESCRIBE customers');
  console.log('customers columns in remote:', cCols.map(c => c.Field));

  const [pCols] = await pool.query('DESCRIBE providers');
  console.log('providers columns in remote:', pCols.map(p => p.Field));

  process.exit(0);
}

checkCols().catch(console.error);
