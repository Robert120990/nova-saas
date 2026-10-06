/**
 * Sipe Web SaaS - Script de Saneamiento y Enriquecimiento de DTEs Históricos
 * 
 * Agrega 'selloRecibido' y 'firmaElectronica' en la raíz del json_original
 * para todos los DTEs aceptados por Hacienda que aún no los tienen incrustados.
 * 
 * Uso:
 *   node scripts/enrich_historical_dtes.js --dry-run   (Solo simula y muestra conteo)
 *   node scripts/enrich_historical_dtes.js             (Ejecuta la actualización en lotes)
 */

const pool = require('../server/src/config/db');
const { formatDeliveryDteJson } = require('../server/src/utils/dteDeliveryHelper');

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('='.repeat(70));
    console.log(`Iniciando Saneamiento de DTEs Históricos [Modo: ${isDryRun ? 'DRY-RUN (Simulación)' : 'PRODUCCIÓN (Actualización Real)'}]`);
    console.log('='.repeat(70));

    try {
        // 1. Contar registros elegibles
        const [countRows] = await pool.query(`
            SELECT COUNT(*) as total
            FROM dtes
            WHERE sello_recepcion IS NOT NULL
              AND TRIM(sello_recepcion) != ''
              AND (
                  json_original NOT LIKE '%"selloRecibido"%'
                  OR json_original NOT LIKE '%"firmaElectronica"%'
              )
        `);

        const totalPending = countRows[0].total;
        console.log(`Total de DTEs aceptados pendientes de enriquecer: ${totalPending}`);

        if (totalPending === 0) {
            console.log('✅ Todos los DTEs en la base de datos ya cuentan con selloRecibido y firmaElectronica.');
            process.exit(0);
        }

        if (isDryRun) {
            console.log('\n[Dry-Run] Simulación completada. Ejecuta sin --dry-run para aplicar los cambios.');
            process.exit(0);
        }

        // 2. Procesar en lotes de 200
        const batchSize = 200;
        let processed = 0;
        let updated = 0;

        while (true) {
            const [rows] = await pool.query(`
                SELECT id, codigo_generacion, numero_control, json_original, json_firmado, sello_recepcion
                FROM dtes
                WHERE sello_recepcion IS NOT NULL
                  AND TRIM(sello_recepcion) != ''
                  AND (
                      json_original NOT LIKE '%"selloRecibido"%'
                      OR json_original NOT LIKE '%"firmaElectronica"%'
                  )
                ORDER BY id ASC
                LIMIT ?
            `, [batchSize]);

            if (rows.length === 0) break;

            for (const r of rows) {
                processed++;
                try {
                    const enriched = formatDeliveryDteJson(r.json_original, r.json_firmado, r.sello_recepcion);
                    if (!enriched) continue;

                    const updatedJsonStr = JSON.stringify(enriched);

                    await pool.query(
                        'UPDATE dtes SET json_original = ? WHERE id = ?',
                        [updatedJsonStr, r.id]
                    );
                    updated++;
                } catch (rowErr) {
                    console.error(`Error procesando DTE ID ${r.id} (${r.codigo_generacion}):`, rowErr.message);
                }
            }

            console.log(`Lote completado: ${processed} de ${totalPending} procesados (${updated} actualizados)...`);
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ Saneamiento finalizado con éxito.`);
        console.log(`Total procesados: ${processed} | Total actualizados: ${updated}`);
        console.log('='.repeat(70));

        process.exit(0);
    } catch (err) {
        console.error('Error fatal durante el saneamiento:', err);
        process.exit(1);
    }
}

main();
