const pool = require('../src/config/db');

async function test() {
  const [rows] = await pool.query(`
    SELECT id, id_punto_venta, fecha_turno, turno, responsable, id_empresa, estado
    FROM db_system_rrs.cierre_turno 
    WHERE fecha_turno LIKE '%2026'
    ORDER BY id DESC
    LIMIT 10
  `);
  console.log('db_system_rrs.cierre_turno for 2026:');
  console.table(rows);

  // Check 31/07/2026 for Miraflores
  const [july31] = await pool.query(`
    SELECT * 
    FROM db_system_rrs.cierre_turno 
    WHERE fecha_turno = '31/07/2026'
  `);
  console.log('Closeouts on 31/07/2026 in db_system_rrs:');
  console.table(july31);
}

test().then(() => process.exit());
