const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  await pool.query("UPDATE customers SET distrito = '01' WHERE id = 433");
  console.log('Customer 433 distrito set to 01');
  const [c] = await pool.query('SELECT id, departamento, municipio, distrito FROM customers WHERE id = 433');
  console.log('Customer #433:', c[0]);
  await pool.end();
})();
