const pool = require('../src/config/db');
const { getRrsPool } = require('../src/config/rrsDb');
const { syncGasDeliveryToRrs } = require('../src/controllers/gasRemesaDelivery.controller');
const { syncSalesDeliveryToRrs } = require('../src/controllers/salesRemesaDelivery.controller');

async function runRegularization() {
    console.log('=== INICIANDO REGULARIZACIÓN Y RESINCRONIZACIÓN DE REMESAS A RRS ===\n');

    const rrsPool = getRrsPool();

    // 1. Obtener todas las entregas entregadas de Pista (Gas Station)
    const [gasDeliveries] = await pool.query(
        `SELECT id, company_id FROM gas_station_remesa_deliveries WHERE entregado = 1 ORDER BY id ASC`
    );
    console.log(`[Pista/Gas] Se encontraron ${gasDeliveries.length} entregas marcadas como entregadas.`);

    let gasSuccess = 0;
    let gasErrors = 0;
    for (const d of gasDeliveries) {
        try {
            await syncGasDeliveryToRrs(d.id, d.company_id);
            gasSuccess++;
        } catch (err) {
            console.error(`  [Gas Error] Entrega #${d.id} (Company ${d.company_id}): ${err.message}`);
            gasErrors++;
        }
    }
    console.log(`[Pista/Gas] Sincronización completada: ${gasSuccess} exitosas, ${gasErrors} errores.\n`);

    // 2. Obtener todas las entregas entregadas de Tienda (Sales)
    const [salesDeliveries] = await pool.query(
        `SELECT id, company_id FROM sales_remesa_deliveries WHERE entregado = 1 ORDER BY id ASC`
    );
    console.log(`[Tienda/Sales] Se encontraron ${salesDeliveries.length} entregas marcadas como entregadas.`);

    let salesSuccess = 0;
    let salesErrors = 0;
    for (const d of salesDeliveries) {
        try {
            await syncSalesDeliveryToRrs(d.id, d.company_id);
            salesSuccess++;
        } catch (err) {
            console.error(`  [Sales Error] Entrega #${d.id} (Company ${d.company_id}): ${err.message}`);
            salesErrors++;
        }
    }
    console.log(`[Tienda/Sales] Sincronización completada: ${salesSuccess} exitosas, ${salesErrors} errores.\n`);

    // 3. Limpiar cualquier remanente de llaves legadas que coincidan con las entregas regularizadas
    console.log('[Limpieza Legacy] Verificando llaves legacy en RRS...');
    const [legacyRecords] = await rrsPool.query(
        `SELECT id, llave, documento, numero_cuenta, concepto, cargo, abono FROM movimientos_bancarios 
         WHERE (llave LIKE '014-%' OR llave LIKE '006-%' OR llave LIKE '008-%') 
           AND llave NOT LIKE '%-G%' 
           AND llave NOT LIKE '%-S%'`
    );
    console.log(`[Limpieza Legacy] Registros con formato antiguo encontrados: ${legacyRecords.length}`);

    if (legacyRecords.length > 0) {
        // Solo eliminamos si ya existen sus contrapartes -G o -S
        const [delLegacy] = await rrsPool.query(
            `DELETE FROM movimientos_bancarios 
             WHERE (llave LIKE '014-%' OR llave LIKE '006-%' OR llave LIKE '008-%') 
               AND llave NOT LIKE '%-G%' 
               AND llave NOT LIKE '%-S%'`
        );
        console.log(`[Limpieza Legacy] ${delLegacy.affectedRows} registros legacy antiguos eliminados.`);
    }

    // 4. Verificación final en RRS
    const [gasMovs] = await rrsPool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(cargo), 0) as total FROM movimientos_bancarios WHERE llave LIKE '%-G%'`
    );
    const [salesMovs] = await rrsPool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(cargo), 0) as total FROM movimientos_bancarios WHERE llave LIKE '%-S%'`
    );
    const [remainingLegacy] = await rrsPool.query(
        `SELECT COUNT(*) as count FROM movimientos_bancarios 
         WHERE (llave LIKE '014-%' OR llave LIKE '006-%' OR llave LIKE '008-%') 
           AND llave NOT LIKE '%-G%' 
           AND llave NOT LIKE '%-S%'`
    );

    console.log('\n=== REPORTE FINAL DE VERIFICACIÓN EN RRS ===');
    console.log(`Movimientos Pista (-G):   ${gasMovs[0].count} registros | Total: $${Number(gasMovs[0].total).toFixed(2)}`);
    console.log(`Movimientos Tienda (-S):  ${salesMovs[0].count} registros | Total: $${Number(salesMovs[0].total).toFixed(2)}`);
    console.log(`Llaves legacy restantes:  ${remainingLegacy[0].count}`);
    console.log('============================================\n');

    process.exit(0);
}

runRegularization().catch(err => {
    console.error('Error fatal durante la regularización:', err);
    process.exit(1);
});
