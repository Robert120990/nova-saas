const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  
  // Check what catalog tables exist
  const [tables] = await pool.query("SHOW TABLES LIKE '%cat_%'");
  console.log('Catalog tables:', tables.map(r => Object.values(r)[0]));

  // Check CAT-013 municipio table if exists
  const [tables2] = await pool.query("SHOW TABLES LIKE '%municipio%'");
  console.log('Municipio tables:', tables2.map(r => Object.values(r)[0]));

  // Check the 262-district table structure
  const [desc] = await pool.query("DESCRIBE cat_008_distrito");
  console.log('cat_008_distrito columns:', desc.map(r => r.Field));

  // Check what the current CAT-012 departamento table looks like
  const [tables3] = await pool.query("SHOW TABLES LIKE '%departamento%'");
  console.log('Departamento tables:', tables3.map(r => Object.values(r)[0]));

  // Check cat_012
  const [tables4] = await pool.query("SHOW TABLES LIKE '%cat_012%'");
  console.log('CAT-012 tables:', tables4.map(r => Object.values(r)[0]));

  // Check cat_013
  const [tables5] = await pool.query("SHOW TABLES LIKE '%cat_013%'");
  console.log('CAT-013 tables:', tables5.map(r => Object.values(r)[0]));

  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
