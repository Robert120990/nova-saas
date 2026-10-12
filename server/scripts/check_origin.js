const pool = require('../src/config/db');

async function checkOrigin() {
  const [rows] = await pool.query(`
    SELECT * 
    FROM db_sipe_conta.cabecera_partidas 
    WHERE id_empresa = 'E-1' AND cargo = 41593.95
  `);
  console.log('Origin cabecera_partidas in db_sipe_conta:');
  console.table(rows);

  if (rows.length > 0) {
    const cod = rows[0].cod_partida;
    console.log(`cod_partida: ${cod}`);

    // Check if there is any table that links cod_partida to cierre_turno!
    const [links] = await pool.query(`
      SELECT * FROM db_sipe_conta.cierre_turno 
      WHERE fecha_turno = '2026-07-31' AND (id_empresa = 'E-1' OR id_empresa = '002' OR id_empresa = '01')
    `).catch(e => [e.message]);
    console.log('cierre_turno for 2026-07-31 in db_sipe_conta:');
    console.log(links);
  }
}

checkOrigin().then(() => process.exit());
