const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  const [rows] = await pool.query(
    "SELECT id, codigo_generacion, tipo_dte, json_original FROM dtes WHERE codigo_generacion = '4D727DC4-5DB7-48FB-9B7C-920C8BCF9C57'"
  );
  if (rows.length > 0) {
    console.log('DTE record:', rows[0].id, rows[0].codigo_generacion);
    const json = typeof rows[0].json_original === 'string' ? JSON.parse(rows[0].json_original) : rows[0].json_original;
    console.log(JSON.stringify({
      emisor: {
        nit: json.emisor?.nit,
        nombre: json.emisor?.nombre,
        direccion: json.emisor?.direccion
      },
      receptor: {
        nombre: json.receptor?.nombre,
        codActividad: json.receptor?.codActividad,
        direccion: json.receptor?.direccion
      }
    }, null, 2));
  } else {
    console.log('DTE not found');
  }
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
