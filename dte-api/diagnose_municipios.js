const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  // 1. Show current CAT-013
  console.log('=== CAT-013 MUNICIPIOS ===');
  const [muns] = await pool.query('SELECT dep_code, code, description FROM cat_013_municipio ORDER BY dep_code, CAST(code AS UNSIGNED)');
  for (const m of muns) {
    console.log(`  dep ${m.dep_code} - ${m.code}: ${m.description}`);
  }

  // 2. Find customers with dep_code + mun_code not in cat_013
  console.log('\n=== CUSTOMERS WITH INVALID MUNICIPIO ===');
  const [badCust] = await pool.query(`
    SELECT c.id, c.nombre, c.departamento, c.municipio, c.distrito
    FROM customers c
    LEFT JOIN cat_013_municipio m ON m.dep_code = c.departamento AND m.code = c.municipio
    WHERE c.departamento IS NOT NULL AND c.departamento != ''
      AND c.municipio IS NOT NULL AND c.municipio != ''
      AND m.code IS NULL
    ORDER BY c.departamento, c.municipio
    LIMIT 50
  `);
  for (const c of badCust) {
    console.log(`  Cust #${c.id}: ${c.nombre} — dep=${c.departamento}, mun=${c.municipio}, dist=${c.distrito}`);
  }
  console.log(`  Total: ${badCust.length} customers with invalid mun`);

  // 3. Find branches with invalid mun
  console.log('\n=== BRANCHES WITH INVALID MUNICIPIO ===');
  const [badBr] = await pool.query(`
    SELECT b.id, b.nombre, b.departamento, b.municipio, b.distrito
    FROM branches b
    LEFT JOIN cat_013_municipio m ON m.dep_code = b.departamento AND m.code = b.municipio
    WHERE b.departamento IS NOT NULL AND b.departamento != ''
      AND b.municipio IS NOT NULL AND b.municipio != ''
      AND m.code IS NULL
  `);
  for (const b of badBr) {
    console.log(`  Branch #${b.id}: ${b.nombre} — dep=${b.departamento}, mun=${b.municipio}, dist=${b.distrito}`);
  }
  console.log(`  Total: ${badBr.length} branches with invalid mun`);

  // 4. Find companies with invalid mun
  console.log('\n=== COMPANIES WITH INVALID MUNICIPIO ===');
  const [badComp] = await pool.query(`
    SELECT c.id, c.nombre_comercial, c.departamento, c.municipio, c.distrito
    FROM companies c
    LEFT JOIN cat_013_municipio m ON m.dep_code = c.departamento AND m.code = c.municipio
    WHERE c.departamento IS NOT NULL AND c.departamento != ''
      AND c.municipio IS NOT NULL AND c.municipio != ''
      AND m.code IS NULL
  `);
  for (const c of badComp) {
    console.log(`  Company #${c.id}: ${c.nombre_comercial} — dep=${c.departamento}, mun=${c.municipio}, dist=${c.distrito}`);
  }
  console.log(`  Total: ${badComp.length} companies with invalid mun`);

  await pool.end();
})();
