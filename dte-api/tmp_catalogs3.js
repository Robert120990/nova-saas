const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas' });

  // Check all CAT-013 (new v1.1 format)
  const [munis] = await pool.query("SELECT * FROM cat_013_municipio ORDER BY dep_code, code");
  console.log('All CAT-013 (new v1.1):');
  for (const m of munis) {
    console.log(`  dep=${m.dep_code} code=${m.code} desc="${m.description}"`);
  }

  // Check all distrito codes for dep 07
  const [dists] = await pool.query("SELECT * FROM cat_008_distrito WHERE dep_code = '07' ORDER BY code");
  console.log('\nCAT-008 for dep 07:', JSON.stringify(dists, null, 2));

  // Check ALL distritos (maybe they've been restructured too)
  const [allDists] = await pool.query("SELECT dep_code, code, description FROM cat_008_distrito ORDER BY dep_code, code");
  console.log('\nTotal distritos:', allDists.length);
  console.log('By department:');
  const depCounts = {};
  for (const d of allDists) {
    depCounts[d.dep_code] = (depCounts[d.dep_code] || 0) + 1;
  }
  for (const [dep, count] of Object.entries(depCounts)) {
    console.log(`  dep ${dep}: ${count} distritos`);
  }

  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
