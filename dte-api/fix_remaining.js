const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  // 1. Customer #2: Oscar Orellana — dep=06, mun=21, dist=97 (invalid)
  // Set to first district of San Salvador
  await pool.query("UPDATE customers SET distrito = '01' WHERE id = 2");
  console.log('Fixed Cust #2: distrito → 01');

  // 2. Customer #3: Cliente Ficticio 1 — dep=09, mun=10, dist=15 (invalid, Cabañas only has 01-09)
  await pool.query("UPDATE customers SET distrito = '01' WHERE id = 3");
  console.log('Fixed Cust #3: distrito → 01');

  // 3. Company #8: mun=0614 → should be mun=14 (San Salvador Este)
  await pool.query("UPDATE companies SET municipio = '23', distrito = '01' WHERE id = 8");
  console.log('Fixed Company #8: mun 0614 → 23 (S.S. Centro), distrito → 01');

  // Now run full validation to confirm clean
  console.log('\n=== POST-FIX VALIDATION ===');
  const [validMuns] = await pool.query('SELECT dep_code, code FROM cat_013_municipio');
  const validMunMap = {};
  for (const m of validMuns) {
    if (!validMunMap[m.dep_code]) validMunMap[m.dep_code] = new Set();
    validMunMap[m.dep_code].add(m.code);
  }
  const [validDists] = await pool.query('SELECT dep_code, code FROM cat_008_distrito');
  const validDistMap = {};
  for (const d of validDists) {
    if (!validDistMap[d.dep_code]) validDistMap[d.dep_code] = new Set();
    validDistMap[d.dep_code].add(d.code);
  }

  // Also check customers with non-numeric municipio
  console.log('\n  Customers with non-numeric mun codes:');
  const [txtMuns] = await pool.query(`
    SELECT id, nombre, departamento, municipio, distrito FROM customers
    WHERE departamento IS NOT NULL AND departamento != ''
      AND municipio IS NOT NULL AND municipio != ''
      AND (LENGTH(municipio) > 2 OR municipio NOT REGEXP '^[0-9]+$')
    LIMIT 20
  `);
  for (const r of txtMuns) {
    console.log(`    Cust #${r.id}: "${r.nombre}" dep=${r.departamento} mun="${r.municipio}" dist=${r.distrito}`);
  }

  for (const table of ['customers', 'branches', 'companies']) {
    const [rows] = await pool.query(`
      SELECT id, departamento, municipio, distrito FROM ${table}
      WHERE departamento IS NOT NULL AND departamento != ''
        AND municipio IS NOT NULL AND municipio != ''
        AND LENGTH(municipio) <= 2 AND municipio REGEXP '^[0-9]+$'
    `);
    let bad = 0;
    for (const r of rows) {
      const munValid = validMunMap[r.departamento]?.has(r.municipio);
      const distValid = r.distrito ? validDistMap[r.departamento]?.has(r.distrito) : true;
      if (!munValid || !distValid) {
        bad++;
        console.log(`    ${table.substr(0,9)} #${r.id}: dep=${r.departamento} mun=${r.municipio}${!munValid ? ' BAD-MUN' : ''} dist=${r.distrito}${!distValid ? ' BAD-DIST' : ''}`);
      }
    }
    console.log(`  ${table}: ${bad} invalid records`);
  }

  // Fix customer #1068 (dep 00/Para extranjeros): distrito should be '00'
  await pool.query("UPDATE customers SET distrito = '00' WHERE id = 1068");
  console.log('Fixed Cust #1068: distrito 01 → 00 (foreign)');

  // Re-validate
  console.log('\n=== FINAL VALIDATION ===');
  let finalBad = 0;
  for (const table of ['customers', 'branches', 'companies']) {
    const [rows] = await pool.query(`
      SELECT id, departamento, municipio, distrito FROM ${table}
      WHERE departamento IS NOT NULL AND departamento != ''
        AND municipio IS NOT NULL AND municipio != ''
        AND LENGTH(municipio) <= 2 AND municipio REGEXP '^[0-9]+$'
    `);
    for (const r of rows) {
      const munValid = validMunMap[r.departamento]?.has(r.municipio);
      const distValid = r.distrito ? validDistMap[r.departamento]?.has(r.distrito) : true;
      if (!munValid || !distValid) {
        finalBad++;
        console.log(`  ${table.substr(0,9)} #${r.id}: dep=${r.departamento} mun=${r.municipio} dist=${r.distrito} ${!munValid ? 'BAD-MUN' : 'BAD-DIST'}`);
      }
    }
  }
  if (finalBad === 0) console.log('  ✓ All records valid!');

  await pool.end();
})();
