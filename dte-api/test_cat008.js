const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  // Customer 433: change to CUSCATLAN SUR (mun 18) with distrito 02 (Cojutepeque)
  // Check CAT-013 for Cuscatlan
  const [muns] = await pool.query("SELECT * FROM cat_013_municipio WHERE dep_code = '07' ORDER BY code");
  console.log('Cuscatlan municipios:');
  for (const m of muns) {
    console.log('  ' + m.code + ': ' + m.description);
  }
  
  // Customer 433: change to CUSCATLAN SUR (mun 18) with distrito 02 (Cojutepeque)
  await pool.query("UPDATE customers SET municipio = '18', distrito = '02' WHERE id = 433");
  const [c] = await pool.query('SELECT id, nombre, departamento, municipio, distrito FROM customers WHERE id = 433');
  console.log('Customer #433:', c[0]);
  await pool.query("UPDATE branches SET distrito = '13' WHERE id = 1");
  const [b] = await pool.query('SELECT id, nombre, departamento, municipio, distrito FROM branches WHERE id = 1');
  console.log('Branch #1:', b[0]);
  await pool.end();
})();
