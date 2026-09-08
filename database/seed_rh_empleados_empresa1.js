const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function seedCompany1Employees() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const companyId = 1;
    console.log(`=== Seeding test employees for company_id: ${companyId} ===`);

    // 1. Update employee 0008 if it has empty/broken data
    const [emp8] = await connection.query(
      'SELECT id, codigo, sueldo_base FROM rh_empleados WHERE company_id = ? AND codigo = ?',
      [companyId, '0008']
    );
    if (emp8.length > 0 && parseFloat(emp8[0].sueldo_base || 0) === 0) {
      console.log('Actualizando empleado 0008 existente con datos completos...');
      await connection.query(
        `UPDATE rh_empleados SET
          cargo_id = 2,
          departamento_personal_id = 1,
          tipo_contrato_id = 2,
          sueldo_base = 850.00,
          bonificacion_fija = 0.00,
          num_isss = '341890241',
          num_nup = '219803140021',
          fecha_ingreso = '2022-06-01',
          cuenta_planillera = '003004589210',
          correo = 'rigoberto.flamenco@empresa1.com',
          es_activo = 1,
          comentarios = 'Actualizado para pruebas de planilla (Tramo 2 Renta)'
        WHERE id = ?`,
        [emp8[0].id]
      );
      console.log('✓ Empleado 0008 actualizado.');
    }

    // 2. Define the new test employee profiles
    const testEmployees = [
      {
        codigo: '0009',
        nombres: 'Kevin Alexander',
        apellidos: 'Rivas Alvarado',
        fecha_nacimiento: '1999-04-12',
        num_dui: '05891234-5',
        num_nit: '0614-120499-102-3',
        afp_id: 2, // AFP Crecer
        ocupacion: 'Cajero / Dependiente',
        direccion: 'Colonia Miramonte, Calle Los Sisimiles #142',
        departamento: '06',
        municipio: '21',
        distrito: '14',
        telefono: '76543210',
        correo: 'kevin.rivas@empresa1.com',
        cargo_id: 1, // Cajero
        departamento_personal_id: 3, // Tienda
        num_isss: '412589632',
        num_nup: '521478963214',
        fecha_ingreso: '2025-01-15',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 365.00, // Salario mínimo legal - Tramo 1 (Sin retención de Renta)
        bonificacion_fija: 0.00,
        cuenta_planillera: '014002587410',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Salario mínimo legal ($365), exento de Renta.',
        contact: { nombre: 'Rosa Alvarado', telefono: '7654-3210', parentesco: 'Madre' }
      },
      {
        codigo: '0010',
        nombres: 'Claudia Vanessa',
        apellidos: 'Portillo Mejía',
        fecha_nacimiento: '1994-08-23',
        num_dui: '04871295-8',
        num_nit: '0614-230894-101-7',
        afp_id: 1, // AFP Confia
        ocupacion: 'Chef Principal / Encargada de Cocina',
        direccion: 'Urbanización Jardines de Merliot, Senda 5 #18',
        departamento: '05',
        municipio: '26',
        distrito: '01',
        telefono: '78901234',
        correo: 'claudia.portillo@empresa1.com',
        cargo_id: 4, // Jefe
        departamento_personal_id: 4, // Cocina
        num_isss: '523698741',
        num_nup: '632145897412',
        fecha_ingreso: '2021-08-10',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 650.00,
        bonificacion_fija: 100.00, // Prueba de percepción fija adicional
        cuenta_planillera: '025001478523',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Con bonificación fija ($100), sueldo base $650.',
        contact: { nombre: 'Carlos Portillo', telefono: '7890-1234', parentesco: 'Hermano' },
        loan: {
          descuento_id: 1,
          quincena: 'ambas',
          valor: 25.00,
          numero_cuotas: 12,
          cuotas_restantes: 10,
          numero_credito: 'PREST-2026-001'
        }
      },
      {
        codigo: '0011',
        nombres: 'Mauricio Ernesto',
        apellidos: 'Quintanilla Lemus',
        fecha_nacimiento: '1985-11-30',
        num_dui: '02587413-2',
        num_nit: '0614-301185-103-5',
        afp_id: 2, // AFP Crecer
        ocupacion: 'Contador / Administrador',
        direccion: 'Residencial Santa Teresa, Pasaje 3 #12, Santa Tecla',
        departamento: '05',
        municipio: '26',
        distrito: '01',
        telefono: '77412589',
        correo: 'mauricio.quintanilla@empresa1.com',
        cargo_id: 2, // Administrador
        departamento_personal_id: 1, // Oficina
        num_isss: '632587419',
        num_nup: '741258963258',
        fecha_ingreso: '2018-04-01',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 1400.00, // Tramo 3 Renta (20%), tope mensual ISSS de $1,000 / $30.00
        bonificacion_fija: 0.00,
        cuenta_planillera: '036009874561',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Tramo 3 Renta ($1400), alcanza tope máximo de ISSS ($30/mes).',
        contact: { nombre: 'Ana Lemus de Quintanilla', telefono: '7741-2589', parentesco: 'Esposa' }
      },
      {
        codigo: '0012',
        nombres: 'Beatriz Eugenia',
        apellidos: 'Zelaya Cisneros',
        fecha_nacimiento: '1982-03-15',
        num_dui: '01896547-6',
        num_nit: '0614-150382-104-1',
        afp_id: 1, // AFP Confia
        ocupacion: 'Gerente de Operaciones',
        direccion: 'Colonia Escalón, Calle El Mirador #480',
        departamento: '06',
        municipio: '21',
        distrito: '14',
        telefono: '71239874',
        correo: 'beatriz.zelaya@empresa1.com',
        cargo_id: 3, // Gerente
        departamento_personal_id: 1, // Oficina
        num_isss: '741852963',
        num_nup: '852963147852',
        fecha_ingreso: '2017-02-15',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 2800.00, // Tramo 4 Renta (30%), alta retención
        bonificacion_fija: 200.00,
        cuenta_planillera: '047008523694',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Alta gerencia ($2800 + $200 bonif), Tramo 4 Renta.',
        contact: { nombre: 'Roberto Zelaya', telefono: '7123-9874', parentesco: 'Cónyuge' }
      },
      {
        codigo: '0013',
        nombres: 'Manuel de Jesús',
        apellidos: 'Navarrete Orellana',
        fecha_nacimiento: '1958-09-20',
        num_dui: '00325896-1',
        num_nit: '0614-200958-101-2',
        afp_id: 1, // AFP Confia
        ocupacion: 'Supervisor Senior (Jubilado)',
        direccion: 'Barrio San Jacinto, Calle 10 de Mayo #45',
        departamento: '06',
        municipio: '21',
        distrito: '14',
        telefono: '73654120',
        correo: 'manuel.navarrete@empresa1.com',
        cargo_id: 5, // Supervisor
        departamento_personal_id: 2, // Pista
        num_isss: '125896325',
        num_nup: '963258741258',
        fecha_ingreso: '2019-11-01',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 900.00,
        bonificacion_fija: 0.00,
        cuenta_planillera: '058007412589',
        es_activo: 1,
        es_jubilado: 1, // JUBILADO ACTIVO -> No debe descontar ISSS ni AFP
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Jubilado activo (es_jubilado = 1), sin ISSS ni AFP.',
        contact: { nombre: 'Marta de Navarrete', telefono: '7365-4120', parentesco: 'Esposa' }
      },
      {
        codigo: '0014',
        nombres: 'Guillermo Antonio',
        apellidos: 'Castro Beltrán',
        fecha_nacimiento: '1978-07-08',
        num_dui: '01236547-9',
        num_nit: '0614-080778-102-4',
        afp_id: 2, // AFP Crecer
        ocupacion: 'Jefe de Pista y Logística',
        direccion: 'Residencial San Antonio, Senda Los Rosales #15, Ilopango',
        departamento: '06',
        municipio: '22',
        distrito: '17',
        telefono: '79513574',
        correo: 'guillermo.castro@empresa1.com',
        cargo_id: 4, // Jefe
        departamento_personal_id: 2, // Pista
        num_isss: '852147963',
        num_nup: '369852147896',
        fecha_ingreso: '2013-05-10', // Antigüedad > 10 años (21 días de aguinaldo)
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 550.00,
        bonificacion_fija: 50.00,
        cuenta_planillera: '069006325874',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Antigüedad > 10 años (ingreso 2013), prueba tramo máximo aguinaldo (21 días).',
        contact: { nombre: 'Carmen Castro', telefono: '7951-3574', parentesco: 'Hija' }
      },
      {
        codigo: '0015',
        nombres: 'Valeria Nicole',
        apellidos: 'Pineda Morales',
        fecha_nacimiento: '2002-12-05',
        num_dui: '06321458-3',
        num_nit: '0614-051202-105-8',
        afp_id: 1, // AFP Confia
        ocupacion: 'Atención al Cliente / Caja',
        direccion: 'Colonia Ciudad Satélite, Pasaje Plutón #22',
        departamento: '06',
        municipio: '21',
        distrito: '14',
        telefono: '78451236',
        correo: 'valeria.pineda@empresa1.com',
        cargo_id: 1, // Cajero
        departamento_personal_id: 3, // Tienda
        num_isss: '963147852',
        num_nup: '147852369852',
        fecha_ingreso: '2026-04-01', // Reciente ingreso (< 1 año)
        tipo_contrato_id: 4, // Temporal
        sueldo_base: 425.00,
        bonificacion_fija: 0.00,
        cuenta_planillera: '071005214789',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Reciente ingreso (< 1 año, ingreso 2026-04-01), cálculo proporcional.',
        contact: { nombre: 'Silvia Morales', telefono: '7845-1236', parentesco: 'Madre' }
      },
      {
        codigo: '0016',
        nombres: 'Rodrigo Alejandro',
        apellidos: 'Campos Fuentes',
        fecha_nacimiento: '1992-06-18',
        num_dui: '03698521-4',
        num_nit: '0614-180692-106-9',
        afp_id: 2, // AFP Crecer
        ocupacion: 'Supervisor de Turno',
        direccion: 'Urbanización Cumbres de Cuscatlán, Calle Los Granados #8',
        departamento: '05',
        municipio: '26',
        distrito: '10',
        telefono: '72589631',
        correo: 'rodrigo.campos@empresa1.com',
        cargo_id: 5, // Supervisor
        departamento_personal_id: 4, // Cocina
        num_isss: '369258147',
        num_nup: '258147369258',
        fecha_ingreso: '2023-10-15',
        tipo_contrato_id: 2, // Indefinido
        sueldo_base: 600.00,
        bonificacion_fija: 25.00,
        cuenta_planillera: '082004125896',
        es_activo: 1,
        es_jubilado: 0,
        en_vacaciones: 0,
        incapacitado: 0,
        comentarios: 'Perfil de prueba: Supervisor con bonificación $25 y sueldo $600.',
        contact: { nombre: 'Elena Fuentes', telefono: '7258-9631', parentesco: 'Madre' }
      }
    ];

    for (const emp of testEmployees) {
      const { contact, loan, ...empData } = emp;

      // Check if employee already exists by codigo or DUI
      const [existing] = await connection.query(
        'SELECT id FROM rh_empleados WHERE company_id = ? AND (codigo = ? OR num_dui = ?)',
        [companyId, empData.codigo, empData.num_dui]
      );

      let empleadoId;
      if (existing.length > 0) {
        empleadoId = existing[0].id;
        console.log(`Empleado ${empData.codigo} (${empData.nombres} ${empData.apellidos}) ya existe (id: ${empleadoId}), actualizando...`);
        await connection.query(
          `UPDATE rh_empleados SET
            nombres = ?, apellidos = ?, fecha_nacimiento = ?, num_dui = ?, num_nit = ?,
            afp_id = ?, ocupacion = ?, direccion = ?, departamento = ?, municipio = ?, distrito = ?,
            telefono = ?, correo = ?, cargo_id = ?, departamento_personal_id = ?, num_isss = ?,
            num_nup = ?, fecha_ingreso = ?, tipo_contrato_id = ?, sueldo_base = ?, bonificacion_fija = ?,
            cuenta_planillera = ?, es_activo = ?, es_jubilado = ?, en_vacaciones = ?, incapacitado = ?, comentarios = ?
           WHERE id = ?`,
          [
            empData.nombres, empData.apellidos, empData.fecha_nacimiento, empData.num_dui, empData.num_nit,
            empData.afp_id, empData.ocupacion, empData.direccion, empData.departamento, empData.municipio, empData.distrito,
            empData.telefono, empData.correo, empData.cargo_id, empData.departamento_personal_id, empData.num_isss,
            empData.num_nup, empData.fecha_ingreso, empData.tipo_contrato_id, empData.sueldo_base, empData.bonificacion_fija,
            empData.cuenta_planillera, empData.es_activo, empData.es_jubilado, empData.en_vacaciones, empData.incapacitado, empData.comentarios,
            empleadoId
          ]
        );
      } else {
        const [insertRes] = await connection.query(
          `INSERT INTO rh_empleados (
            company_id, codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit,
            afp_id, ocupacion, direccion, departamento, municipio, distrito,
            telefono, correo, cargo_id, departamento_personal_id, num_isss,
            num_nup, fecha_ingreso, tipo_contrato_id, sueldo_base, bonificacion_fija,
            cuenta_planillera, es_activo, es_jubilado, en_vacaciones, incapacitado, comentarios
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId, empData.codigo, empData.nombres, empData.apellidos, empData.fecha_nacimiento, empData.num_dui, empData.num_nit,
            empData.afp_id, empData.ocupacion, empData.direccion, empData.departamento, empData.municipio, empData.distrito,
            empData.telefono, empData.correo, empData.cargo_id, empData.departamento_personal_id, empData.num_isss,
            empData.num_nup, empData.fecha_ingreso, empData.tipo_contrato_id, empData.sueldo_base, empData.bonificacion_fija,
            empData.cuenta_planillera, empData.es_activo, empData.es_jubilado, empData.en_vacaciones, empData.incapacitado, empData.comentarios
          ]
        );
        empleadoId = insertRes.insertId;
        console.log(`✓ Insertado empleado ${empData.codigo} (${empData.nombres} ${empData.apellidos}) con ID: ${empleadoId}`);
      }

      // Emergency contact
      if (contact && contact.nombre) {
        await connection.query(
          'DELETE FROM rh_empleado_emergency_contacts WHERE empleado_id = ?',
          [empleadoId]
        );
        await connection.query(
          'INSERT INTO rh_empleado_emergency_contacts (empleado_id, nombre, telefono, parentesco) VALUES (?, ?, ?, ?)',
          [empleadoId, contact.nombre, contact.telefono, contact.parentesco]
        );
      }

      // Scheduled discount (Loan test)
      if (loan) {
        const [existLoan] = await connection.query(
          'SELECT id FROM rh_empleado_descuentos WHERE company_id = ? AND empleado_id = ? AND descuento_id = ?',
          [companyId, empleadoId, loan.descuento_id]
        );
        if (existLoan.length === 0) {
          await connection.query(
            `INSERT INTO rh_empleado_descuentos (
              company_id, empleado_id, descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [companyId, empleadoId, loan.descuento_id, loan.quincena, loan.valor, loan.numero_cuotas, loan.cuotas_restantes, loan.numero_credito]
          );
          console.log(`  -> Descuento programado agregado: ${loan.numero_credito} ($${loan.valor} quincenal)`);
        }
      }
    }

    await connection.commit();
    console.log('\n✓ Transacción confirmada exitosamente en la base de datos.');

    // 3. Print final report of company 1 employees
    const [finalList] = await pool.query(
      `SELECT e.codigo, CONCAT(e.nombres, ' ', e.apellidos) as nombre_completo,
              c.descripcion as cargo, d.descripcion as depto,
              a.descripcion as afp, e.sueldo_base, e.bonificacion_fija,
              e.es_jubilado, e.fecha_ingreso
       FROM rh_empleados e
       LEFT JOIN rh_cargos c ON e.cargo_id = c.id
       LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
       LEFT JOIN rh_afp a ON e.afp_id = a.id
       WHERE e.company_id = ? AND e.es_activo = 1
       ORDER BY e.codigo ASC`,
      [companyId]
    );

    console.log('\n=== LISTA ACTUALIZADA DE EMPLEADOS ACTIVOS (EMPRESA 1) ===');
    console.table(finalList);

  } catch (error) {
    await connection.rollback();
    console.error('Error al sembrar empleados para empresa 1:', error);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

seedCompany1Employees();
