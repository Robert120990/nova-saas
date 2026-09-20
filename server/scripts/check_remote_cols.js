const mysql = require('../node_modules/mysql2/promise');

async function checkCols() {
  const destConn = await mysql.createConnection({
    host: '5.252.55.29',
    user: 'sysadmin',
    password: 'QwErTy?123',
    database: 'db_sistema_saas'
  });

  const [cCols] = await destConn.query('DESCRIBE customers');
  console.log('customers columns in remote:', cCols.map(c => c.Field));

  const [pCols] = await destConn.query('DESCRIBE providers');
  console.log('providers columns in remote:', pCols.map(p => p.Field));

  await destConn.end();
}

checkCols().catch(console.error);
