const pool = require('../src/config/db');

async function main() {
    const isCommit = process.argv.includes('--commit');
    console.log(`\n======================================================`);
    console.log(`  REGULARIZACIÓN DE IVA FILPRO - SHELL CHALCHUAPA`);
    console.log(`  MODO: ${isCommit ? '*** COMMIT (ESCRITURA REAL) ***' : '[DRY-RUN (SOLO LECTURA / SIMULACIÓN)]'}`);
    console.log(`======================================================\n`);

    const connection = await pool.getConnection();

    try {
        // FASE 2: Respaldo Preventivo de Datos
        const backupTable = 'sales_headers_backup_chalchuapa_20261007';
        const [tableCheck] = await connection.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [backupTable]
        );

        if (tableCheck.length === 0) {
            console.log(`[FASE 2: RESPALDO] Creando tabla de respaldo preventiva: ${backupTable}...`);
            await connection.query(`
                CREATE TABLE ${backupTable} AS 
                SELECT * FROM sales_headers 
                WHERE branch_id = 3 AND tipo_documento = '01' AND observaciones LIKE '%FilPro%'
            `);
            const [[{ count }]] = await connection.query(`SELECT COUNT(*) as count FROM ${backupTable}`);
            console.log(`[FASE 2: RESPALDO] Respaldo completado exitosamente: ${count} registros asegurados.\n`);
        } else {
            console.log(`[FASE 2: RESPALDO] La tabla de respaldo ${backupTable} ya existe. Se mantiene intacta.\n`);
        }

        // FASE 3 / 4: Carga y análisis de registros a regularizar
        console.log(`[CONSULTA] Obteniendo ventas de Shell Chalchuapa DTE 01 (FilPro)...`);
        const [sales] = await connection.query(`
            SELECT sh.id, sh.codigo_generacion, sh.numero_control, sh.fecha_emision,
                   sh.total_gravado, sh.total_exento, sh.total_nosujetas,
                   sh.fovial, sh.cotrans, sh.total_iva, sh.total_pagar,
                   d.json_original
            FROM sales_headers sh
            LEFT JOIN (
                SELECT dd.venta_id, dd.json_original
                FROM dtes dd
                INNER JOIN (
                    SELECT venta_id, MAX(id) AS max_id
                    FROM dtes
                    WHERE venta_id IS NOT NULL
                    GROUP BY venta_id
                ) dm ON dm.max_id = dd.id
            ) d ON sh.id = d.venta_id
            WHERE sh.branch_id = 3 
              AND sh.tipo_documento = '01' 
              AND sh.observaciones LIKE '%FilPro%'
            ORDER BY sh.id ASC
        `);

        console.log(`[CONSULTA] Se encontraron ${sales.length} ventas para procesar.\n`);

        let updatedCount = 0;
        let alreadyCorrectCount = 0;
        let totalIvaAdded = 0;

        // Estructuras para resumen mensual
        const monthlyStats = {};

        const updates = [];

        for (const s of sales) {
            const currentGrav = parseFloat(s.total_gravado || 0);
            const currentIva = parseFloat(s.total_iva || 0);
            const currentFovial = parseFloat(s.fovial || 0);
            const currentCotrans = parseFloat(s.cotrans || 0);
            const currentExento = parseFloat(s.total_exento || 0);
            const currentNoSujeto = parseFloat(s.total_nosujetas || 0);
            const totalPagar = parseFloat(s.total_pagar || 0);

            const dObj = new Date(s.fecha_emision);
            const yrMo = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyStats[yrMo]) {
                monthlyStats[yrMo] = {
                    count: 0,
                    oldGrav: 0, newGrav: 0,
                    oldIva: 0, newIva: 0,
                    fovial: 0, cotrans: 0, total: 0
                };
            }
            const m = monthlyStats[yrMo];
            m.count++;
            m.oldGrav += currentGrav;
            m.oldIva += currentIva;
            m.fovial += currentFovial;
            m.cotrans += currentCotrans;
            m.total += totalPagar;

            // Si ya tiene IVA y no necesita corrección:
            // Comprobamos si currentGrav + currentIva + fovial + cotrans == totalPagar
            const balanceWithoutChange = Math.abs((currentGrav + currentIva + currentFovial + currentCotrans + currentExento + currentNoSujeto) - totalPagar);
            if (currentIva > 0 && balanceWithoutChange <= 0.05) {
                alreadyCorrectCount++;
                m.newGrav += currentGrav;
                m.newIva += currentIva;
                continue;
            }

            // Extraer IVA del DTE JSON
            let calculatedIva = 0;
            let dteJson = null;
            if (s.json_original) {
                dteJson = typeof s.json_original === 'string' ? JSON.parse(s.json_original) : s.json_original;
            }

            const res = dteJson?.resumen || {};
            if (res.totalIva && parseFloat(res.totalIva) > 0) {
                calculatedIva = parseFloat(res.totalIva);
            } else if (Array.isArray(dteJson?.cuerpoDocumento) && dteJson.cuerpoDocumento.length > 0) {
                const sumItemIva = dteJson.cuerpoDocumento.reduce((acc, it) => acc + (parseFloat(it.ivaItem) || 0), 0);
                if (sumItemIva > 0) calculatedIva = Math.round(sumItemIva * 100) / 100;
            }

            // Fallback legal si no vino en el JSON: formula 13% sobre base
            if (calculatedIva === 0 && currentGrav > 0) {
                calculatedIva = Math.round((currentGrav - (currentGrav / 1.13)) * 100) / 100;
            }

            // Nueva base gravada neta
            let newGrav = Math.round((currentGrav - calculatedIva) * 100) / 100;

            // Blindaje de centavos exactos para que la ecuación cuadre 100% al centavo con totalPagar
            const sumCheck = newGrav + calculatedIva + currentFovial + currentCotrans + currentExento + currentNoSujeto;
            const diffCentavos = Math.round((totalPagar - sumCheck) * 100) / 100;
            if (Math.abs(diffCentavos) > 0 && Math.abs(diffCentavos) <= 0.05) {
                newGrav = Math.round((newGrav + diffCentavos) * 100) / 100;
            }

            m.newGrav += newGrav;
            m.newIva += calculatedIva;
            totalIvaAdded += calculatedIva;
            updatedCount++;

            updates.push({
                id: s.id,
                newGrav,
                newIva: calculatedIva
            });
        }

        console.log(`[RESUMEN DE PROCESAMIENTO]`);
        console.log(`  Total ventas evaluadas:      ${sales.length}`);
        console.log(`  Ventas a regularizar:         ${updatedCount}`);
        console.log(`  Ventas ya correctas:          ${alreadyCorrectCount}`);
        console.log(`  Total IVA a regularizar:      $ ${totalIvaAdded.toFixed(2)}\n`);

        console.log(`[COMPARATIVO MENSUAL (ANTES vs DESPUÉS)]`);
        console.log(`-----------------------------------------------------------------------------------------`);
        console.log(`Mes       | Trans | Gravadas Antes | Gravadas Nuevas | IVA Antes | IVA Nuevo  | Total Pagado`);
        console.log(`-----------------------------------------------------------------------------------------`);
        for (const [mo, st] of Object.entries(monthlyStats)) {
            console.log(
                `${mo}   | ${String(st.count).padStart(5)} | ` +
                `$${st.oldGrav.toFixed(2).padStart(12)} | ` +
                `$${st.newGrav.toFixed(2).padStart(13)} | ` +
                `$${st.oldIva.toFixed(2).padStart(7)} | ` +
                `$${st.newIva.toFixed(2).padStart(9)} | ` +
                `$${st.total.toFixed(2).padStart(11)}`
            );
        }
        console.log(`-----------------------------------------------------------------------------------------\n`);

        if (!isCommit) {
            console.log(`>>> MODO DRY-RUN COMPLETADO: No se realizaron cambios en la base de datos.`);
            console.log(`>>> Para aplicar estos cambios definitivamente, ejecuta: node server/scripts/repair-chalchuapa-iva.js --commit\n`);
        } else {
            console.log(`[FASE 4: ESCRITURA] Aplicando actualizaciones en lotes...`);
            await connection.beginTransaction();

            const batchSize = 500;
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);
                const ids = batch.map(u => u.id);
                const gravCases = batch.map(u => `WHEN ${u.id} THEN ${u.newGrav}`).join(' ');
                const ivaCases = batch.map(u => `WHEN ${u.id} THEN ${u.newIva}`).join(' ');
                await connection.query(`
                    UPDATE sales_headers 
                    SET total_gravado = CASE id ${gravCases} END,
                        total_iva = CASE id ${ivaCases} END
                    WHERE id IN (${ids.join(',')})
                `);
                console.log(`  Progreso: ${Math.min(i + batchSize, updates.length)} / ${updates.length} actualizados...`);
            }
            console.log(`\n  Guardando transacción (COMMIT)...`);
            await connection.commit();
            console.log(`[FASE 4: ESCRITURA] ¡Actualización finalizada con éxito! Todos los registros fueron regularizados.\n`);
        }

    } catch (err) {
        if (isCommit) {
            await connection.rollback().catch(() => {});
            console.error(`[ERROR] Ocurrió un error. Se ejecutó ROLLBACK:`, err);
        } else {
            console.error(`[ERROR]:`, err);
        }
    } finally {
        connection.release();
        await pool.end();
    }
}

main();
