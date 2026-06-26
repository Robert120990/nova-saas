const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  // Get valid codes per dep
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

  // Check all real customers (not fictitious)
  console.log('=== CUSTOMERS WITH INVALID MUNICIPIO/DISTRITO ===');
  const [custs] = await pool.query(`
    SELECT id, nombre, departamento, municipio, distrito
    FROM customers
    WHERE departamento IS NOT NULL AND departamento != ''
      AND departamento != '00'
      AND municipio IS NOT NULL AND municipio != ''
      AND LENGTH(municipio) <= 2 AND municipio REGEXP '^[0-9]+$'
    ORDER BY departamento, CAST(municipio AS UNSIGNED)
  `);

  for (const c of custs) {
    const munValid = validMunMap[c.departamento]?.has(c.municipio);
    const distValid = c.distrito ? validDistMap[c.departamento]?.has(c.distrito) : true;
    if (!munValid || !distValid) {
      console.log(`  Cust #${c.id}: "${c.nombre}" dep=${c.departamento} mun=${c.municipio}${!munValid ? ' (INVALID MUN)' : ''} dist=${c.distrito}${!distValid ? ' (INVALID DIST)' : ''}`);
    }
  }

  console.log('\n=== BRANCHES WITH INVALID MUNICIPIO/DISTRITO ===');
  const [brs] = await pool.query(`
    SELECT id, nombre, departamento, municipio, distrito
    FROM branches
    WHERE departamento IS NOT NULL AND departamento != ''
      AND municipio IS NOT NULL AND municipio != ''
    ORDER BY departamento, CAST(municipio AS UNSIGNED)
  `);
  for (const b of brs) {
    const munValid = validMunMap[b.departamento]?.has(b.municipio);
    const distValid = b.distrito ? validDistMap[b.departamento]?.has(b.distrito) : true;
    if (!munValid || !distValid) {
      console.log(`  Branch #${b.id}: "${b.nombre}" dep=${b.departamento} mun=${b.municipio}${!munValid ? ' (INVALID MUN)' : ''} dist=${b.distrito}${!distValid ? ' (INVALID DIST)' : ''}`);
    }
  }

  console.log('\n=== COMPANIES WITH INVALID MUNICIPIO/DISTRITO ===');
  const [comps] = await pool.query(`
    SELECT id, nombre_comercial, razon_social, departamento, municipio, distrito
    FROM companies
    WHERE departamento IS NOT NULL AND departamento != ''
      AND municipio IS NOT NULL AND municipio != ''
    ORDER BY id
  `);
  for (const c of comps) {
    const munValid = validMunMap[c.departamento]?.has(c.municipio);
    const distValid = c.distrito ? validDistMap[c.departamento]?.has(c.distrito) : true;
    if (!munValid || !distValid) {
      console.log(`  Company #${c.id}: "${c.nombre_comercial || c.razon_social}" dep=${c.departamento} mun=${c.municipio}${!munValid ? ' (INVALID MUN)' : ''} dist=${c.distrito}${!distValid ? ' (INVALID DIST)' : ''}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Customers checked: ${custs.length}`);
  console.log(`Branches checked: ${brs.length}`);
  console.log(`Companies checked: ${comps.length}`);

  await pool.end();
})();
