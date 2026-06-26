const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  const [dtes] = await pool.query('SELECT id, venta_id, tipo_dte, status FROM dtes ORDER BY id DESC LIMIT 5');
  for (const d of dtes) {
    const [full] = await pool.query('SELECT json_original FROM dtes WHERE id = ?', [d.id]);
    const json = typeof full[0].json_original === 'string' ? JSON.parse(full[0].json_original) : full[0].json_original;
    console.log('DTE #' + d.id + ' (v' + d.venta_id + '):', json.identificacion?.version, d.status);
    console.log('  receptor direccion:', JSON.stringify(json.receptor?.direccion));
    console.log('  ambiente:', json.identificacion?.ambiente);
  }
  await pool.end();
})();
