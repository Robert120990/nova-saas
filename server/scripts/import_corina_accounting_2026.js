/**
 * Sipe Web SaaS - Migration Script
 * Imports Chart of Accounts (Catalogo de Cuentas) and Journal Entries (Partidas Contables)
 * for fiscal year 2026 from db_sipe_conta (E-1) into db_sistema_saas for
 * Corina Margarita Mendez de Sosa (Company ID 8).
 */

const pool = require('../src/config/db');

const COMPANY_ID = 8;
const CREATED_BY = 1; // Admin user

// Branch mapping
const BRANCH_MIRAFLORES = 4; // Puma Miraflores (Casa Matriz)
const BRANCH_COSTA_DEL_SOL = 8; // Puma Costa del Sol

function getAccountTypeId(cod_cta, cod_tp_cta) {
  const first = cod_cta.charAt(0);
  if (first === '1') return 1; // Activo
  if (first === '2') return 2; // Pasivo
  if (first === '3') return 3; // Patrimonio
  if (first === '4') return 4; // Ingreso (Acreedor)
  if (first === '5') {
    if (cod_cta.startsWith('5101') || cod_cta.startsWith('56')) return 5; // Costo
    return 6; // Gasto
  }
  if (first === '6') return 6; // Liquidadora / Cierre -> Gasto
  if (first === '7') return 1; // Orden Deudora -> Activo
  if (first === '8') return 2; // Orden Acreedora -> Pasivo

  // Fallback to cod_tp_cta
  if (cod_tp_cta === '01' || cod_tp_cta === '08') return 1;
  if (cod_tp_cta === '02' || cod_tp_cta === '09') return 2;
  if (cod_tp_cta === '03') return 3;
  if (cod_tp_cta === '05') return 4;
  if (cod_tp_cta === '04' || cod_tp_cta === '06' || cod_tp_cta === '07') return 6;
  return 1;
}

function getEntryTypeId(cod_tipo_partida) {
  switch (cod_tipo_partida) {
    case '00':
    case '06':
      return 4; // APERTURA
    case '01':
      return 3; // GASTO
    case '02':
      return 2; // INGRESO
    case '03':
      return 1; // DIARIO
    case '04':
      return 6; // AJUSTE
    case '05':
      return 5; // CIERRE
    default:
      return 1; // DIARIO
  }
}

function determineBranchId(concepto, lines) {
  const upperConcepto = String(concepto || '').toUpperCase();
  if (upperConcepto.includes('COSTA DEL SOL') || upperConcepto.includes('COSTA')) {
    return BRANCH_COSTA_DEL_SOL;
  }
  if (upperConcepto.includes('MIRAFLORES')) {
    return BRANCH_MIRAFLORES;
  }

  // Check lines
  for (const line of lines) {
    const lineText = `${line.nom_cta || ''} ${line.concepto || ''}`.toUpperCase();
    if (lineText.includes('COSTA DEL SOL') || lineText.includes('COSTA')) {
      return BRANCH_COSTA_DEL_SOL;
    }
    if (lineText.includes('MIRAFLORES')) {
      return BRANCH_MIRAFLORES;
    }
  }

  // Default to Casa Matriz (Puma Miraflores)
  return BRANCH_MIRAFLORES;
}

function formatEntryNumber(correlativo, dateStr) {
  const parts = String(dateStr).split('-');
  const yy = parts[0].slice(-2);
  const mm = parts[1];

  const clean = String(correlativo || '').trim();
  if (clean.length === 6 && clean.startsWith(mm)) {
    return `${yy}${clean}`;
  }
  if (/^\d+$/.test(clean)) {
    return `${yy}${mm}${clean.padStart(4, '0')}`;
  }
  return `${yy}${mm}${clean}`;
}

async function runMigration() {
  const startTime = Date.now();
  console.log('========================================================================');
  console.log('🚀 INICIO DE MIGRACIÓN CONTABLE 2026: CORINA MARGARITA MENDEZ DE SOSA');
  console.log('========================================================================\n');

  const conn = await pool.getConnection();

  try {
    // 0. Verify Company
    const [[comp]] = await conn.query('SELECT id, razon_social, nit, nrc FROM companies WHERE id = ?', [COMPANY_ID]);
    if (!comp) {
      throw new Error(`No se encontró la empresa con ID ${COMPANY_ID}`);
    }
    console.log(`✓ Empresa Confirmada: [ID ${comp.id}] ${comp.razon_social} (NIT: ${comp.nit}, NRC: ${comp.nrc})`);

    // Verify existing counts
    const [[existingAccs]] = await conn.query('SELECT COUNT(*) as cnt FROM chart_of_accounts WHERE company_id = ?', [COMPANY_ID]);
    const [[existingEntries]] = await conn.query('SELECT COUNT(*) as cnt FROM accounting_entries WHERE company_id = ?', [COMPANY_ID]);
    console.log(`✓ Estado Inicial: ${existingAccs.cnt} cuentas, ${existingEntries.cnt} partidas contables.\n`);

    if (existingAccs.cnt > 0 || existingEntries.cnt > 0) {
      console.warn('⚠ Advertencia: La empresa ya contiene registros contables.');
      console.warn('Para evitar duplicación, este script asume carga en limpio o se aborta.');
      throw new Error('La empresa ya tiene cuentas o partidas registradas. Limpie antes de continuar.');
    }

    await conn.beginTransaction();
    console.log('--- FASE 1: CARGA DE CATÁLOGO DE CUENTAS (EJERCICIO 2026) ---');

    // 1. Fetch source accounts
    const [sourceAccounts] = await conn.query(`
      SELECT cod_cta, nom_cta, dep_cta, nivel_cta, g_d_m, cod_tp_cta
      FROM db_sipe_conta.catalogo_cuentas
      WHERE id_empresa = 'E-1' AND ejercicio = 2026
      ORDER BY CAST(nivel_cta AS UNSIGNED) ASC, LENGTH(cod_cta) ASC, cod_cta ASC
    `);
    console.log(`✓ Cuentas leídas de db_sipe_conta.catalogo_cuentas: ${sourceAccounts.length}`);

    // Extra missing accounts used by 2026 entries
    const extraAccounts = [
      { cod_cta: '1109', nom_cta: 'IMPUESTOS POR RECUPERAR', dep_cta: '11', nivel_cta: '3', g_d_m: 'M', cod_tp_cta: '01' },
      { cod_cta: '110901', nom_cta: 'CREDITO FISCAL IVA', dep_cta: '1109', nivel_cta: '4', g_d_m: 'M', cod_tp_cta: '01' },
      { cod_cta: '11090101', nom_cta: 'Crédito Fiscal por Compras Locales', dep_cta: '110901', nivel_cta: '5', g_d_m: 'D', cod_tp_cta: '01' },
      { cod_cta: '11090103', nom_cta: 'CRÉDITO FISCAL POR RETENCIONES 1%', dep_cta: '110901', nivel_cta: '5', g_d_m: 'D', cod_tp_cta: '01' },
    ];

    const accountList = [...sourceAccounts];
    for (const extra of extraAccounts) {
      if (!accountList.some(a => a.cod_cta === extra.cod_cta)) {
        accountList.push(extra);
      }
    }

    // Sort to guarantee parents are inserted before children
    accountList.sort((a, b) => {
      const nA = Number(a.nivel_cta) || 1;
      const nB = Number(b.nivel_cta) || 1;
      if (nA !== nB) return nA - nB;
      if (a.cod_cta.length !== b.cod_cta.length) return a.cod_cta.length - b.cod_cta.length;
      return a.cod_cta.localeCompare(b.cod_cta);
    });

    // Check which accounts are used in entries to ensure allows_entries = 1
    const [usedAccountRows] = await conn.query(`
      SELECT DISTINCT d.cod_cta
      FROM db_sipe_conta.detalle_partidas d
      JOIN db_sipe_conta.cabecera_partidas c ON d.id_empresa = c.id_empresa AND d.cod_partida = c.cod_partida
      WHERE c.id_empresa = 'E-1' AND YEAR(c.fecha) = 2026
    `);
    const usedAccountsSet = new Set(usedAccountRows.map(r => r.cod_cta));
    console.log(`✓ Cuentas que registran movimientos en 2026: ${usedAccountsSet.size}`);

    const codeToIdMap = new Map();
    let accountsInserted = 0;

    for (const acc of accountList) {
      const typeId = getAccountTypeId(acc.cod_cta, acc.cod_tp_cta);
      const parentId = acc.dep_cta && acc.dep_cta !== '' ? (codeToIdMap.get(acc.dep_cta) || null) : null;
      const allowsEntries = (acc.g_d_m === 'D' || usedAccountsSet.has(acc.cod_cta)) ? 1 : 0;

      const [res] = await conn.query(`
        INSERT INTO chart_of_accounts (
          company_id, account_type_id, parent_id, code, name, description, allows_entries, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, 1, NOW(), NOW())
      `, [
        COMPANY_ID,
        typeId,
        parentId,
        acc.cod_cta.trim(),
        acc.nom_cta.trim().slice(0, 200),
        allowsEntries
      ]);

      codeToIdMap.set(acc.cod_cta.trim(), res.insertId);
      accountsInserted++;
    }

    console.log(`✅ ${accountsInserted} cuentas insertadas exitosamente en chart_of_accounts.\n`);

    // -------------------------------------------------------------
    // FASE 2: CARGA DE PARTIDAS CONTABLES (CABECERAS Y DETALLE)
    // -------------------------------------------------------------
    console.log('--- FASE 2: CARGA DE PARTIDAS CONTABLES (2026) ---');

    // Fetch all cabeceras
    const [cabeceras] = await conn.query(`
      SELECT corr, id_empresa, cod_partida, cod_tipo_partida, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha_str, correlativo, concepto, anulada, cargo, abono
      FROM db_sipe_conta.cabecera_partidas
      WHERE id_empresa = 'E-1' AND YEAR(fecha) = 2026
      ORDER BY fecha ASC, correlativo ASC, cod_partida ASC
    `);
    console.log(`✓ Cabeceras leídas de db_sipe_conta.cabecera_partidas: ${cabeceras.length}`);

    // Fetch all detalle lines
    const [detalles] = await conn.query(`
      SELECT d.corr, d.cod_partida, d.cod_cta, d.nom_cta, d.concepto, d.cargo, d.abono, d.cod_destino
      FROM db_sipe_conta.detalle_partidas d
      JOIN db_sipe_conta.cabecera_partidas c ON d.id_empresa = c.id_empresa AND d.cod_partida = c.cod_partida
      WHERE c.id_empresa = 'E-1' AND YEAR(c.fecha) = 2026
      ORDER BY d.corr ASC
    `);
    console.log(`✓ Líneas de detalle leídas de db_sipe_conta.detalle_partidas: ${detalles.length}`);

    // Group detalle lines by cod_partida
    const linesByPartida = new Map();
    for (const det of detalles) {
      if (!linesByPartida.has(det.cod_partida)) {
        linesByPartida.set(det.cod_partida, []);
      }
      linesByPartida.get(det.cod_partida).push(det);
    }

    // Insert entries and lines in batches
    const BATCH_SIZE = 500;
    let totalEntriesInserted = 0;
    let totalLinesInserted = 0;

    for (let i = 0; i < cabeceras.length; i += BATCH_SIZE) {
      const batchCabeceras = cabeceras.slice(i, i + BATCH_SIZE);

      // Prepare entry rows for batch insert
      const entryValues = [];
      const entryMeta = [];

      for (const cab of batchCabeceras) {
        const lines = linesByPartida.get(cab.cod_partida) || [];
        const entryTypeId = getEntryTypeId(cab.cod_tipo_partida);
        const branchId = determineBranchId(cab.concepto, lines);
        const dateIso = cab.fecha_str;
        const formattedNumber = formatEntryNumber(cab.correlativo, dateIso);
        const status = cab.anulada === 1 ? 'voided' : 'posted';
        const totalDebit = Number(cab.cargo || 0);
        const totalCredit = Number(cab.abono || 0);

        entryValues.push([
          COMPANY_ID,
          branchId,
          entryTypeId,
          formattedNumber,
          dateIso,
          (cab.concepto || '').trim(),
          status,
          totalDebit,
          totalCredit,
          CREATED_BY
        ]);

        entryMeta.push({
          cod_partida: cab.cod_partida,
          lines
        });
      }

      // Batch insert entries
      const [insertEntryRes] = await conn.query(`
        INSERT INTO accounting_entries (
          company_id, branch_id, entry_type_id, number, date, description,
          status, total_debit, total_credit, created_by, created_at, updated_at
        ) VALUES ?
      `, [entryValues.map(row => [...row, new Date(), new Date()])]);

      const firstInsertId = insertEntryRes.insertId;

      // Prepare lines for batch insert
      const lineValues = [];
      for (let j = 0; j < entryMeta.length; j++) {
        const entryId = firstInsertId + j;
        const { lines } = entryMeta[j];

        for (const line of lines) {
          const accountId = codeToIdMap.get(line.cod_cta.trim());
          if (!accountId) {
            throw new Error(`Cuenta no encontrada en mapeo: ${line.cod_cta} en partida ${entryMeta[j].cod_partida}`);
          }

          lineValues.push([
            entryId,
            accountId,
            (line.concepto || line.nom_cta || '').trim() || null,
            Number(line.cargo || 0),
            Number(line.abono || 0)
          ]);
        }
      }

      // Batch insert lines in sub-batches of 1000
      const LINE_BATCH = 1000;
      for (let k = 0; k < lineValues.length; k += LINE_BATCH) {
        const chunk = lineValues.slice(k, k + LINE_BATCH);
        if (chunk.length > 0) {
          await conn.query(`
            INSERT INTO accounting_entry_lines (
              entry_id, account_id, description, debit, credit
            ) VALUES ?
          `, [chunk]);
        }
      }

      totalEntriesInserted += batchCabeceras.length;
      totalLinesInserted += lineValues.length;

      const pct = Math.round((totalEntriesInserted / cabeceras.length) * 100);
      process.stdout.write(`\rProgreso: ${totalEntriesInserted}/${cabeceras.length} partidas insertadas (${pct}%) con ${totalLinesInserted} líneas.`);
    }

    console.log(`\n✅ ${totalEntriesInserted} partidas y ${totalLinesInserted} líneas insertadas exitosamente.\n`);

    // -------------------------------------------------------------
    // FASE 3: CORRELATIVOS Y CONFIGURACIÓN CONTABLE
    // -------------------------------------------------------------
    console.log('--- FASE 3: ACTUALIZACIÓN DE CORRELATIVOS Y FIRMAS CONTABLES ---');

    // Calculate max correlativos per entry_type_id, year, month
    const [correlativoStats] = await conn.query(`
      SELECT entry_type_id, YEAR(date) as y, MONTH(date) as m,
             MAX(CAST(SUBSTRING(number, 5) AS UNSIGNED)) as max_seq
      FROM accounting_entries
      WHERE company_id = ? AND YEAR(date) = 2026
      GROUP BY entry_type_id, YEAR(date), MONTH(date)
    `, [COMPANY_ID]);

    for (const stat of correlativoStats) {
      if (stat.max_seq) {
        await conn.query(`
          INSERT INTO accounting_entry_correlativos (
            company_id, entry_type_id, year, month, current_number, updated_at
          ) VALUES (?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE current_number = VALUES(current_number), updated_at = NOW()
        `, [COMPANY_ID, stat.entry_type_id, stat.y, stat.m, stat.max_seq]);
      }
    }
    console.log(`✓ Se actualizaron ${correlativoStats.length} registros de correlativos mensuales para 2026.`);

    // Seed accounting_settings from firmas_conta
    const [firmas] = await conn.query("SELECT * FROM db_sipe_conta.firmas_conta WHERE id_empresa = 'E-1'");
    for (const f of firmas) {
      let key = null;
      if (f.puesto.toUpperCase().includes('AUDITOR')) {
        key = 'auditor_nombre';
      } else if (f.puesto.toUpperCase().includes('CONTADOR')) {
        key = 'contador_nombre';
      }
      if (key) {
        await conn.query(`
          INSERT INTO accounting_settings (company_id, setting_key, setting_value, created_at, updated_at)
          VALUES (?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
        `, [COMPANY_ID, key, f.nom_firma.trim()]);
        console.log(`✓ Configuración contable registrada: ${key} = ${f.nom_firma.trim()}`);
      }
    }

    // Set resultado_ejercicio_id to account '3301' or '33' if available
    const [[cuentaResultado]] = await conn.query(`
      SELECT id FROM chart_of_accounts WHERE company_id = ? AND (code = '330101' OR code = '3301' OR code = '33') LIMIT 1
    `, [COMPANY_ID]);
    if (cuentaResultado) {
      await conn.query(`
        INSERT INTO accounting_settings (company_id, setting_key, setting_value, created_at, updated_at)
        VALUES (?, 'resultado_ejercicio_id', ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
      `, [COMPANY_ID, String(cuentaResultado.id)]);
      console.log(`✓ Configuración resultado_ejercicio_id = ${cuentaResultado.id}`);
    }

    await conn.commit();
    console.log('\n========================================================================');
    console.log('✅ TRANSACCIÓN CONFIRMADA Y GUARDADA EXITOSAMENTE (COMMIT)');
    console.log('========================================================================\n');

    // -------------------------------------------------------------
    // FASE 4: AUDITORÍA Y VERIFICACIÓN POST-MIGRACIÓN
    // -------------------------------------------------------------
    console.log('--- FASE 4: AUDITORÍA DE VERIFICACIÓN POST-MIGRACIÓN ---');

    const [[finalAccs]] = await conn.query('SELECT COUNT(*) as total FROM chart_of_accounts WHERE company_id = ?', [COMPANY_ID]);
    const [[finalEntries]] = await conn.query('SELECT COUNT(*) as total, MIN(date) as minDate, MAX(date) as maxDate FROM accounting_entries WHERE company_id = ?', [COMPANY_ID]);
    const [[entryTotals]] = await conn.query(`
      SELECT SUM(total_debit) as debit, SUM(total_credit) as credit 
      FROM accounting_entries WHERE company_id = ?
    `, [COMPANY_ID]);
    const [[lineTotals]] = await conn.query(`
      SELECT COUNT(*) as lineCount, SUM(debit) as debit, SUM(credit) as credit 
      FROM accounting_entry_lines l 
      JOIN accounting_entries e ON l.entry_id = e.id 
      WHERE e.company_id = ?
    `, [COMPANY_ID]);

    console.log(`1. Total Cuentas en Catálogo: ${finalAccs.total}`);
    console.log(`2. Total Partidas Registradas: ${finalEntries.total} (Rango de fechas: ${new Date(finalEntries.minDate).toISOString().slice(0, 10)} al ${new Date(finalEntries.maxDate).toISOString().slice(0, 10)})`);
    console.log(`3. Total Líneas de Partida:   ${lineTotals.lineCount}`);
    console.log(`4. Balance en Cabeceras:      Debe: $${Number(entryTotals.debit).toLocaleString('en-US', { minimumFractionDigits: 2 })} | Haber: $${Number(entryTotals.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`5. Balance en Líneas:         Debe: $${Number(lineTotals.debit).toLocaleString('en-US', { minimumFractionDigits: 2 })} | Haber: $${Number(lineTotals.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    // Check branch breakdown
    const [branchStats] = await conn.query(`
      SELECT b.nombre as sucursal, COUNT(e.id) as partidas, SUM(e.total_debit) as monto
      FROM accounting_entries e
      JOIN branches b ON e.branch_id = b.id
      WHERE e.company_id = ?
      GROUP BY b.id, b.nombre
    `, [COMPANY_ID]);
    console.log('\nDesglose por Sucursal:');
    console.table(branchStats);

    // Check entry types breakdown
    const [typeStats] = await conn.query(`
      SELECT et.name as tipo, COUNT(e.id) as partidas, SUM(e.total_debit) as monto
      FROM accounting_entries e
      JOIN entry_types et ON e.entry_type_id = et.id
      WHERE e.company_id = ?
      GROUP BY et.id, et.name
    `, [COMPANY_ID]);
    console.log('Desglose por Tipo de Partida:');
    console.table(typeStats);

    // Check monthly breakdown
    const [monthStats] = await conn.query(`
      SELECT MONTH(date) as mes, COUNT(id) as partidas, SUM(total_debit) as monto
      FROM accounting_entries
      WHERE company_id = ?
      GROUP BY MONTH(date)
      ORDER BY mes ASC
    `, [COMPANY_ID]);
    console.log('Desglose por Mes (2026):');
    console.table(monthStats);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 PROCESO DE MIGRACIÓN COMPLETADO CON ÉXITO EN ${duration} SEGUNDOS.`);

  } catch (err) {
    await conn.rollback();
    console.error('\n❌ ERROR EN EL PROCESO, SE EJECUTÓ ROLLBACK:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runMigration();
