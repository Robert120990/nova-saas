require('dotenv').config();
const mysql = require('mysql2/promise');
const mapping = require('./data/cat008_muni_mapping.js');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    let total = 0;
    for (const row of mapping) {
      const placeholders = row.codes.map(() => '?').join(',');
      const sql = `UPDATE cat_008_distrito SET muni_code = ? WHERE dep_code = ? AND code IN (${placeholders})`;
      const [res] = await pool.query(sql, [row.muni, row.dep, ...row.codes]);
      total += res.affectedRows;
      console.log(`dep ${row.dep} -> muni ${row.muni}: ${res.affectedRows} filas`);
    }
    console.log(`\nTOTAL actualizadas: ${total}`);

    const [vacios] = await pool.query("SELECT dep_code, code, description FROM cat_008_distrito WHERE muni_code = '' OR muni_code IS NULL");
    console.log(`\nDistritos SIN muni_code: ${vacios.length}`);
    for (const v of vacios) console.log(`  dep ${v.dep_code} code ${v.code}: ${v.description}`);

    const [invalidos] = await pool.query(`
      SELECT d.dep_code, d.code, d.description, d.muni_code
      FROM cat_008_distrito d
      LEFT JOIN cat_013_municipio m ON m.dep_code = d.dep_code AND m.code = d.muni_code
      WHERE d.muni_code <> '' AND m.code IS NULL
    `);
    console.log(`\nDistritos con muni_code INVALIDO (no en cat_013): ${invalidos.length}`);
    for (const i of invalidos) console.log(`  dep ${i.dep_code} code ${i.code} (${i.description}) -> muni ${i.muni_code}`);

    const [conteo] = await pool.query(`
      SELECT dep_code, COUNT(*) total,
        SUM(CASE WHEN muni_code <> '' THEN 1 ELSE 0 END) con_muni
      FROM cat_008_distrito GROUP BY dep_code ORDER BY dep_code
    `);
    console.log('\nConteo por dep:');
    console.table(conteo);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
