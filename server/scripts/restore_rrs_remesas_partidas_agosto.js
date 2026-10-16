const pool = require('../src/config/db');
const { getRrsPool } = require('../src/config/rrsDb');

async function restoreAugustRemesas() {
    console.log('=== INICIANDO RESTAURACIÓN DE PARTIDAS Y ESTADO CONTABILIZADO EN RRS (AGOSTO 2026) ===\n');

    const rrsPool = getRrsPool();

    // 1. Obtener los movimientos bancarios de Agosto 2026 de Pista y Tienda
    const [movs] = await rrsPool.query(`
        SELECT id, id_empresa, llave, documento, numero_cuenta, concepto, cargo, fecha 
        FROM movimientos_bancarios 
        WHERE (llave LIKE '%-G%' OR llave LIKE '%-S%')
          AND fecha LIKE '%08/2026'
        ORDER BY STR_TO_DATE(fecha, '%d/%m/%Y') ASC, id ASC
    `);

    console.log(`[RRS] Se encontraron ${movs.length} movimientos de Agosto 2026 para revisar.`);

    if (movs.length !== 73) {
        console.warn(`[Advertencia] Se esperaban 73 registros de agosto, encontrados: ${movs.length}`);
    }

    // 2. Obtener las partidas de Agosto 2026 en db_sipe_conta
    const [partidas] = await pool.query(`
        SELECT corr, id_empresa, cod_partida, fecha, correlativo, concepto, cargo 
        FROM db_sipe_conta.cabecera_partidas
        WHERE id_empresa = 'E-5' 
          AND fecha >= '2026-08-01' AND fecha <= '2026-08-31'
    `);

    console.log(`[Conta] Se cargaron ${partidas.length} partidas de Agosto 2026 para E-5.`);

    // 3. Emparejamiento biunívoco
    const updates = [];
    const unmapped = [];

    for (const m of movs) {
        const doc = (m.documento || '').trim();
        const monto = parseFloat(m.cargo) || 0;

        let match = null;
        if (doc && doc.length >= 4) {
            const foundByDoc = partidas.filter(p => (p.concepto || '').includes(doc));
            if (foundByDoc.length === 1) {
                match = foundByDoc[0];
            } else if (foundByDoc.length > 1) {
                match = foundByDoc.find(p => Math.abs((parseFloat(p.cargo) || 0) - monto) < 0.01) || foundByDoc[0];
            }
        }

        if (!match && monto > 0) {
            const foundByConcept = partidas.filter(p => 
                Math.abs((parseFloat(p.cargo) || 0) - monto) < 0.01 && 
                (p.concepto || '').includes(m.concepto)
            );
            if (foundByConcept.length === 1) match = foundByConcept[0];
        }

        if (match && match.correlativo) {
            updates.push({
                id: m.id,
                llave: m.llave,
                fecha: m.fecha,
                doc: m.documento,
                monto: m.cargo,
                num_partida: match.correlativo,
                cod_partida: match.cod_partida
            });
        } else {
            unmapped.push(m);
        }
    }

    console.log(`[Cruce] Emparejados con éxito: ${updates.length}`);
    console.log(`[Cruce] Sin emparejar: ${unmapped.length}`);

    if (unmapped.length > 0) {
        console.error('[Error] No todos los registros se pudieron emparejar con certeza. Abortando operación.');
        console.table(unmapped);
        process.exit(1);
    }

    // 4. Ejecución del UPDATE en RRS
    const conn = await rrsPool.getConnection();
    try {
        await conn.beginTransaction();

        let updatedCount = 0;
        for (const u of updates) {
            const [res] = await conn.query(
                `UPDATE movimientos_bancarios 
                 SET num_partida = ?, es_contabilizado = 'S' 
                 WHERE id = ? AND llave = ?`,
                [u.num_partida, u.id, u.llave]
            );
            updatedCount += res.affectedRows;
        }

        await conn.commit();
        console.log(`\n[Éxito] Se actualizaron ${updatedCount} movimientos bancarios en RRS.`);
    } catch (err) {
        await conn.rollback();
        console.error('[Error] Falló la transacción en RRS:', err.message);
        process.exit(1);
    } finally {
        conn.release();
    }

    // 5. Verificación final
    const [check] = await rrsPool.query(`
        SELECT COUNT(*) as total_agosto,
               SUM(CASE WHEN es_contabilizado = 'S' THEN 1 ELSE 0 END) as contabilizados,
               SUM(CASE WHEN num_partida != '' AND num_partida IS NOT NULL THEN 1 ELSE 0 END) as con_num_partida
        FROM movimientos_bancarios
        WHERE (llave LIKE '%-G%' OR llave LIKE '%-S%')
          AND fecha LIKE '%08/2026'
    `);

    console.log('\n=== REPORTE DE VERIFICACIÓN EN RRS ===');
    console.table(check);
    console.log('======================================\n');

    process.exit(0);
}

restoreAugustRemesas().catch(e => {
    console.error('Error fatal:', e);
    process.exit(1);
});
