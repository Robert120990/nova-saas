const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  const [dtes] = await pool.query(`
    SELECT id, venta_id, tipo_dte, status 
    FROM dtes 
    WHERE tipo_dte = '03' AND status = 'ACCEPTED' 
    ORDER BY id DESC
  `);
  console.log('Accepted CCFs:', JSON.stringify(dtes));
  
  for (const d of dtes) {
    const [full] = await pool.query('SELECT json_original FROM dtes WHERE id = ?', [d.id]);
    const json = typeof full[0].json_original === 'string' ? JSON.parse(full[0].json_original) : full[0].json_original;
    console.log(`DTE #${d.id}: version=${json.identificacion?.version}, ambiente=${json.identificacion?.ambiente}, distrito=${json.receptor?.direccion?.distrito || 'N/A'}`);
  }
  await pool.end();
})();
