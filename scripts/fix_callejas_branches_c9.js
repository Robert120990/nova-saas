const mysql = require('../server/node_modules/mysql2/promise');
require('../server/node_modules/dotenv').config({ path: 'c:/Users/Roberto/Desktop/web/nova-saas/server/.env' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  console.log('--- FASE 1: RESPALDO PREVENTIVO ---');
  await db.query('DROP TABLE IF EXISTS customer_branches_backup_callejas_20260908');
  await db.query(
    'CREATE TABLE customer_branches_backup_callejas_20260908 AS SELECT * FROM customer_branches WHERE customer_id = 11316'
  );
  const [backupRows] = await db.query('SELECT COUNT(*) as count FROM customer_branches_backup_callejas_20260908');
  console.log(`Respaldo creado con éxito en tabla customer_branches_backup_callejas_20260908: ${backupRows[0].count} registros.`);

  console.log('\n--- FASE 2: ACTUALIZACIÓN TRANSACCIONAL ---');
  const updates = [
    // Grupo 1: La Libertad Este (05-26-01 Antiguo Cuscatlán)
    { ids: [17], dep: '05', mun: '26', dist: '01', desc: 'Antiguo Cuscatlán (Santa Elena)' },
    { ids: [19], dep: '05', mun: '26', dist: '01', desc: 'Antiguo Cuscatlán (Multiplaza)' },
    { ids: [20], dep: '05', mun: '26', dist: '01', desc: 'Antiguo Cuscatlán (Las Cascadas)' },
    { ids: [33], dep: '05', mun: '26', dist: '01', desc: 'Antiguo Cuscatlán (La Ceiba)' },

    // Grupo 2: La Libertad Sur (05-28-11 Santa Tecla)
    { ids: [18], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (CC Las Palmas)' },
    { ids: [26, 40], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (La Cañada / Merliot)' },
    { ids: [27], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (Las Ramblas)' },
    { ids: [32, 41], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (CC Santa Rosa)' },
    { ids: [60, 91], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (Plaza Merliot)' },
    { ids: [92, 93, 94], dep: '05', mun: '28', dist: '11', desc: 'Santa Tecla (CC La Joya)' },

    // Grupo 3: La Libertad Centro (05-24-15 San Juan Opico)
    { ids: [24], dep: '05', mun: '24', dist: '15', desc: 'San Juan Opico (El Encuentro Opico)' },
    { ids: [30], dep: '05', mun: '24', dist: '15', desc: 'San Juan Opico (CC Marsella)' },

    // Grupo 4: La Libertad Oeste (05-25-03 Colón / Lourdes)
    { ids: [25], dep: '05', mun: '25', dist: '03', desc: 'Colón (El Encuentro Lourdes)' },

    // Grupo 5: San Salvador Centro (06-23-14 San Salvador)
    { ids: [21], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (Redondel Masferrer)' },
    { ids: [22], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (CC El Paseo)' },
    { ids: [23], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (Lomas Verdes / Masferrer)' },
    { ids: [29], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (San Benito)' },
    { ids: [39], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (Paseo Escalón / Altamira)' },
    { ids: [48], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (Calle a Huizúcar)' },
    { ids: [59, 90], dep: '06', mun: '23', dist: '14', desc: 'San Salvador (San Antonio Abad)' },

    // Grupo 6: San Salvador Oeste (06-21-02 Apopa)
    { ids: [28], dep: '06', mun: '21', dist: '02', desc: 'Apopa (Metromall San Gabriel)' },
    { ids: [37], dep: '06', mun: '21', dist: '02', desc: 'Apopa (El Encuentro Valle Dulce)' },
    { ids: [50], dep: '06', mun: '21', dist: '02', desc: 'Apopa (Plaza Mundo Apopa)' },

    // Grupo 7: San Salvador Sur (San Marcos y Santo Tomás)
    { ids: [34], dep: '06', mun: '24', dist: '12', desc: 'San Marcos (El Encuentro San Marcos)' },
    { ids: [46], dep: '06', mun: '24', dist: '16', desc: 'Santo Tomás (Km 18 Carr. a Comalapa)' },

    // Grupo 8: San Salvador Este (Soyapango, Ilopango, San Martín)
    { ids: [35], dep: '06', mun: '22', dist: '17', desc: 'Soyapango (Plaza Mundo Soyapango)' },
    { ids: [49], dep: '06', mun: '22', dist: '17', desc: 'Soyapango (Mega Selectos Plan del Pino)' },
    { ids: [57, 88], dep: '06', mun: '22', dist: '17', desc: 'Soyapango (CC Blvd. Espíritu Santo)' },
    { ids: [36], dep: '06', mun: '22', dist: '07', desc: 'Ilopango (Urb. Llano Verde)' },
    { ids: [38], dep: '06', mun: '22', dist: '13', desc: 'San Martín (El Encuentro San Martín)' },

    // Grupo 9: Sonsonate Centro (03-18-15 Sonsonate)
    { ids: [47], dep: '03', mun: '18', dist: '15', desc: 'Sonsonate (El Encuentro Sonsonate)' },

    // Grupo 10: La Paz (Olocuilta y Zacatecoluca)
    { ids: [45], dep: '08', mun: '23', dist: '05', desc: 'Olocuilta (CC La Estación)' },
    { ids: [42], dep: '08', mun: '25', dist: '21', desc: 'Zacatecoluca (El Encuentro Zacatecoluca)' },

    // Grupo 11: San Miguel Centro (12-22-17 San Miguel)
    { ids: [43], dep: '12', mun: '22', dist: '17', desc: 'San Miguel (El Encuentro El Sitio)' },
    { ids: [44], dep: '12', mun: '22', dist: '17', desc: 'San Miguel (Ruta Militar)' },

    // Grupo 12: La Unión Norte (14-19-16 Santa Rosa de Lima)
    { ids: [31], dep: '14', mun: '19', dist: '16', desc: 'Santa Rosa de Lima' }
  ];

  await db.beginTransaction();
  let totalUpdated = 0;

  try {
    for (const group of updates) {
      for (const branchId of group.ids) {
        const [result] = await db.query(
          'UPDATE customer_branches SET departamento = ?, municipio = ?, distrito = ? WHERE id = ? AND customer_id = 11316',
          [group.dep, group.mun, group.dist, branchId]
        );
        if (result.affectedRows > 0) {
          totalUpdated++;
          console.log(`[OK] Sucursal #${branchId} actualizada a Dep: ${group.dep}, Muni: ${group.mun}, Dist: ${group.dist} (${group.desc})`);
        } else {
          console.warn(`[WARN] Sucursal #${branchId} no encontrada o sin cambios.`);
        }
      }
    }

    await db.commit();
    console.log(`\nTransacción confirmada exitosamente. Total sucursales actualizadas: ${totalUpdated}`);
  } catch (err) {
    await db.rollback();
    console.error('Error durante la actualización. Se hizo ROLLBACK.', err);
    process.exit(1);
  }

  console.log('\n--- FASE 3: VALIDACIÓN AUTOMÁTICA CONTRA CATÁLOGOS MH ---');
  const [validation] = await db.query(`
    SELECT 
      cb.id,
      cb.nombre,
      cb.departamento,
      cb.municipio,
      cb.distrito,
      d.description AS distrito_desc,
      d.muni_code AS distrito_municipio_code,
      m.description AS municipio_desc,
      dep.description AS depto_desc,
      CASE 
        WHEN d.muni_code IS NOT NULL AND d.muni_code = cb.municipio AND d.dep_code = cb.departamento THEN 'CORRECTO'
        ELSE 'DISCORDANTE'
      END AS estado_concordancia
    FROM customer_branches cb
    LEFT JOIN cat_008_distrito d 
      ON d.code = cb.distrito AND d.dep_code = cb.departamento
    LEFT JOIN cat_013_municipio m 
      ON m.code = cb.municipio AND m.dep_code = cb.departamento
    LEFT JOIN cat_012_departamento dep 
      ON dep.code = cb.departamento
    WHERE cb.customer_id = 11316
    ORDER BY cb.id
  `);

  const correctas = validation.filter(v => v.estado_concordancia === 'CORRECTO');
  const discordantes = validation.filter(v => v.estado_concordancia !== 'CORRECTO');

  console.log(`Total sucursales en Callejas: ${validation.length}`);
  console.log(`Sucursales CONCORDANTES: ${correctas.length}`);
  console.log(`Sucursales DISCORDANTES: ${discordantes.length}`);

  if (discordantes.length > 0) {
    console.error('\nERROR: Aún existen sucursales discordantes:');
    console.table(discordantes);
    process.exit(1);
  } else {
    console.log('\n¡ÉXITO TOTAL! El 100% de las sucursales concuerda exactamente con los catálogos oficiales del Ministerio de Hacienda.');
  }

  await db.end();
}

run().catch(console.error);
