const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  // Check DTE #74 (ACCEPTED version 2)
  const [full] = await pool.query('SELECT json_original FROM dtes WHERE id = 74');
  const json = typeof full[0].json_original === 'string' ? JSON.parse(full[0].json_original) : full[0].json_original;
  console.log(JSON.stringify({
    identificacion: json.identificacion,
    emisor: json.emisor,
    receptor: json.receptor,
    documentoRelacionado: json.documentoRelacionado,
    cuerpoDocumento: json.cuerpoDocumento ? json.cuerpoDocumento.length : 'N/A',
    resumen: json.resumen,
    extension: json.extension
  }, null, 2));
  await pool.end();
})();
