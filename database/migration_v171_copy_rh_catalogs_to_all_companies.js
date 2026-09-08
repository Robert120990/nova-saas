const pool = require('../server/src/config/db');

/**
 * Migration v171: Copy HR module catalogs from Company 1 to all other companies.
 * 
 * Excludes:
 * - rh_cargos (Job positions)
 * - rh_departamentos (HR departments)
 * 
 * Includes:
 * - rh_afp
 * - rh_afp_tasas (re-mapped to company afp_id)
 * - rh_cuentas_planillas
 * - rh_descuentos_programados (re-mapped to company cuenta_id)
 * - rh_isss_tasas
 * - rh_renta_config & rh_renta_config_detalle
 * - rh_aguinaldo_config & rh_aguinaldo_config_detalle
 * - rh_salario_minimo_config
 * - rh_tipos_contrato
 */
async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('Starting Migration v171: Copying HR catalogs from Company 1 to all companies...');

        // 1. Fetch all target companies (excluding company 1)
        const [companies] = await connection.query(
            'SELECT id, razon_social FROM companies WHERE id != 1 ORDER BY id'
        );

        if (companies.length === 0) {
            console.log('No target companies found to copy HR catalogs.');
            return;
        }

        console.log(`Found ${companies.length} target companies:`, companies.map(c => `[ID ${c.id}] ${c.razon_social}`).join(', '));

        // 2. Read master catalog data from Company 1
        // 2.1 AFPs
        const [sourceAfps] = await connection.query(
            'SELECT id, codigo, descripcion FROM rh_afp WHERE company_id = 1 ORDER BY id'
        );

        // 2.2 AFP Tasas
        const [sourceAfpTasas] = await connection.query(`
            SELECT afp_id, 
                   DATE_FORMAT(fecha_desde, '%Y-%m-%d') AS fecha_desde, 
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') AS fecha_hasta,
                   porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual
            FROM rh_afp_tasas 
            WHERE company_id = 1 
            ORDER BY id
        `);

        // 2.3 Cuentas Planillas
        const [sourceCuentas] = await connection.query(`
            SELECT id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden
            FROM rh_cuentas_planillas 
            WHERE company_id = 1 
            ORDER BY orden, id
        `);

        // 2.4 Descuentos Programados
        const [sourceDescuentos] = await connection.query(
            'SELECT id, cuenta_id, codigo, descripcion FROM rh_descuentos_programados WHERE company_id = 1 ORDER BY id'
        );

        // 2.5 ISSS Tasas
        const [sourceIsssTasas] = await connection.query(`
            SELECT DATE_FORMAT(fecha_desde, '%Y-%m-%d') AS fecha_desde, 
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') AS fecha_hasta,
                   porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual
            FROM rh_isss_tasas 
            WHERE company_id = 1 
            ORDER BY id
        `);

        // 2.6 Renta Config & Details
        const [sourceRentaConfigs] = await connection.query(`
            SELECT id, tipo, 
                   DATE_FORMAT(fecha_desde, '%Y-%m-%d') AS fecha_desde, 
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') AS fecha_hasta
            FROM rh_renta_config 
            WHERE company_id = 1 
            ORDER BY id
        `);
        const sourceRentaDetailsMap = {};
        for (const rc of sourceRentaConfigs) {
            const [details] = await connection.query(
                'SELECT sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle WHERE renta_config_id = ? ORDER BY sueldo_inicial',
                [rc.id]
            );
            sourceRentaDetailsMap[rc.id] = details;
        }

        // 2.7 Aguinaldo Config & Details
        const [sourceAguinaldoConfigs] = await connection.query(`
            SELECT id, 
                   DATE_FORMAT(fecha_desde, '%Y-%m-%d') AS fecha_desde, 
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') AS fecha_hasta
            FROM rh_aguinaldo_config 
            WHERE company_id = 1 
            ORDER BY id
        `);
        const sourceAguinaldoDetailsMap = {};
        for (const ac of sourceAguinaldoConfigs) {
            const [details] = await connection.query(
                'SELECT anios_desde, anios_hasta, dias_aguinaldo FROM rh_aguinaldo_config_detalle WHERE aguinaldo_config_id = ? ORDER BY anios_desde',
                [ac.id]
            );
            sourceAguinaldoDetailsMap[ac.id] = details;
        }

        // 2.8 Salario Mínimo Config
        const [sourceSalarioMinimo] = await connection.query(`
            SELECT DATE_FORMAT(fecha_desde, '%Y-%m-%d') AS fecha_desde, 
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') AS fecha_hasta, 
                   monto
            FROM rh_salario_minimo_config 
            WHERE company_id = 1 
            ORDER BY id
        `);

        // 2.9 Tipos de Contrato
        const [sourceTiposContrato] = await connection.query(
            'SELECT codigo, descripcion FROM rh_tipos_contrato WHERE company_id = 1 ORDER BY id'
        );

        console.log(`Source data summary from Company 1:
        - AFPs: ${sourceAfps.length}
        - AFP Tasas: ${sourceAfpTasas.length}
        - Cuentas de Planillas: ${sourceCuentas.length}
        - Descuentos Programados: ${sourceDescuentos.length}
        - ISSS Tasas: ${sourceIsssTasas.length}
        - Renta Configs: ${sourceRentaConfigs.length}
        - Aguinaldo Configs: ${sourceAguinaldoConfigs.length}
        - Salario Mínimo Configs: ${sourceSalarioMinimo.length}
        - Tipos de Contrato: ${sourceTiposContrato.length}
        - EXCLUDED: Cargos and Departamentos (untouched)`);

        // 3. Process each target company inside transactions
        for (const company of companies) {
            const targetCompanyId = company.id;
            console.log(`\n--- Processing Company ${targetCompanyId}: ${company.razon_social} ---`);
            await connection.beginTransaction();

            try {
                // 3.1 rh_afp
                const afpIdMap = {}; // sourceAfpId -> targetAfpId
                for (const afp of sourceAfps) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_afp WHERE company_id = ? AND codigo = ?',
                        [targetCompanyId, afp.codigo]
                    );

                    let targetAfpId;
                    if (existing.length > 0) {
                        targetAfpId = existing[0].id;
                        await connection.query(
                            'UPDATE rh_afp SET descripcion = ? WHERE id = ?',
                            [afp.descripcion, targetAfpId]
                        );
                    } else {
                        const [res] = await connection.query(
                            'INSERT INTO rh_afp (company_id, codigo, descripcion) VALUES (?, ?, ?)',
                            [targetCompanyId, afp.codigo, afp.descripcion]
                        );
                        targetAfpId = res.insertId;
                    }
                    afpIdMap[afp.id] = targetAfpId;
                }
                console.log(`  [OK] rh_afp copied/synced (${sourceAfps.length} items).`);

                // 3.2 rh_afp_tasas
                for (const tasa of sourceAfpTasas) {
                    const targetAfpId = afpIdMap[tasa.afp_id];
                    if (!targetAfpId) continue;

                    const [existing] = await connection.query(
                        'SELECT id FROM rh_afp_tasas WHERE company_id = ? AND afp_id = ? AND fecha_desde = ?',
                        [targetCompanyId, targetAfpId, tasa.fecha_desde]
                    );

                    if (existing.length > 0) {
                        await connection.query(`
                            UPDATE rh_afp_tasas 
                            SET fecha_hasta = ?, porcentaje_empleado = ?, porcentaje_patrono = ?, tope_quincenal = ?, tope_mensual = ?
                            WHERE id = ?
                        `, [tasa.fecha_hasta, tasa.porcentaje_empleado, tasa.porcentaje_patrono, tasa.tope_quincenal, tasa.tope_mensual, existing[0].id]);
                    } else {
                        await connection.query(`
                            INSERT INTO rh_afp_tasas (company_id, afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [targetCompanyId, targetAfpId, tasa.fecha_desde, tasa.fecha_hasta, tasa.porcentaje_empleado, tasa.porcentaje_patrono, tasa.tope_quincenal, tasa.tope_mensual]);
                    }
                }
                console.log(`  [OK] rh_afp_tasas copied/synced (${sourceAfpTasas.length} items).`);

                // 3.3 rh_cuentas_planillas
                const cuentaIdMap = {}; // sourceCuentaId -> targetCuentaId
                for (const c of sourceCuentas) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_cuentas_planillas WHERE company_id = ? AND codigo = ?',
                        [targetCompanyId, c.codigo]
                    );

                    let targetCuentaId;
                    if (existing.length > 0) {
                        targetCuentaId = existing[0].id;
                        await connection.query(`
                            UPDATE rh_cuentas_planillas 
                            SET descripcion = ?, operacion = ?, tipo_valor = ?, activa = ?, aparece_recibos = ?, aparece_planilla = ?, orden = ?
                            WHERE id = ?
                        `, [c.descripcion, c.operacion, c.tipo_valor, c.activa, c.aparece_recibos, c.aparece_planilla, c.orden, targetCuentaId]);
                    } else {
                        const [res] = await connection.query(`
                            INSERT INTO rh_cuentas_planillas (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [targetCompanyId, c.codigo, c.descripcion, c.operacion, c.tipo_valor, c.activa, c.aparece_recibos, c.aparece_planilla, c.orden]);
                        targetCuentaId = res.insertId;
                    }
                    cuentaIdMap[c.id] = targetCuentaId;
                }
                console.log(`  [OK] rh_cuentas_planillas copied/synced (${sourceCuentas.length} items).`);

                // 3.4 rh_descuentos_programados
                for (const d of sourceDescuentos) {
                    const targetCuentaId = d.cuenta_id ? (cuentaIdMap[d.cuenta_id] || null) : null;
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_descuentos_programados WHERE company_id = ? AND codigo = ?',
                        [targetCompanyId, d.codigo]
                    );

                    if (existing.length > 0) {
                        await connection.query(`
                            UPDATE rh_descuentos_programados 
                            SET cuenta_id = ?, descripcion = ?
                            WHERE id = ?
                        `, [targetCuentaId, d.descripcion, existing[0].id]);
                    } else {
                        await connection.query(`
                            INSERT INTO rh_descuentos_programados (company_id, cuenta_id, codigo, descripcion)
                            VALUES (?, ?, ?, ?)
                        `, [targetCompanyId, targetCuentaId, d.codigo, d.descripcion]);
                    }
                }
                console.log(`  [OK] rh_descuentos_programados copied/synced (${sourceDescuentos.length} items).`);

                // 3.5 rh_isss_tasas
                for (const isss of sourceIsssTasas) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_isss_tasas WHERE company_id = ? AND fecha_desde = ?',
                        [targetCompanyId, isss.fecha_desde]
                    );

                    if (existing.length > 0) {
                        await connection.query(`
                            UPDATE rh_isss_tasas 
                            SET fecha_hasta = ?, porcentaje_empleado = ?, porcentaje_patrono = ?, tope_quincenal = ?, tope_mensual = ?
                            WHERE id = ?
                        `, [isss.fecha_hasta, isss.porcentaje_empleado, isss.porcentaje_patrono, isss.tope_quincenal, isss.tope_mensual, existing[0].id]);
                    } else {
                        await connection.query(`
                            INSERT INTO rh_isss_tasas (company_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [targetCompanyId, isss.fecha_desde, isss.fecha_hasta, isss.porcentaje_empleado, isss.porcentaje_patrono, isss.tope_quincenal, isss.tope_mensual]);
                    }
                }
                console.log(`  [OK] rh_isss_tasas copied/synced (${sourceIsssTasas.length} items).`);

                // 3.6 rh_renta_config & details
                for (const rc of sourceRentaConfigs) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_renta_config WHERE company_id = ? AND tipo = ? AND fecha_desde = ?',
                        [targetCompanyId, rc.tipo, rc.fecha_desde]
                    );

                    let targetRentaConfigId;
                    if (existing.length > 0) {
                        targetRentaConfigId = existing[0].id;
                        await connection.query(
                            'UPDATE rh_renta_config SET fecha_hasta = ? WHERE id = ?',
                            [rc.fecha_hasta, targetRentaConfigId]
                        );
                    } else {
                        const [res] = await connection.query(
                            'INSERT INTO rh_renta_config (company_id, tipo, fecha_desde, fecha_hasta) VALUES (?, ?, ?, ?)',
                            [targetCompanyId, rc.tipo, rc.fecha_desde, rc.fecha_hasta]
                        );
                        targetRentaConfigId = res.insertId;
                    }

                    // Replace details
                    await connection.query('DELETE FROM rh_renta_config_detalle WHERE renta_config_id = ?', [targetRentaConfigId]);
                    const details = sourceRentaDetailsMap[rc.id] || [];
                    for (const det of details) {
                        await connection.query(`
                            INSERT INTO rh_renta_config_detalle (renta_config_id, sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [targetRentaConfigId, det.sueldo_inicial, det.sueldo_final, det.porcentaje, det.valor_descuento, det.exceso]);
                    }
                }
                console.log(`  [OK] rh_renta_config and details copied/synced (${sourceRentaConfigs.length} headers).`);

                // 3.7 rh_aguinaldo_config & details
                for (const ac of sourceAguinaldoConfigs) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_aguinaldo_config WHERE company_id = ? AND fecha_desde = ?',
                        [targetCompanyId, ac.fecha_desde]
                    );

                    let targetAguinaldoConfigId;
                    if (existing.length > 0) {
                        targetAguinaldoConfigId = existing[0].id;
                        await connection.query(
                            'UPDATE rh_aguinaldo_config SET fecha_hasta = ? WHERE id = ?',
                            [ac.fecha_hasta, targetAguinaldoConfigId]
                        );
                    } else {
                        const [res] = await connection.query(
                            'INSERT INTO rh_aguinaldo_config (company_id, fecha_desde, fecha_hasta) VALUES (?, ?, ?)',
                            [targetCompanyId, ac.fecha_desde, ac.fecha_hasta]
                        );
                        targetAguinaldoConfigId = res.insertId;
                    }

                    // Replace details
                    await connection.query('DELETE FROM rh_aguinaldo_config_detalle WHERE aguinaldo_config_id = ?', [targetAguinaldoConfigId]);
                    const details = sourceAguinaldoDetailsMap[ac.id] || [];
                    for (const det of details) {
                        await connection.query(`
                            INSERT INTO rh_aguinaldo_config_detalle (aguinaldo_config_id, anios_desde, anios_hasta, dias_aguinaldo)
                            VALUES (?, ?, ?, ?)
                        `, [targetAguinaldoConfigId, det.anios_desde, det.anios_hasta, det.dias_aguinaldo]);
                    }
                }
                console.log(`  [OK] rh_aguinaldo_config and details copied/synced (${sourceAguinaldoConfigs.length} headers).`);

                // 3.8 rh_salario_minimo_config
                for (const sm of sourceSalarioMinimo) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_salario_minimo_config WHERE company_id = ? AND fecha_desde = ?',
                        [targetCompanyId, sm.fecha_desde]
                    );

                    if (existing.length > 0) {
                        await connection.query(
                            'UPDATE rh_salario_minimo_config SET fecha_hasta = ?, monto = ? WHERE id = ?',
                            [sm.fecha_hasta, sm.monto, existing[0].id]
                        );
                    } else {
                        await connection.query(
                            'INSERT INTO rh_salario_minimo_config (company_id, fecha_desde, fecha_hasta, monto) VALUES (?, ?, ?, ?)',
                            [targetCompanyId, sm.fecha_desde, sm.fecha_hasta, sm.monto]
                        );
                    }
                }
                console.log(`  [OK] rh_salario_minimo_config copied/synced (${sourceSalarioMinimo.length} items).`);

                // 3.9 rh_tipos_contrato
                for (const tc of sourceTiposContrato) {
                    const [existing] = await connection.query(
                        'SELECT id FROM rh_tipos_contrato WHERE company_id = ? AND codigo = ?',
                        [targetCompanyId, tc.codigo]
                    );

                    if (existing.length > 0) {
                        await connection.query(
                            'UPDATE rh_tipos_contrato SET descripcion = ? WHERE id = ?',
                            [tc.descripcion, existing[0].id]
                        );
                    } else {
                        await connection.query(
                            'INSERT INTO rh_tipos_contrato (company_id, codigo, descripcion) VALUES (?, ?, ?)',
                            [targetCompanyId, tc.codigo, tc.descripcion]
                        );
                    }
                }
                console.log(`  [OK] rh_tipos_contrato copied/synced (${sourceTiposContrato.length} items).`);

                await connection.commit();
                console.log(`Successfully completed all catalog copies for Company ${targetCompanyId}.`);
            } catch (err) {
                await connection.rollback();
                console.error(`Error copying catalogs to Company ${targetCompanyId}:`, err);
                throw err;
            }
        }

        console.log('\nMigration v171 finished successfully for all companies!');
    } catch (error) {
        console.error('Fatal error in Migration v171:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
