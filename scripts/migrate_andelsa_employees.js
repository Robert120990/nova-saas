/**
 * Script to migrate employee catalog from remote MySQL database (db_sipe_andelsa)
 * to local SaaS database (db_sistema_saas) for ANDELSA, S.A. DE C.V. (company_id: 9).
 */

const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({
  path: path.join(__dirname, '../server/.env')
});

function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (trimmed === '' || trimmed === '/  /' || trimmed === '  /  /' || trimmed.includes('//')) {
    return null;
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return null;
}

function cleanString(str) {
  if (!str) return null;
  const trimmed = String(str).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanPhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '    -' || trimmed === '   -') {
    return null;
  }
  return trimmed;
}

async function runMigration() {
  console.log('=== INICIANDO MIGRACIÓN DE EMPLEADOS ANDELSA ===\n');

  // 1. Conexión local
  const localDb = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_sistema_saas',
    port: process.env.DB_PORT || 3306
  });
  console.log('✓ Conectado a la base de datos local');

  // 2. Conexión remota
  const remoteDb = await mysql.createConnection({
    host: '207.244.251.167',
    user: 'sysadmin',
    password: 'QwErTy123',
    database: 'db_sipe_andelsa',
    port: 3306
  });
  console.log('✓ Conectado a la base de datos remota (207.244.251.167 / db_sipe_andelsa)\n');

  try {
    // 3. Validar empresa destino ANDELSA (company_id: 9)
    const [companies] = await localDb.query(
      'SELECT id, razon_social, nombre_comercial FROM companies WHERE id = 9'
    );
    if (!companies.length) {
      throw new Error('No se encontró la empresa con ID 9 en la base local.');
    }
    const company = companies[0];
    const companyId = company.id;
    console.log(`Empresa destino: [${company.id}] ${company.razon_social} (${company.nombre_comercial})`);

    // 4. Migrar Cargos
    console.log('\n--- Migrando Cargos ---');
    const [remoteCargos] = await remoteDb.query(
      "SELECT id, descripcion FROM cargos WHERE id_empresa = '001' ORDER BY id ASC"
    );
    console.log(`Cargos encontrados en remoto: ${remoteCargos.length}`);

    for (const cargo of remoteCargos) {
      const cod = String(cargo.id).padStart(2, '0');
      const desc = cleanString(cargo.descripcion) || 'SIN DESCRIPCION';
      await localDb.query(
        `INSERT INTO rh_cargos (company_id, codigo, descripcion)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)`,
        [companyId, cod, desc]
      );
    }

    const [localCargos] = await localDb.query(
      'SELECT id, codigo, descripcion FROM rh_cargos WHERE company_id = ?',
      [companyId]
    );
    const cargoMap = {};
    for (const c of localCargos) {
      cargoMap[c.codigo] = c.id;
      // Also map without leading zero if applicable
      cargoMap[String(parseInt(c.codigo, 10))] = c.id;
    }
    console.log(`✓ Cargos listos en base local: ${localCargos.length}`);

    // 5. Migrar Departamentos de Personal
    console.log('\n--- Migrando Departamentos de Personal ---');
    const [remoteDeps] = await remoteDb.query(
      "SELECT id, descripcion FROM departamentos_personal WHERE id_empresa = '001' ORDER BY id ASC"
    );
    console.log(`Departamentos encontrados en remoto: ${remoteDeps.length}`);

    for (const dep of remoteDeps) {
      const cod = String(dep.id).padStart(2, '0');
      const desc = cleanString(dep.descripcion) || 'SIN AREA';
      await localDb.query(
        `INSERT INTO rh_departamentos (company_id, codigo, descripcion)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)`,
        [companyId, cod, desc]
      );
    }

    const [localDeps] = await localDb.query(
      'SELECT id, codigo, descripcion FROM rh_departamentos WHERE company_id = ?',
      [companyId]
    );
    const deptMap = {};
    for (const d of localDeps) {
      deptMap[d.codigo] = d.id;
      deptMap[String(parseInt(d.codigo, 10))] = d.id;
    }
    console.log(`✓ Departamentos listos en base local: ${localDeps.length}`);

    // 6. Obtener Catálogos de AFP y Contratos
    const [localAfps] = await localDb.query(
      'SELECT id, codigo, descripcion FROM rh_afp WHERE company_id = ?',
      [companyId]
    );
    const afpMap = {};
    for (const a of localAfps) {
      afpMap[a.codigo] = a.id;
      afpMap[String(parseInt(a.codigo, 10))] = a.id;
    }
    console.log(`✓ AFPs disponibles para ANDELSA:`, afpMap);

    const [localContratos] = await localDb.query(
      'SELECT id, codigo, descripcion FROM rh_tipos_contrato WHERE company_id = ?',
      [companyId]
    );
    const contratoIndefinido = localContratos.find(c => c.codigo === '02') || localContratos[0];
    const defaultTipoContratoId = contratoIndefinido ? contratoIndefinido.id : null;
    console.log(`✓ Tipo de contrato por defecto: [${defaultTipoContratoId}] Indefinido`);

    // 7. Migrar Empleados
    console.log('\n--- Migrando Empleados ---');
    const [remoteEmpleados] = await remoteDb.query(
      "SELECT * FROM empleados WHERE id_empresa = '001' ORDER BY codigo ASC"
    );
    console.log(`Total de empleados remotos a migrar: ${remoteEmpleados.length}`);

    let insertedEmployees = 0;
    let emergencyContactsCount = 0;

    for (const e of remoteEmpleados) {
      const codigo = cleanString(e.codigo);
      const nombres = cleanString(e.nombre_dui) || 'SIN NOMBRE';
      const apellidos = cleanString(e.apellidos_dui) || 'SIN APELLIDO';
      const fechaNacimiento = parseDate(e.fecha_nacimiento);
      const numDui = cleanString(e.numero_dui);
      const numNit = cleanString(e.numero_nit);
      const afpId = afpMap[e.cod_afp] || afpMap[String(parseInt(e.cod_afp, 10))] || null;
      const ocupacion = cleanString(e.ocupacion);
      const direccion = cleanString(e.direccion);

      // Los códigos de municipio/departamento en remoto son 0 o incompatibles con cat_012/cat_013
      const departamento = null;
      const municipio = null;
      const distrito = null;

      const telefono = cleanPhone(e.tel_empleado);
      const correo = cleanString(e.email);
      const cargoId = cargoMap[e.cod_cargo] || cargoMap[String(parseInt(e.cod_cargo, 10))] || null;
      const deptoPersonalId = deptMap[e.cod_area_trabajo] || deptMap[String(parseInt(e.cod_area_trabajo, 10))] || null;
      const numIsss = cleanString(e.numero_isss);
      const numNup = cleanString(e.numero_nup);
      const fechaIngreso = parseDate(e.fecha_ingreso) || new Date().toISOString().slice(0, 10);
      const tipoContratoId = defaultTipoContratoId;
      const sueldoBase = parseFloat(e.sueldo_base) || 0;
      const bonificacionFija = parseFloat(e.bonificacion_fija) || 0;
      const cuentaPlanillera = cleanString(e.cuenta_bancaria);
      const esActivo = e.activo ? 1 : 0;
      const esJubilado = e.es_jubilado ? 1 : 0;
      const enVacaciones = e.de_vacaciones ? 1 : 0;
      const incapacitado = e.con_incapacidad ? 1 : 0;
      const comentarios = cleanString(e.comentario);

      const [res] = await localDb.query(
        `INSERT INTO rh_empleados (
          company_id, codigo, nombres, apellidos, fecha_nacimiento,
          num_dui, num_nit, afp_id, ocupacion, direccion,
          departamento, municipio, distrito, telefono, correo,
          cargo_id, departamento_personal_id, num_isss, num_nup,
          fecha_ingreso, tipo_contrato_id, sueldo_base, bonificacion_fija,
          cuenta_planillera, es_activo, es_jubilado, en_vacaciones,
          incapacitado, comentarios
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
        ON DUPLICATE KEY UPDATE
          nombres = VALUES(nombres),
          apellidos = VALUES(apellidos),
          fecha_nacimiento = VALUES(fecha_nacimiento),
          num_dui = VALUES(num_dui),
          num_nit = VALUES(num_nit),
          afp_id = VALUES(afp_id),
          ocupacion = VALUES(ocupacion),
          direccion = VALUES(direccion),
          departamento = VALUES(departamento),
          municipio = VALUES(municipio),
          distrito = VALUES(distrito),
          telefono = VALUES(telefono),
          correo = VALUES(correo),
          cargo_id = VALUES(cargo_id),
          departamento_personal_id = VALUES(departamento_personal_id),
          num_isss = VALUES(num_isss),
          num_nup = VALUES(num_nup),
          fecha_ingreso = VALUES(fecha_ingreso),
          tipo_contrato_id = VALUES(tipo_contrato_id),
          sueldo_base = VALUES(sueldo_base),
          bonificacion_fija = VALUES(bonificacion_fija),
          cuenta_planillera = VALUES(cuenta_planillera),
          es_activo = VALUES(es_activo),
          es_jubilado = VALUES(es_jubilado),
          en_vacaciones = VALUES(en_vacaciones),
          incapacitado = VALUES(incapacitado),
          comentarios = VALUES(comentarios)`,
        [
          companyId, codigo, nombres, apellidos, fechaNacimiento,
          numDui, numNit, afpId, ocupacion, direccion,
          departamento, municipio, distrito, telefono, correo,
          cargoId, deptoPersonalId, numIsss, numNup,
          fechaIngreso, tipoContratoId, sueldoBase, bonificacionFija,
          cuentaPlanillera, esActivo, esJubilado, enVacaciones,
          incapacitado, comentarios
        ]
      );
      insertedEmployees++;

      // Obtener ID del empleado
      const [empRows] = await localDb.query(
        'SELECT id FROM rh_empleados WHERE company_id = ? AND codigo = ?',
        [companyId, codigo]
      );
      const empleadoId = empRows[0].id;

      // Contacto de emergencia
      const nomEmergencia = cleanString(e.emergencias);
      const telEmergencia = cleanPhone(e.tel_emergencias);
      if (nomEmergencia && telEmergencia) {
        const [existingContacts] = await localDb.query(
          'SELECT id FROM rh_empleado_emergency_contacts WHERE empleado_id = ? AND nombre = ?',
          [empleadoId, nomEmergencia]
        );
        if (!existingContacts.length) {
          await localDb.query(
            `INSERT INTO rh_empleado_emergency_contacts (empleado_id, nombre, telefono)
             VALUES (?, ?, ?)`,
            [empleadoId, nomEmergencia, telEmergencia]
          );
          emergencyContactsCount++;
        }
      }
    }
    console.log(`✓ Empleados procesados: ${insertedEmployees}`);
    console.log(`✓ Contactos de emergencia insertados: ${emergencyContactsCount}`);

    // 8. Migrar Descuentos Programados
    console.log('\n--- Migrando Descuentos Programados ---');
    const [remoteDescuentos] = await remoteDb.query(
      "SELECT * FROM empleados_descuentos_programados WHERE id_empresa = '001'"
    );
    console.log(`Descuentos programados remotos encontrados: ${remoteDescuentos.length}`);

    // Obtener id de tipo de descuento '01' (Pago de Prestamo) para ANDELSA
    const [localDescTipos] = await localDb.query(
      'SELECT id, codigo, descripcion FROM rh_descuentos_programados WHERE company_id = ? AND codigo = ?',
      [companyId, '01']
    );
    const tipoDescuentoPrestamoId = localDescTipos.length ? localDescTipos[0].id : null;
    let descuentosMigrados = 0;

    if (tipoDescuentoPrestamoId && remoteDescuentos.length > 0) {
      for (const d of remoteDescuentos) {
        const [empRows] = await localDb.query(
          'SELECT id FROM rh_empleados WHERE company_id = ? AND codigo = ?',
          [companyId, cleanString(d.cod_empleado)]
        );
        if (!empRows.length) continue;
        const empleadoId = empRows[0].id;

        let quincena = 'ambas';
        const qUpper = (d.quincena || '').toUpperCase();
        if (qUpper.includes('1RA') || qUpper.includes('PRIMERA')) {
          quincena = 'primera';
        } else if (qUpper.includes('2DA') || qUpper.includes('SEGUNDA')) {
          quincena = 'segunda';
        }

        const valor = parseFloat(d.valor) || 0;
        const cuotasTotal = parseInt(d.numero_cuotas, 10) || 36;
        const cuotasRestantes = parseInt(d.cuota_actual, 10) || cuotasTotal;
        const numeroCredito = cleanString(d.numero_credito);
        const activo = d.estado === 'A' ? 1 : 0;

        // Verificar si ya existe
        const [existing] = await localDb.query(
          `SELECT id FROM rh_empleado_descuentos 
           WHERE company_id = ? AND empleado_id = ? AND descuento_id = ?`,
          [companyId, empleadoId, tipoDescuentoPrestamoId]
        );

        if (existing.length > 0) {
          await localDb.query(
            `UPDATE rh_empleado_descuentos
             SET quincena = ?, valor = ?, numero_cuotas = ?, cuotas_restantes = ?, numero_credito = ?, activo = ?
             WHERE id = ?`,
            [quincena, valor, cuotasTotal, cuotasRestantes, numeroCredito, activo, existing[0].id]
          );
        } else {
          await localDb.query(
            `INSERT INTO rh_empleado_descuentos
             (company_id, empleado_id, descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, empleadoId, tipoDescuentoPrestamoId, quincena, valor, cuotasTotal, cuotasRestantes, numeroCredito, activo]
          );
        }
        descuentosMigrados++;
      }
    }
    console.log(`✓ Descuentos programados migrados/actualizados: ${descuentosMigrados}`);

    // 9. Verificación Final
    console.log('\n=== VERIFICACIÓN FINAL EN BASE LOCAL ===');
    const [totalEmp] = await localDb.query(
      'SELECT count(*) as total FROM rh_empleados WHERE company_id = ?',
      [companyId]
    );
    console.log(`Total empleados en ANDELSA (company_id: 9): ${totalEmp[0].total}`);

    const [sampleEmployees] = await localDb.query(
      `SELECT e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.cuenta_planillera,
              c.descripcion as cargo, d.descripcion as depto, a.descripcion as afp
       FROM rh_empleados e
       LEFT JOIN rh_cargos c ON e.cargo_id = c.id
       LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
       LEFT JOIN rh_afp a ON e.afp_id = a.id
       WHERE e.company_id = ?
       ORDER BY e.codigo ASC`,
      [companyId]
    );
    console.table(sampleEmployees);

    console.log('\n✓ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', error);
    process.exit(1);
  } finally {
    await localDb.end();
    await remoteDb.end();
  }
}

runMigration();
