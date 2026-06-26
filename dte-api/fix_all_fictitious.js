const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });
  
  // Count fictitious customers
  const [cnt] = await pool.query("SELECT COUNT(*) as c FROM customers WHERE nombre LIKE '%Ficticio%'");
  console.log('Ficticious customers:', cnt[0].c);

  // Fix them all to San Salvador Centro defaults
  const [fix] = await pool.query(`
    UPDATE customers 
    SET departamento = '06', municipio = '23', distrito = '01'
    WHERE (nombre LIKE '%Ficticio%' OR (municipio = 'San Salvad' AND departamento = '06'))
  `);
  console.log('Fixed ficticious customers:', fix.affectedRows);

  // Final full validation
  console.log('\n=== FINAL VALIDATION ===');
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
        console.log(`  ${table} #${r.id}: dep=${r.departamento} mun=${r.municipio} dist=${r.distrito} ${!munValid ? 'BAD-MUN' : 'BAD-DIST'}`);
      }
    }
    console.log(`  ${table}: ${bad} invalid of ${rows.length} checked`);
  }
  console.log('\n✓ Done');
  await pool.end();
})();
