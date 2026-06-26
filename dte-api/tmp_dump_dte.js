const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  const [rows] = await pool.query(
    "SELECT id, codigo_generacion, tipo_dte, json_original FROM dtes WHERE codigo_generacion = '4D727DC4-5DB7-48FB-9B7C-920C8BCF9C57'"
  );
  if (rows.length > 0) {
    const json = typeof rows[0].json_original === 'string' ? JSON.parse(rows[0].json_original) : rows[0].json_original;
    console.log(JSON.stringify(json, null, 2));
  }
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
