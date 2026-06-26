const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  // Find customers with dep=07 but mun outside current v1.1 codes (17, 18)
  console.log('=== Cuscatlan (dep 07) customers with OLD mun codes ===');
  const [oldCust] = await pool.query(`
    SELECT id, nombre, departamento, municipio, distrito
    FROM customers
    WHERE departamento = '07'
      AND municipio IS NOT NULL AND municipio != ''
      AND municipio NOT IN ('17', '18')
    ORDER BY municipio
  `);
  for (const c of oldCust) {
    console.log(`  Cust #${c.id}: ${c.nombre} — mun=${c.municipio}, dist=${c.distrito}`);
  }
  console.log(`  Total: ${oldCust.length}`);

  // Same for all other departments - find customers with mun codes that look like
  // old format (2-digit or text) but don't match current v1.1 codes
  console.log('\n=== ALL customers with mun not in cat_013 (excluding fictitious) ===');
  // Get valid codes per dep
  const [validMuns] = await pool.query('SELECT dep_code, code FROM cat_013_municipio');
  const validMap = {};
  for (const m of validMuns) {
    if (!validMap[m.dep_code]) validMap[m.dep_code] = new Set();
    validMap[m.dep_code].add(m.code);
  }

  const [allCust] = await pool.query(`
    SELECT id, nombre, departamento, municipio, distrito
    FROM customers
    WHERE departamento IS NOT NULL AND departamento != ''
      AND departamento != '00'
      AND municipio IS NOT NULL AND municipio != ''
      AND LENGTH(municipio) <= 2
      AND municipio REGEXP '^[0-9]+$'
      AND id > 200
    ORDER BY departamento, municipio
  `);

  const bad = [];
  for (const c of allCust) {
    const validSet = validMap[c.departamento];
    if (validSet && !validSet.has(c.municipio)) {
      bad.push(c);
    }
  }
  for (const c of bad) {
    console.log(`  Cust #${c.id}: ${c.nombre} — dep=${c.departamento}, mun=${c.municipio}, dist=${c.distrito}`);
  }
  console.log(`  Total: ${bad.length} real customers with outdated codes`);

  await pool.end();
})();
