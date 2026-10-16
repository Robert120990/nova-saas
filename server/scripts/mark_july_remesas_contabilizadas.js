const { getRrsPool } = require('../src/config/rrsDb');

async function markJulyAsContabilizadas() {
    console.log('=== MARCAR 10 REMESAS DE JULIO 2026 COMO CONTABILIZADAS EN RRS ===\n');
    const pool = getRrsPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            UPDATE movimientos_bancarios
            SET es_contabilizado = 'S'
            WHERE cod_remesa = '01' 
              AND SUBSTRING(fecha, 4, 7) = '07/2026' 
              AND (llave LIKE '%-G%' OR llave LIKE '%-S%')
        `);

        console.log(`[Éxito] Filas actualizadas a es_contabilizado = 'S': ${result.affectedRows}`);
        await conn.commit();

        const [rows] = await pool.query(`
            SELECT id, llave, documento, numero_cuenta, fecha, monto, num_partida, es_contabilizado
            FROM movimientos_bancarios
            WHERE cod_remesa = '01' 
              AND SUBSTRING(fecha, 4, 7) = '07/2026' 
              AND (llave LIKE '%-G%' OR llave LIKE '%-S%')
            ORDER BY STR_TO_DATE(fecha, '%d/%m/%Y') ASC
        `);
        console.table(rows);

    } catch (e) {
        await conn.rollback();
        console.error('Error durante la actualización:', e);
    } finally {
        conn.release();
        process.exit(0);
    }
}

markJulyAsContabilizadas();
