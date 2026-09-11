/**
 * CLI Script to Synchronize DTEs from FilPro (Infile) to Nova SaaS
 * Usage:
 *   node server/scripts/sync-filpro.js --company=2 --branch=3 --date=2026-09-10
 *   node server/scripts/sync-filpro.js --company=2 --branch=3 --from=2026-09-01 --to=2026-09-10
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/db');
const filproExtractor = require('../src/services/filproExtractor.service');
const filproIngestion = require('../src/services/filproIngestion.service');

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};
    for (const arg of args) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            parsed[key] = value !== undefined ? value : true;
        }
    }
    return parsed;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateRange(fromStr, toStr) {
    const dates = [];
    let curr = new Date(fromStr + 'T00:00:00');
    const end = new Date(toStr + 'T00:00:00');

    while (curr <= end) {
        dates.push(formatDate(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

async function run() {
    const args = parseArgs();
    const companyId = parseInt(args.company || 2, 10);
    const branchId = parseInt(args.branch || 3, 10);
    const singleDate = args.date;
    const fromDate = args.from;
    const toDate = args.to;
    const establishmentCode = args.establishment || '';

    if (!singleDate && (!fromDate || !toDate)) {
        console.error('Error: Debe especificar --date=YYYY-MM-DD o bien un rango --from=YYYY-MM-DD --to=YYYY-MM-DD');
        process.exit(1);
    }

    const datesToProcess = singleDate ? [singleDate] : getDateRange(fromDate, toDate);
    const isRevertMode = !!args.revert;

    console.log('====================================================');
    console.log(`         ${isRevertMode ? 'REVERSIÓN DE INSERCIÓN' : 'SINCRONIZACIÓN DE DTES'} - FILPRO → NOVA SAAS`);
    console.log('====================================================');
    console.log(`Empresa ID:      ${companyId}`);
    console.log(`Sucursal ID:     ${branchId}`);
    console.log(`Modo:            ${isRevertMode ? 'REVERSIÓN / ELIMINACIÓN' : 'IMPORTACIÓN'}`);
    console.log(`Fechas a procesar: ${datesToProcess.length} día(s) [${datesToProcess[0]} → ${datesToProcess[datesToProcess.length - 1]}]`);
    console.log('====================================================\n');

    if (isRevertMode) {
        for (const dateStr of datesToProcess) {
            console.log(`>>> Revirtiendo DTEs importados para la fecha: ${dateStr}...`);
            const res = await filproIngestion.revertDay({
                companyId,
                dateStr,
                branchId,
                userId: 1
            });
            console.log(`    → ${res.message}`);
        }
        console.log('\n====================================================');
        console.log('         REVERSIÓN COMPLETADA CON ÉXITO');
        console.log('====================================================');
        process.exit(0);
    }

    // 1. Check connection config
    const [configRows] = await pool.query(
        'SELECT * FROM filpro_connections WHERE company_id = ? LIMIT 1',
        [companyId]
    );

    if (configRows.length === 0) {
        console.error(`Error: No hay credenciales de FilPro configuradas para la empresa ID ${companyId}.`);
        console.error('Configure las credenciales primero desde la pantalla del sistema o en la tabla filpro_connections.');
        process.exit(1);
    }

    const config = configRows[0];
    const estCode = establishmentCode || config.filpro_establishment_code || '';

    let grandTotalFound = 0;
    let grandTotalImported = 0;
    let grandTotalSkipped = 0;
    let grandTotalErrors = 0;

    for (const dateStr of datesToProcess) {
        console.log(`>>> Procesando fecha: ${dateStr}...`);

        try {
            const documents = await filproExtractor.getDocumentsForDay(
                companyId,
                config.filpro_email,
                config.filpro_password,
                dateStr,
                estCode,
                config.filpro_company_id
            );

            console.log(`    DTEs encontrados en FilPro: ${documents.length}`);

            let dayImported = 0;
            let daySkipped = 0;
            let dayErrors = 0;

            for (const doc of documents) {
                try {
                    // Check if already in DB
                    const [exists] = await pool.query(
                        'SELECT id, status FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                        [doc.uuid, companyId]
                    );

                    const isAnulado = (doc.status === 'ANULADO' || doc.status === 'INVALIDADO');
                    if (exists.length === 0 && isAnulado) {
                        daySkipped++;
                        continue;
                    }
                    if (exists.length > 0 && (!isAnulado || exists[0].status === 'INVALIDADO')) {
                        daySkipped++;
                        continue;
                    }

                    // Download official JSON
                    const officialJson = await filproExtractor.downloadOfficialDteJson(doc.uuid);

                    // Ingest into Nova SaaS
                    const outcome = await filproIngestion.ingestDte({
                        companyId,
                        branchId,
                        userId: 1, // System / Admin
                        dteSummary: doc,
                        officialJson
                    });

                    if (outcome.status === 'imported' || outcome.status === 'updated_anulado') {
                        dayImported++;
                    } else {
                        daySkipped++;
                    }
                } catch (docErr) {
                    dayErrors++;
                    console.error(`      [!] Error en DTE ${doc.uuid} (${doc.numero_control}): ${docErr.message}`);
                }
            }

            grandTotalFound += documents.length;
            grandTotalImported += dayImported;
            grandTotalSkipped += daySkipped;
            grandTotalErrors += dayErrors;

            // Log day audit
            await pool.query('INSERT INTO filpro_sync_logs SET ?', [{
                company_id: companyId,
                branch_id: branchId,
                sync_date: dateStr,
                total_found: documents.length,
                total_imported: dayImported,
                total_skipped: daySkipped,
                total_errors: dayErrors,
                details: JSON.stringify({ cli: true, date: dateStr }),
                created_at: new Date()
            }]);

            console.log(`    → Resultado del día ${dateStr}: ${dayImported} importados, ${daySkipped} omitidos, ${dayErrors} errores\n`);

        } catch (dayErr) {
            console.error(`    [X] Error consultando día ${dateStr}: ${dayErr.message}\n`);
            grandTotalErrors++;
        }
    }

    // Update last sync date
    if (datesToProcess.length > 0) {
        await pool.query(
            'UPDATE filpro_connections SET last_sync_date = ?, last_sync_at = NOW() WHERE id = ?',
            [datesToProcess[datesToProcess.length - 1], config.id]
        );
    }

    console.log('====================================================');
    console.log('               RESUMEN DE SINCRONIZACIÓN');
    console.log('====================================================');
    console.log(`Total Documentos Encontrados: ${grandTotalFound}`);
    console.log(`Total Documentos Importados:  ${grandTotalImported}`);
    console.log(`Total Documentos Omitidos:    ${grandTotalSkipped}`);
    console.log(`Total Errores:                ${grandTotalErrors}`);
    console.log('====================================================');

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
});
