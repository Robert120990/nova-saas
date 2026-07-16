const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    decimalNumbers: true
  });

  // Check orphan readings
  const [orphanReadings] = await pool.query(
    'SELECT r.id, r.closeout_id, r.product_id, r.codigo_producto FROM gas_station_closeout_readings r LEFT JOIN products p ON r.product_id = p.id WHERE p.id IS NULL'
  );
  console.log('Lecturas con product_id huerfano:', orphanReadings.length);
  if (orphanReadings.length > 0) console.log(JSON.stringify(orphanReadings, null, 2));

  // Check closeout 39
  const [closeout] = await pool.query('SELECT id, estado, fecha_turno, numero_turno FROM gas_station_closeouts WHERE id = 39');
  console.log('\nCierre 39:', JSON.stringify(closeout[0]));

  // Readings with JOIN
  const [readings] = await pool.query(
    'SELECT COUNT(*) as cnt FROM gas_station_closeout_readings r JOIN products p ON r.product_id = p.id WHERE r.closeout_id = ?',
    [39]
  );
  console.log('Readings con JOIN:', readings[0].cnt);

  // Readings without JOIN
  const [readingsOriginal] = await pool.query(
    'SELECT COUNT(*) as cnt FROM gas_station_closeout_readings WHERE closeout_id = ?',
    [39]
  );
  console.log('Readings sin JOIN:', readingsOriginal[0].cnt);

  // Remesas for closeout 39
  const [remesas] = await pool.query('SELECT COUNT(*) as cnt FROM gas_station_closeout_remesas WHERE closeout_id = ?', [39]);
  console.log('Remesas en DB para cierre 39:', remesas[0].cnt);

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
