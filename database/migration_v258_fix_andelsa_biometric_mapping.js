/**
 * Migración v258:
 * Vinculación exacta por Nombre entre Usuarios del Biométrico ZKTeco y rh_empleados en ANDELSA (company_id: 9).
 * Corrige el cruce de nombres en las marcaciones y en los reportes de planilla.
 */

const pool = require('../server/src/config/db');

// Mapeo verificado entre el userId del reloj biométrico y el empleado en rh_empleados
const ANDELSA_MAPPINGS = [
  { uid: '1',  empId: 24, name: 'JUAN JOSE CASCO ORTIZ' },
  { uid: '2',  empId: 28, name: 'WILSON SALVADOR RAMOS GARCÍA' },
  { uid: '3',  empId: 24, name: 'JUAN JOSE CASCO ORTIZ' },
  { uid: '4',  empId: 20, name: 'JOSE PABLO ESTRADA ULLOA' },
  { uid: '5',  empId: 21, name: 'RAMON ALFREDIS CASTILLO' },
  { uid: '6',  empId: 25, name: 'SANTO MANUEL PINEDA VASQUEZ' },
  { uid: '9',  empId: 27, name: 'VIRGILIO MEMBREÑO' },
  { uid: '10', empId: 23, name: 'MARCOS ANTONIO SOLORZANO' },
  { uid: '11', empId: 26, name: 'DELMY ISABEL ACEVEDO GRANAD' },
  { uid: '12', empId: 22, name: 'ANA ESTELA ALVARADO DURAN' },
  { uid: '15', empId: 29, name: 'ROBERTO LUIS DÍAZ MARTÍNEZ' },
  { uid: '17', empId: 19, name: 'GLENDA XIOMARA NAVARRO DE GARCIA' },
  { uid: '18', empId: 30, name: 'MARIO ANTONIO DIAZ MORAN' },
  { uid: '19', empId: 33, name: 'ALAN ORELLANA' },
  { uid: '20', empId: 32, name: 'RAMIRO RAFAEL BARRERA' },
  { uid: '21', empId: 35, name: 'DENYS ALFONSO MELENDEZ' },
  { uid: '22', empId: 36, name: 'JUAN FRANCISCO BAIRES' },
  { uid: '24', empId: 790, name: 'EMERSON ADOLFO DÍAZ NOLASCO' },
  { uid: '30', empId: 793, name: 'CESAR NEFTALI GONZALEZ FUENTES' },
  { uid: '31', empId: 795, name: 'WALTER RODRIGUEZ' },
  { uid: '34', empId: 794, name: 'CARLOS HERIBERTO RIVAS' }
];

async function up() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('[v258] Iniciando actualización de codigo_biometrico en rh_empleados para ANDELSA (company_id: 9)...');

    // 1. Asignar codigo_biometrico a cada empleado
    for (const m of ANDELSA_MAPPINGS) {
      await conn.query(
        `UPDATE rh_empleados SET codigo_biometrico = ? WHERE id = ? AND company_id = 9`,
        [m.uid, m.empId]
      );
    }
    console.log('[v258] codigo_biometrico actualizado correctamente en rh_empleados.');

    // 2. Corregir empleado_id en todo el histórico de rh_biometric_attendance_logs para ANDELSA
    let totalUpdated = 0;
    for (const m of ANDELSA_MAPPINGS) {
      const [res] = await conn.query(
        `UPDATE rh_biometric_attendance_logs
         SET empleado_id = ?
         WHERE company_id = 9 AND device_uid = ?`,
        [m.empId, m.uid]
      );
      totalUpdated += res.affectedRows;
    }

    console.log(`[v258] Marcaciones actualizadas en rh_biometric_attendance_logs: ${totalUpdated} registros vinculados.`);

    await conn.commit();
    console.log('[v258] Migración completada con éxito.');
  } catch (err) {
    await conn.rollback();
    console.error('[v258] Error en migración:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { up };
