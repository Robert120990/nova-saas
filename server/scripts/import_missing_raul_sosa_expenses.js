const pool = require('../src/config/db');

async function runImport(isCommit = false) {
    const conn = await pool.getConnection();

    console.log(`\n======================================================`);
    console.log(`IMPORTACIÓN DE GASTOS FALTANTES - RAÚL SOSA (EMPRESA 2)`);
    console.log(`Modo: ${isCommit ? 'COMMIT REAL (ESCRITURA)' : 'SIMULACIÓN (DRY RUN)'}`);
    console.log(`======================================================\n`);

    try {
        await conn.beginTransaction();

        // 1. Verificar registros actuales de usuarios para garantizar que no se tocan
        const [userCountsBefore] = await conn.query(`
            SELECT usuario_id, COUNT(*) as cnt 
            FROM expense_headers 
            WHERE company_id = 2 
            GROUP BY usuario_id
        `);
        console.log('--- Conteo previo en Empresa 2 por usuario ---');
        console.table(userCountsBefore);

        const countSandraBefore = userCountsBefore.find(u => u.usuario_id === 17)?.cnt || 0;
        const countTaniaBefore = userCountsBefore.find(u => u.usuario_id === 50)?.cnt || 0;

        // 2. Obtener sucursales en destino (Empresa 2)
        const [targetBranches] = await conn.query(`
            SELECT id, nombre, codigo 
            FROM branches 
            WHERE company_id = 2
        `);
        console.log('--- Sucursales en destino (Empresa 2) ---');
        console.table(targetBranches);

        // 3. Obtener sucursales en origen (cod_emp = 3) para guiarse por el NOMBRE
        const [originBranches] = await conn.query(`
            SELECT id as cod_sucursal, descripcion as nombre_sucursal
            FROM db_control_iva.sucursales
            WHERE cod_emp = 3
        `);
        console.log('--- Sucursales en origen (db_control_iva, cod_emp = 3) ---');
        console.table(originBranches);

        // Mapeo dinámico guiado por el nombre de la sucursal en el origen
        const branchMapByOriginCode = {};
        for (const ob of originBranches) {
            const desc = (ob.nombre_sucursal || '').toUpperCase();
            let matchedTarget = null;

            if (desc.includes('SUPER') || desc.includes('PEDREGAL')) {
                matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('PEDREGAL') || tb.nombre.toUpperCase().includes('SUPER'));
            } else if (desc.includes('CHALCHUAPA')) {
                matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('CHALCHUAPA'));
            } else if (desc.includes('MIRAFLORES')) {
                // En la migración previa de Raúl Sosa, Miraflores se integró en Shell Chalchuapa
                matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('CHALCHUAPA'));
            }

            if (matchedTarget) {
                branchMapByOriginCode[ob.cod_sucursal] = {
                    branch_id: matchedTarget.id,
                    target_nombre: matchedTarget.nombre,
                    origin_nombre: ob.nombre_sucursal
                };
            }
        }
        console.log('\n--- Mapeo Sucursales (Origen -> Destino por Nombre) ---');
        console.log(branchMapByOriginCode);

        // 4. Proveedores en destino para Empresa 2
        const [targetProviders] = await conn.query(`
            SELECT id, nombre, nrc, nit 
            FROM providers 
            WHERE company_id = 2 AND (nrc IN ('471-5', '164936-4') OR nombre LIKE '%CASCADA%' OR nombre LIKE '%COBEA%')
        `);
        console.log('\n--- Proveedores en destino (Empresa 2) ---');
        console.table(targetProviders);

        const cascadaProv = targetProviders.find(p => p.nrc === '471-5' || p.nombre.toUpperCase().includes('CASCADA'));
        const cobeaProv = targetProviders.find(p => p.nrc === '164936-4' || p.nombre.toUpperCase().includes('COBEA'));

        if (!cascadaProv || !cobeaProv) {
            throw new Error('No se encontraron los proveedores destino para La Cascada o Cobea en Empresa 2.');
        }

        const providerMap = {
            '471-5': cascadaProv.id,
            '164936-4': cobeaProv.id
        };

        // 5. Buscar los registros faltantes en db_control_iva
        const [missing] = await conn.query(`
            SELECT src.*,
                   p_src.nom_proveedor, p_src.registro as p_nrc, p_src.nit_proveedor as p_nit
            FROM db_control_iva.compras_iva src
            LEFT JOIN db_control_iva.proveedores p_src ON src.cod_proveedor = p_src.cod_proveedor AND src.cod_emp = p_src.cod_emp
            WHERE src.cod_emp = 3 AND src.periodo_ano = 2026
              AND NOT EXISTS (
                  SELECT 1 FROM expense_headers eh
                  WHERE eh.company_id = 2
                    AND eh.tipo_documento_id = src.id_tipo_documento
                    AND eh.numero_documento = src.documento
                    AND eh.fecha = src.fecha
              )
            ORDER BY src.fecha ASC
        `);

        console.log(`\nRegistros faltantes detectados en origen: ${missing.length}`);

        if (missing.length !== 47) {
            console.warn(`ADVERTENCIA: Se esperaban 47 registros faltantes, se encontraron ${missing.length}.`);
        }

        // 6. Preparar inserciones
        let insertedCount = 0;
        for (const r of missing) {
            const branchMapping = branchMapByOriginCode[r.cod_sucursal];
            if (!branchMapping) {
                throw new Error(`Sucursal origen sin mapeo por nombre: código ${r.cod_sucursal}`);
            }

            const providerId = providerMap[r.p_nrc];
            if (!providerId) {
                throw new Error(`Proveedor sin mapeo: NRC ${r.p_nrc} (${r.nom_proveedor})`);
            }

            const totalGravada = parseFloat(r.gravadas_locales || 0);
            const totalExenta = parseFloat(r.exentas_locales || 0);
            const totalNosujeta = parseFloat(r.no_sujetas || 0);
            const iva = parseFloat(r.credito_fiscal || 0);
            const retencion = parseFloat(r.iva_retenido || 0) + parseFloat(r.retencion_a_terceros || 0);
            const percepcion = parseFloat(r.iva_percibido || 0);
            const anticipoCuenta = parseFloat(r.anticipo_a_cuenta || 0);
            const montoSujeto = parseFloat(r.monto_sujeto || 0);
            const montoTotal = Math.round((totalGravada + totalExenta + totalNosujeta + iva - retencion + percepcion) * 100) / 100;

            const insertSql = `
                INSERT INTO expense_headers (
                    company_id, branch_id, usuario_id, provider_id, fecha,
                    numero_documento, codigo_generacion, tipo_documento_id, condicion_operacion_id, observaciones,
                    total_nosujeta, total_exenta, total_gravada, iva, retencion,
                    percepcion, fovial, cotrans, anticipo_cuenta, monto_sujeto,
                    monto_total, status, period_year, period_month,
                    num_control, tipo_operacion, tipo_clasificacion, tipo_sector, tipo_costo,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, NULL, ?, '01', ?,
                    ?, ?, ?, ?, ?,
                    ?, 0, 0, ?, ?,
                    ?, 'ACTIVO', ?, ?,
                    ?, ?, ?, ?, ?,
                    NOW(), NOW()
                )
            `;

            const insertParams = [
                2,                                                 // company_id
                branchMapping.branch_id,                           // branch_id mapeado por nombre
                1,                                                 // usuario_id = 1 (migración)
                providerId,                                        // provider_id
                r.fecha,                                           // fecha
                r.documento,                                       // numero_documento
                r.id_tipo_documento,                               // tipo_documento_id ('02')
                `GASTO IMPORTADO COMPRAS_IVA (SERIE: ${r.serie || r.documento})`, // observaciones
                totalNosujeta,
                totalExenta,
                totalGravada,
                iva,
                retencion,
                percepcion,
                anticipoCuenta,
                montoSujeto,
                montoTotal,
                r.periodo_ano,
                r.periodo_mes,
                r.serie || r.documento,                            // num_control
                r.id_operacion || '1',
                r.id_clasificacion || '1',
                r.id_sector || '2',
                r.id_tipocosto || '5'
            ];

            await conn.query(insertSql, insertParams);
            insertedCount++;
        }

        console.log(`\nInserciones preparadas: ${insertedCount}`);

        // 7. Verificación de integridad: asegurar que Sandra y Tania no fueron tocadas
        const [userCountsAfter] = await conn.query(`
            SELECT usuario_id, COUNT(*) as cnt 
            FROM expense_headers 
            WHERE company_id = 2 
            GROUP BY usuario_id
        `);
        console.log('\n--- Conteo posterior en Empresa 2 por usuario ---');
        console.table(userCountsAfter);

        const countSandraAfter = userCountsAfter.find(u => u.usuario_id === 17)?.cnt || 0;
        const countTaniaAfter = userCountsAfter.find(u => u.usuario_id === 50)?.cnt || 0;

        if (countSandraBefore !== countSandraAfter) {
            throw new Error(`VIOLACIÓN DE INTEGRIDAD: Registros de Sandra cambiaron de ${countSandraBefore} a ${countSandraAfter}!`);
        }
        if (countTaniaBefore !== countTaniaAfter) {
            throw new Error(`VIOLACIÓN DE INTEGRIDAD: Registros de Tania cambiaron de ${countTaniaBefore} a ${countTaniaAfter}!`);
        }

        console.log('✅ Verificación de integridad superada: Los datos nuevos de Sandra y Tania permanecen 100% INTACTOS.');

        if (isCommit) {
            await conn.commit();
            console.log(`\n🎉 COMMIT REAL COMPLETADO CON ÉXITO: ${insertedCount} gastos importados en Empresa 2.`);
        } else {
            await conn.rollback();
            console.log(`\nℹ️ ROLLBACK COMPLETADO (DRY RUN). La base de datos no fue modificada.`);
        }

    } catch (err) {
        await conn.rollback();
        console.error('\n❌ ERROR DURANTE LA IMPORTACIÓN (TRANSACCIÓN ABORTADA):', err);
        throw err;
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

const isCommitArg = process.argv.includes('--commit');
runImport(isCommitArg).catch(() => process.exit(1));
