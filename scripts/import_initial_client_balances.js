const db = require('../server/src/config/db');
const crypto = require('crypto');

function generateDeterministicUUID(str) {
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`.toUpperCase();
}

const CLIENTES = [
  { nrc: '143981-4', id: 27792, nombre: 'SALVADOR ALCIDES ALVARENGA', saldo: 2645.79 },
  { nrc: '166626-7', id: 19429, nombre: 'EFI LOGISTICS S.A. DE C.V.', saldo: 26275.70 },
  { nrc: '176666-5', id: 15103, nombre: 'AGROIN S+R. S. A. DE C. V.', saldo: 765.99 },
  { nrc: '193-7',    id: 32555, nombre: 'CALLEJA, S.A. DE C.V.', saldo: 19591.12 },
  { nrc: '224745-0', id: 34772, nombre: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR SA DECV', saldo: 1856.33 },
  { nrc: '23437-0',  id: 33693, nombre: 'ZONA FRANCA DE EXPORTACION EL PEDREGAL, S.A.', saldo: 4909.16 },
  { nrc: '30',       id: 24796, nombre: 'CONFECCIONES JIBOA, S. A. DE C. V.', saldo: 854.42 },
  { nrc: '31',       id: 24799, nombre: 'CONFECCIONES EL PEDREGAL, S. A. DE C. V.', saldo: 1159.70 },
  { nrc: '347359-1', id: 19323, nombre: 'POLLO TECLEÑO S.A DE C.V.', saldo: 84.30 },
  { nrc: '348024-4', id: 19380, nombre: 'ARIAS SERRANO, ALEXANDRA', saldo: 142.50 },
  { nrc: '87965-7',  id: 24064, nombre: 'MUÑOS BERTILO ANTONIO', saldo: 2451.17 },
  { nrc: '213754-9', id: 34619, nombre: 'FERTILIZANTES FOLIARES DE EL SALVADOR, S.A. DE C.V.', saldo: 1532.95 }
];

async function run() {
  const companyId = 8; // Corina Margarita Mendez de Sosa
  const branchId = 4;  // Puma Miraflores
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    console.log('1. Verificando tipo_dte 00 (Saldo Inicial)...');
    await conn.query("INSERT IGNORE INTO cat_002_tipo_dte (code, description) VALUES ('00', 'Saldo Inicial')");

    console.log('2. Configurando créditos de gasolinera para afectar CXC en Puma Miraflores desde 2026-10-01...');
    await conn.query(`
      INSERT INTO gas_station_settings (company_id, branch_id, setting_key, setting_value, created_at, updated_at)
      VALUES (?, ?, 'creditos_afectan_cxc', '1', NOW(), NOW())
      ON DUPLICATE KEY UPDATE setting_value = '1', updated_at = NOW()
    `, [companyId, branchId]);

    await conn.query(`
      INSERT INTO gas_station_settings (company_id, branch_id, setting_key, setting_value, created_at, updated_at)
      VALUES (?, ?, 'creditos_afectan_cxc_desde', '2026-10-01', NOW(), NOW())
      ON DUPLICATE KEY UPDATE setting_value = '2026-10-01', updated_at = NOW()
    `, [companyId, branchId]);

    console.log('3. Habilitando condición de crédito (es_credito = 1) para los 12 clientes...');
    const customerIds = CLIENTES.map(c => c.id);
    await conn.query(`UPDATE customers SET es_credito = 1 WHERE id IN (?) AND company_id = ?`, [customerIds, companyId]);

    console.log('4. Insertando registros de saldo inicial al 30 de septiembre de 2026...');
    let totalCargado = 0;

    for (const c of CLIENTES) {
      // Verificar si ya existe el registro de saldo inicial para evitar duplicados
      const [existing] = await conn.query(`
        SELECT id FROM sales_headers 
        WHERE company_id = ? AND branch_id = ? AND customer_id = ? 
        AND tipo_documento = '00' AND fecha_emision = '2026-09-30'
      `, [companyId, branchId, c.id]);

      if (existing.length > 0) {
        console.log(`- Cliente [${c.nrc}] ${c.nombre} ya tiene saldo inicial registrado (sale_id: ${existing[0].id}). Omitiendo inserción.`);
        totalCargado += c.saldo;
        continue;
      }

      const uuid = generateDeterministicUUID(`SALDO-INICIAL-PUMA-MIRAFLORES-${c.id}-${c.nrc}-2026-09-30`);
      const numControl = `SALDO-INICIAL-${c.nrc}`;

      const [saleRes] = await conn.query(`
        INSERT INTO sales_headers (
          company_id, branch_id, customer_id, tipo_documento, condicion_operacion,
          payment_condition, fecha_emision, hora_emision, estado, total_pagar,
          total_gravado, total_exento, total_nosujetas, total_iva, observaciones,
          cliente_nombre, codigo_generacion, numero_control, created_at, updated_at
        ) VALUES (?, ?, ?, '00', 2, 2, '2026-09-30', '00:00:00', 'emitido', ?, 0, ?, 0, 0, ?, ?, ?, ?, '2026-09-30 00:00:00', NOW())
      `, [
        companyId, branchId, c.id, c.saldo, c.saldo,
        'SALDO INICIAL AL 30/09/2026 (CORTE AL 30 DE ABRIL)',
        c.nombre, uuid, numControl
      ]);
      const saleId = saleRes.insertId;

      await conn.query(`
        INSERT INTO sales_items (
          sale_id, codigo, descripcion, cantidad, precio_unitario, venta_exenta, venta_gravada
        ) VALUES (?, 'SALDO-INIC', 'SALDO INICIAL DE CARTERA AL 30/09/2026', 1, ?, ?, 0)
      `, [saleId, c.saldo, c.saldo]);

      await conn.query(`
        INSERT INTO dtes (
          venta_id, company_id, branch_id, usuario_id, tipo_dte, codigo_generacion,
          numero_control, status, ambiente, sello_recepcion, fh_procesamiento, created_at, updated_at
        ) VALUES (?, ?, ?, 1, '00', ?, ?, 'COMPLETED', '1', 'SALDO-INICIAL-SISTEMA', '2026-09-30 00:00:00', '2026-09-30 00:00:00', NOW())
      `, [
        saleId, companyId, branchId, uuid, numControl
      ]);

      console.log(`+ Cliente [${c.nrc}] ${c.nombre}: Registrado sale_id ${saleId} por $${c.saldo.toFixed(2)}`);
      totalCargado += c.saldo;
    }

    await conn.commit();
    console.log(`\n======================================================`);
    console.log(`PROCESO COMPLETADO EXITOSAMENTE`);
    console.log(`Total Clientes Procesados: ${CLIENTES.length}`);
    console.log(`Total Cartera Inicial Cargada: $${totalCargado.toFixed(2)}`);
    console.log(`======================================================`);
    process.exit(0);
  } catch (error) {
    await conn.rollback();
    console.error('Error durante la importación:', error);
    process.exit(1);
  } finally {
    conn.release();
  }
}

run();
