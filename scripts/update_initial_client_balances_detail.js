const db = require('../server/src/config/db');
const XLSX = require('../client/node_modules/xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateDeterministicUUID(str) {
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`.toUpperCase();
}

const CLIENT_FILE_MAPPING = [
  { file: 'AGROIN 30092026.xls', customerId: 15103, nrc: '176666-5', nombre: 'AGROIN S+R. S. A. DE C. V.' },
  { file: 'ALEXANDRA ARIAS 30092026.xls', customerId: 19380, nrc: '348024-4', nombre: 'ARIAS SERRANO, ALEXANDRA' },
  { file: 'ALIMENTOS NUTRICIONALES 30092026.xls', customerId: 34772, nrc: '224745-0', nombre: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR SA DECV' },
  { file: 'BERTILIO MUÑOZ 30092026.xls', customerId: 24064, nrc: '87965-7', nombre: 'MUÑOS  BERTILO ANTONIO' },
  { file: 'CALLEJAS 30092026.xls', customerId: 32555, nrc: '193-7', nombre: 'CALLEJA, S.A. DE C.V.' },
  { file: 'CONFECCIONES JIBOA 30092026.xls', customerId: 24796, nrc: '30', nombre: 'CONFECCIONES JIBOA, S. A. DE C. V.' },
  { file: 'CONFECCIONES PEDREGAL 30092026.xls', customerId: 24799, nrc: '31', nombre: 'CONFECCIONES EL PEDREGAL, S. A. DE C. V.' },
  { file: 'EFI LOGISTICS 30092026.xls', customerId: 19429, nrc: '166626-7', nombre: 'EFI LOGISTICS S.A. DE C.V.' },
  { file: 'FERTILIZANTES FOLIARES 30092026.xls', customerId: 34619, nrc: '213754-9', nombre: 'FERTILIZANTES FOLIARES DE EL SALVADOR, S.A. DE C.V.' },
  { file: 'POLLO TECLEÑO 30092026.xls', customerId: 19323, nrc: '347359-1', nombre: 'POLLO TECLEÑO S.A DE C.V.' },
  { file: 'SALVADOR ALVARENGA 30092026.xls', customerId: 27792, nrc: '143981-4', nombre: 'SALVADOR ALCIDES  ALVARENGA' },
  { file: 'ZONA FRANCA 30092026.xls', customerId: 33693, nrc: '23437-0', nombre: 'ZONA FRANCA DE EXPORTACION EL PEDREGAL, S.A.' }
];

async function run() {
  const companyId = 8; // Corina Margarita Mendez de Sosa
  const branchId = 4;  // Puma Miraflores
  const dir = 'C:\\Users\\rauls\\Downloads\\Clientes Credito Miraflroes';
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    console.log('1. Desvinculando pagos existentes de las ventas placeholder...');
    const oldSaleIds = [51546, 51547, 51548, 51549, 51550, 51551, 51552, 51553, 51554, 51555, 51556, 51557];
    await conn.query('UPDATE customer_payments SET sale_id = NULL WHERE sale_id IN (?)', [oldSaleIds]);

    console.log('2. Eliminando registros genéricos de saldo inicial anteriores (51546 - 51557)...');
    await conn.query('DELETE FROM sales_items WHERE sale_id IN (?)', [oldSaleIds]);
    await conn.query('DELETE FROM dtes WHERE venta_id IN (?)', [oldSaleIds]);
    await conn.query('DELETE FROM sales_headers WHERE id IN (?)', [oldSaleIds]);

    console.log('3. Procesando los 12 archivos de Excel con el detalle por documento...');
    let totalDocsInserted = 0;
    let totalItemsInserted = 0;
    let totalPagosInserted = 0;
    let totalCargosSum = 0;
    let totalAbonosSum = 0;

    const usedNumControls = new Set();
    const usedUuids = new Set();

    for (const mapping of CLIENT_FILE_MAPPING) {
      const fullPath = path.join(dir, mapping.file);
      const workbook = XLSX.readFile(fullPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const dataRows = rawRows.filter(r => r && typeof r[0] === 'number');

      // Agrupar filas por (fecha, tipo, doc)
      const docGroups = new Map();

      dataRows.forEach(r => {
        const fechaCode = r[0];
        const doc = String(r[1]).trim();
        const tipo = String(r[2]).trim().toUpperCase();
        const producto = String(r[3] || 'COMBUSTIBLE').trim();
        const placas = r[4] ? String(r[4]).trim() : '';
        const odometro = r[5] ? parseFloat(r[5]) || 0 : 0;
        const valor = Math.round((parseFloat(r[6]) || 0) * 100) / 100;
        const abono = Math.round((parseFloat(r[7]) || 0) * 100) / 100;

        const d = XLSX.SSF.parse_date_code(fechaCode);
        const dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;

        const key = `${dateStr}_${tipo}_${doc}`;
        if (!docGroups.has(key)) {
          docGroups.set(key, {
            dateStr,
            tipo,
            doc,
            placas,
            items: [],
            totalAbono: 0
          });
        }
        const grp = docGroups.get(key);
        grp.items.push({
          producto,
          placas,
          odometro,
          valor
        });
        if (abono > 0) {
          grp.totalAbono += abono;
        }
      });

      let clientCargos = 0;
      let clientAbonos = 0;

      for (const [key, grp] of docGroups.entries()) {
        const docTotal = Math.round(grp.items.reduce((acc, it) => acc + it.valor, 0) * 100) / 100;
        const tipoDoc = grp.tipo === 'CCF' ? '03' : (grp.tipo === 'CMP' ? '01' : '00');
        
        let numControl = `${grp.tipo}-${grp.doc}`;
        if (usedNumControls.has(numControl)) {
          let count = 2;
          while (usedNumControls.has(`${numControl}-${count}`)) count++;
          numControl = `${numControl}-${count}`;
        }
        usedNumControls.add(numControl);

        let uuid = generateDeterministicUUID(`SALDO-DETALLE-MIRAFLORES-${mapping.customerId}-${grp.dateStr}-${numControl}`);
        if (usedUuids.has(uuid)) {
          let count = 2;
          while (usedUuids.has(generateDeterministicUUID(`SALDO-DETALLE-MIRAFLORES-${mapping.customerId}-${grp.dateStr}-${numControl}-${count}`))) count++;
          uuid = generateDeterministicUUID(`SALDO-DETALLE-MIRAFLORES-${mapping.customerId}-${grp.dateStr}-${numControl}-${count}`);
        }
        usedUuids.add(uuid);

        const obs = `SALDO AL 30/09/2026 - ${grp.tipo}-${grp.doc}${grp.placas ? ' - PLACAS: ' + grp.placas : ''}`;

        // Insertar cabecera de venta
        const [saleRes] = await conn.query(`
          INSERT INTO sales_headers (
            company_id, branch_id, customer_id, tipo_documento, condicion_operacion,
            payment_condition, fecha_emision, hora_emision, estado, total_pagar,
            total_gravado, total_exento, total_nosujetas, total_iva, observaciones,
            cliente_nombre, codigo_generacion, numero_control, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 2, 2, ?, '00:00:00', 'emitido', ?, 0, ?, 0, 0, ?, ?, ?, ?, ?, NOW())
        `, [
          companyId, branchId, mapping.customerId, tipoDoc, grp.dateStr,
          docTotal, docTotal, obs, mapping.nombre, uuid, numControl, `${grp.dateStr} 00:00:00`
        ]);
        const saleId = saleRes.insertId;
        totalDocsInserted++;
        clientCargos += docTotal;

        // Insertar partidas de la venta
        for (const it of grp.items) {
          const desc = `${it.producto}${it.placas ? ' - ' + it.placas : ''}${it.odometro > 0 ? ' (Km: ' + it.odometro + ')' : ''}`;
          await conn.query(`
            INSERT INTO sales_items (
              sale_id, codigo, descripcion, cantidad, precio_unitario, venta_exenta, venta_gravada
            ) VALUES (?, 'SALDO-INIC', ?, 1, ?, ?, 0)
          `, [saleId, desc, it.valor, it.valor]);
          totalItemsInserted++;
        }

        // Insertar registro DTE para trazabilidad
        await conn.query(`
          INSERT INTO dtes (
            venta_id, company_id, branch_id, usuario_id, tipo_dte, codigo_generacion,
            numero_control, status, ambiente, sello_recepcion, fh_procesamiento, created_at, updated_at
          ) VALUES (?, ?, ?, 1, '00', ?, ?, 'COMPLETED', '1', 'SALDO-INICIAL-SISTEMA', ?, ?, NOW())
        `, [
          saleId, companyId, branchId, uuid, numControl, `${grp.dateStr} 00:00:00`, `${grp.dateStr} 00:00:00`
        ]);

        // Si tiene abono registrado en el estado de cuenta
        if (grp.totalAbono > 0) {
          const abonoMonto = Math.round(grp.totalAbono * 100) / 100;
          await conn.query(`
            INSERT INTO customer_payments (
              company_id, branch_id, customer_id, sale_id, monto, fecha_pago,
              metodo_pago, referencia, notas, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'Abono Registrado', ?, ?, ?)
          `, [
            companyId, branchId, mapping.customerId, saleId, abonoMonto, grp.dateStr,
            `ABONO ${grp.tipo}-${grp.doc}`,
            `Abono de saldo histórico al 30/09/2026 para ${grp.tipo}-${grp.doc}`,
            `${grp.dateStr} 00:00:00`
          ]);
          totalPagosInserted++;
          clientAbonos += abonoMonto;
        }
      }

      clientCargos = Math.round(clientCargos * 100) / 100;
      clientAbonos = Math.round(clientAbonos * 100) / 100;
      const clientNeto = Math.round((clientCargos - clientAbonos) * 100) / 100;

      totalCargosSum += clientCargos;
      totalAbonosSum += clientAbonos;

      console.log(`+ [NRC: ${mapping.nrc.padEnd(8)}] ${mapping.nombre.padEnd(45)}: ${docGroups.size} docs, Cargos: $${clientCargos.toFixed(2)}, Abonos: $${clientAbonos.toFixed(2)}, Saldo: $${clientNeto.toFixed(2)}`);
    }

    totalCargosSum = Math.round(totalCargosSum * 100) / 100;
    totalAbonosSum = Math.round(totalAbonosSum * 100) / 100;
    const totalNetoGlobal = Math.round((totalCargosSum - totalAbonosSum) * 100) / 100;

    await conn.commit();
    console.log(`\n======================================================`);
    console.log(`IMPORTACION DEL DETALLE COMPLETADA EXITOSAMENTE`);
    console.log(`Clientes procesados: 12`);
    console.log(`Documentos (ventas) creados: ${totalDocsInserted}`);
    console.log(`Partidas (items) creadas: ${totalItemsInserted}`);
    console.log(`Abonos (pagos) creados: ${totalPagosInserted}`);
    console.log(`Total Cargos: $${totalCargosSum.toFixed(2)}`);
    console.log(`Total Abonos: $${totalAbonosSum.toFixed(2)}`);
    console.log(`Saldo Neto de Cartera al 30/09/2026: $${totalNetoGlobal.toFixed(2)}`);
    console.log(`======================================================`);
    process.exit(0);
  } catch (error) {
    await conn.rollback();
    console.error('Error durante la importación del detalle:', error);
    process.exit(1);
  } finally {
    conn.release();
  }
}

run();
