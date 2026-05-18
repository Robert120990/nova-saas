const mysql = require('C:/Users/Roberto/Desktop/web/nova-saas/server/node_modules/mysql2/promise');

(async () => {
  const remote = mysql.createPool({ host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sytem_rrs_conta' });
  const nova = mysql.createPool({ host: 'localhost', user: 'sysadmin', password: 'QwErTy123', database: 'db_sistema_saas', port: 3306 });

  const COMPANY_ID = 1;

  // 1. Get remote accounts
  const [rows] = await remote.query("SELECT * FROM catalogo_cuentas WHERE id_empresa = 'E-5' AND ejercicio = '2026' ORDER BY CAST(nivel_cta AS UNSIGNED), cod_cta");
  console.log('Total accounts to import:', rows.length);

  // 2. Get nova account types
  const [novaTypes] = await nova.query('SELECT id, code FROM account_types WHERE company_id = ?', [COMPANY_ID]);
  console.log('Nova types:', novaTypes.map(t => t.code + '=' + t.id));

  // 3. Skip delete - just insert or update based on code
  const [existing] = await nova.query('SELECT COUNT(*) as c FROM chart_of_accounts WHERE company_id = ?', [COMPANY_ID]);
  console.log('Existing accounts:', existing[0].c, '(will update duplicates by code)');

  // 4. Import: INSERT ON DUPLICATE KEY UPDATE (by unique code per company)
  const codeToId = {};
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const r of rows) {
    const typeId = novaTypes.find(t => parseInt(t.code) === parseInt(r.cod_tp_cta))?.id;
    if (!typeId) { skipped++; continue; }

    const parentId = r.dep_cta ? codeToId[r.dep_cta] : null;

    const [ins] = await nova.query(
      `INSERT INTO chart_of_accounts (company_id, account_type_id, parent_id, code, name, allows_entries, active) 
       VALUES (?, ?, ?, ?, ?, ?, 1) 
       ON DUPLICATE KEY UPDATE account_type_id = VALUES(account_type_id), parent_id = VALUES(parent_id), name = VALUES(name), allows_entries = VALUES(allows_entries), active = 1`,
      [COMPANY_ID, typeId, parentId || null, r.cod_cta, r.nom_cta, r.g_d_m === 'D' ? 1 : 0]
    );
    
    if (ins.insertId) {
      codeToId[r.cod_cta] = ins.insertId;
      imported++;
    } else {
      const [ex] = await nova.query('SELECT id FROM chart_of_accounts WHERE company_id = ? AND code = ?', [COMPANY_ID, r.cod_cta]);
      if (ex.length > 0) {
        codeToId[r.cod_cta] = ex[0].id;
        updated++;
      } else {
        // Should not happen but track it
        skipped++;
      }
    }
  }

  console.log('\nImported (new):', imported);
  console.log('Updated:', updated);
  console.log('Skipped:', skipped);
  console.log('Total code map:', Object.keys(codeToId).length);

  await remote.end();
  await nova.end();
  process.exit(0);
})();
