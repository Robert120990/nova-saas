const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  const [depts] = await pool.query("SELECT * FROM cat_012_departamento ORDER BY code");
  console.log('CAT-012:', JSON.stringify(depts, null, 2));

  const [munis] = await pool.query("SELECT * FROM cat_013_municipio WHERE dep_code = '07' ORDER BY code");
  console.log('CAT-013 for dep 07:', JSON.stringify(munis, null, 2));

  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
