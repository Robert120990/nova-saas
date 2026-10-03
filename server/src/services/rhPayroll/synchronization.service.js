const { TABLE, isBonificacionCuenta } = require('./shared');

const sincronizarPlanilla = async (req, res, pool) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        // Verificar si el período ya fue cerrado/pagado
        const [cerradas] = await pool.query(
            `SELECT id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado = 'pagada' 
             LIMIT 1`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );
        if (cerradas.length > 0) {
            return res.status(400).json({
                message: 'No se puede sincronizar un período que ya está cerrado y pagado.'
            });
        }

        // 1. Empleados activos de la empresa
        const [empleados] = await pool.query(
            `SELECT id, sueldo_base, bonificacion_fija, afp_id, es_jubilado, aplica_renta, codigo, nombres, apellidos, en_vacaciones, incapacitado 
             FROM rh_empleados WHERE company_id = ? AND es_activo = 1`,
            [req.company_id]
        );

        if (empleados.length === 0) {
            return res.status(400).json({ message: 'No hay empleados activos en la empresa' });
        }

        // 2. Planillas registradas actualmente para este período
        const [existentes] = await pool.query(
            `SELECT id, empleado_id, dias_trabajados, sueldo_base, bonificacion_fija, total_percepciones, descuento_isss, descuento_afp, descuento_renta
             FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        const existentesMap = new Map(existentes.map(p => [p.empleado_id, p]));
        const missingEmps = empleados.filter(e => !existentesMap.has(e.id));

        // 3. Catálogo de cuentas activas
        const [cuentas] = await pool.query(
            `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
            [req.company_id]
        );

        // 4. Descuentos programados aplicables a esta quincena
        const [empDescuentos] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             WHERE ed.company_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [req.company_id, quincena]
        );

        // Catálogo de todos los descuentos programados para identificar qué cuentas corresponden a descuentos programados
        const [descuentosDef] = await pool.query(
            `SELECT DISTINCT cuenta_id, descripcion FROM rh_descuentos_programados WHERE company_id = ?`,
            [req.company_id]
        );
        const programmedCuentaIds = new Set(descuentosDef.map(d => d.cuenta_id).filter(Boolean));

        const today = new Date().toISOString().split('T')[0];

        // 5. Configuración de ISSS y Renta
        let isssTasa = null, isssTope = null;
        const [isssRows] = await pool.query(
            `SELECT porcentaje_empleado, tope_quincenal, tope_mensual FROM rh_isss_tasas 
             WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
             ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (isssRows.length > 0) {
            isssTasa = isssRows[0].porcentaje_empleado;
            isssTope = isssRows[0].tope_quincenal || (isssRows[0].tope_mensual ? isssRows[0].tope_mensual / 2 : Infinity);
        }

        // Renta: solo aplica en 2da quincena, usando tabla MENSUAL (tipo 'M')
        let rentaConfigId = null;
        let q1PlanillaMap = new Map();
        if (quincena === 'segunda') {
            const [rentaConfigRows] = await pool.query(
                `SELECT id, tipo FROM rh_renta_config 
                 WHERE company_id = ? AND tipo = 'M' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );
            if (rentaConfigRows.length > 0) rentaConfigId = rentaConfigRows[0].id;

            const [q1Rows] = await pool.query(
                `SELECT empleado_id, total_percepciones, descuento_isss, descuento_afp, descuento_renta
                 FROM ${TABLE}
                 WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = 'primera'`,
                [req.company_id, periodo_anio, periodo_mes]
            );
            for (const row of q1Rows) {
                q1PlanillaMap.set(row.empleado_id, row);
            }
        }

        let agregadosCount = 0;
        let actualizadosCount = 0;

        // A. Insertar empleados faltantes
        for (const emp of missingEmps) {
            const esAusente = emp.en_vacaciones === 1 || emp.incapacitado === 1;
            const dias = esAusente ? 0 : 15;
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const bonificacionFija = parseFloat(emp.bonificacion_fija || 0);
            const sueldoDiario = sueldoBase / 30;

            const [result] = await pool.query(
                `INSERT INTO ${TABLE} (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, emp.id, periodo_anio, periodo_mes, quincena, dias, sueldoBase, bonificacionFija]
            );
            const planillaId = result.insertId;

            const myDiscounts = empDescuentos.filter(d => d.empleado_id === emp.id);
            let totalPercepciones = 0;
            let totalDeduccionesCuentas = 0;

            const detalleValues = cuentas.map(c => {
                let valor = 0;
                let cantidad = 0;

                // Si el empleado está en vacaciones o incapacitado: todos los montos van a cero
                if (!esAusente) {
                    if (c.operacion === 'sumar') {
                            if (isBonificacionCuenta(c)) {
                                valor = Math.round(bonificacionFija * 100) / 100;
                                cantidad = valor;
                            } else if (c.tipo_valor === 'dias') {
                                if (c.codigo === '01') {
                                    cantidad = dias;
                                    valor = Math.round(sueldoDiario * dias * 100) / 100;
                                }
                            } else if (c.tipo_valor === 'valor') {
                                valor = parseFloat(c.valor_base || 0);
                                cantidad = valor;
                            } else if (c.tipo_valor === 'porcentaje') {
                                const pct = parseFloat(c.valor_base || 0);
                                cantidad = pct;
                                valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                            } else if (c.tipo_valor === 'horas') {
                                const hrs = parseFloat(c.valor_base || 0);
                                cantidad = hrs;
                                if (hrs > 0) {
                                    const isNocturna = (c.descripcion || '').toUpperCase().includes('NOCTURNA');
                                    const factor = isNocturna ? 2.5 : 2.0;
                                    valor = Math.round((sueldoDiario / 8 * factor) * hrs * 100) / 100;
                                }
                            }
                            totalPercepciones += valor;
                        } else {
                            const matchingDiscounts = myDiscounts.filter(d => {
                                if (d.cuenta_id && d.cuenta_id === c.id) return true;
                                const descD = (d.desc_nombre || '').toLowerCase();
                                const descC = (c.descripcion || '').toLowerCase();
                                if (descD.includes('prestamo') && descC.includes('prestamo')) return true;
                                if (descD.includes('procuraduria') && descC.includes('procuraduria')) return true;
                                if ((descD.includes('fondo social') || descD.includes('fsv')) && (descC.includes('fondo social') || descC.includes('fsv'))) return true;
                                if (descD.includes('anticipo') && descC.includes('anticipo')) return true;
                                return false;
                            });

                            if (matchingDiscounts.length > 0) {
                                const sumMonto = matchingDiscounts.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);
                                valor = Math.round(sumMonto * 100) / 100;
                                cantidad = valor;
                            } else if (c.tipo_valor === 'valor') {
                                valor = parseFloat(c.valor_base || 0);
                                cantidad = valor;
                            } else if (c.tipo_valor === 'porcentaje') {
                                const pct = parseFloat(c.valor_base || 0);
                                cantidad = pct;
                                valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                            }
                            totalDeduccionesCuentas += valor;
                        }
                    }

                return [planillaId, c.id, c.codigo, c.descripcion, c.operacion, c.tipo_valor, cantidad || null, valor, c.orden || 0];
            });

            if (detalleValues.length > 0) {
                await pool.query(
                    `INSERT INTO rh_planilla_detalles (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden) VALUES ?`,
                    [detalleValues]
                );
            }

            const esJubilado = !!emp.es_jubilado;
            let descuentoISSS = 0;
            if (!esJubilado && isssTasa) {
                const baseISSS = Math.min(totalPercepciones, isssTope || Infinity);
                descuentoISSS = baseISSS * isssTasa / 100;
            }
            let descuentoAFP = 0;
            if (!esJubilado && emp.afp_id) {
                const [afpRows] = await pool.query(
                    `SELECT porcentaje_empleado, tope_quincenal, tope_mensual FROM rh_afp_tasas 
                     WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
                     ORDER BY fecha_desde DESC LIMIT 1`,
                    [req.company_id, emp.afp_id, today, today]
                );
                if (afpRows.length > 0) {
                    const afpTope = afpRows[0].tope_quincenal || (afpRows[0].tope_mensual ? afpRows[0].tope_mensual / 2 : Infinity);
                    const baseAFP = Math.min(totalPercepciones, afpTope || Infinity);
                    descuentoAFP = baseAFP * afpRows[0].porcentaje_empleado / 100;
                }
            }
            const ingresoGravadoQ2 = totalPercepciones - descuentoISSS - descuentoAFP;
            let descuentoRenta = 0;
            // Renta: solo aplica en 2da quincena y si el empleado tiene aplica_renta = 1
            const aplicaRentaEmpA = quincena === 'segunda' && (emp.aplica_renta === 1 || emp.aplica_renta === undefined || emp.aplica_renta === null);

            if (aplicaRentaEmpA) {
                const q1Data = q1PlanillaMap.get(emp.id);
                const q1Gravado = q1Data ? Math.max(0, parseFloat(q1Data.total_percepciones || 0) - parseFloat(q1Data.descuento_isss || 0) - parseFloat(q1Data.descuento_afp || 0)) : 0;
                const ingresoGravadoTotalMes = Math.max(0, ingresoGravadoQ2 + q1Gravado);
                const prevRentaQ1 = q1Data ? parseFloat(q1Data.descuento_renta || 0) : 0;

                if (esJubilado) {
                    const rentaTotal = Math.round(ingresoGravadoTotalMes * 0.10 * 100) / 100;
                    descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                } else if (rentaConfigId && ingresoGravadoTotalMes > 0) {
                    const [bracketRows] = await pool.query(
                        `SELECT porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ? ORDER BY sueldo_inicial ASC LIMIT 1`,
                        [rentaConfigId, ingresoGravadoTotalMes, ingresoGravadoTotalMes]
                    );
                    if (bracketRows.length > 0) {
                        const br = bracketRows[0];
                        const rentaTotal = ((ingresoGravadoTotalMes - br.exceso) * br.porcentaje / 100) + parseFloat(br.valor_descuento);
                        descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                    }
                }
            }

            descuentoISSS = Math.round(descuentoISSS * 100) / 100;
            descuentoAFP = Math.round(descuentoAFP * 100) / 100;
            descuentoRenta = Math.round(descuentoRenta * 100) / 100;
            const totalDeducciones = Math.round((totalDeduccionesCuentas + descuentoISSS + descuentoAFP + descuentoRenta) * 100) / 100;
            const montoRecibir = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;

            await pool.query(
                `UPDATE ${TABLE} SET total_percepciones = ?, total_deducciones = ?, descuento_isss = ?, descuento_afp = ?, descuento_renta = ?, monto_recibir = ? WHERE id = ?`,
                [totalPercepciones, totalDeducciones, descuentoISSS, descuentoAFP, descuentoRenta, montoRecibir, planillaId]
            );

            agregadosCount++;
        }

        // B. Para empleados existentes: sincronizar sueldos, bonificaciones fijas, descuentos programados y ausencias
        for (const emp of empleados) {
            const planillaExistente = existentesMap.get(emp.id);
            if (!planillaExistente) continue;

            const [detallesRows] = await pool.query(
                `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY orden ASC, codigo ASC`,
                [planillaExistente.id]
            );

            // Cuentas existentes mapeadas por cuenta_id
            const existingCuentaIds = new Set(detallesRows.map(d => d.cuenta_id).filter(Boolean));

            // Si hay cuentas activas que el empleado no tiene en sus detalles, insertarlas
            const missingCuentas = cuentas.filter(c => !existingCuentaIds.has(c.id));
            if (missingCuentas.length > 0) {
                const newRows = missingCuentas.map(c => [
                    planillaExistente.id, c.id, c.codigo, c.descripcion, c.operacion, c.tipo_valor, null, 0, c.orden || 0
                ]);
                await pool.query(
                    `INSERT INTO rh_planilla_detalles (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden) VALUES ?`,
                    [newRows]
                );
            }

            // Volver a consultar detalles actualizados si hubo cuentas insertadas
            const currentDetalles = missingCuentas.length > 0 
                ? (await pool.query(`SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY orden ASC, codigo ASC`, [planillaExistente.id]))[0]
                : detallesRows;

            const esAusente = emp.en_vacaciones === 1 || emp.incapacitado === 1;
            const empSueldoBase = parseFloat(emp.sueldo_base || 0);
            const empBonifFija = parseFloat(emp.bonificacion_fija || 0);
            const sueldoDiario = empSueldoBase / 30;

            const myDiscounts = empDescuentos.filter(d => d.empleado_id === emp.id);

            let hasChanges = false;
            let currentDias = parseInt(planillaExistente.dias_trabajados ?? 15);

            if (esAusente && currentDias > 0) {
                currentDias = 0;
                hasChanges = true;
            }

            // Revisar y actualizar detalle por detalle manteniendo horas extras y valores manuales intactos
            for (const d of currentDetalles) {
                // 1. Sueldo quincenal (cuenta '01')
                if (d.codigo === '01') {
                    const expectedValor = esAusente ? 0 : Math.round(sueldoDiario * currentDias * 100) / 100;
                    const expectedCant = currentDias;
                    if (parseFloat(d.valor_ingresado || 0) !== expectedValor || parseFloat(d.valor_base || 0) !== expectedCant) {
                        await pool.query(
                            `UPDATE rh_planilla_detalles SET valor_base = ?, valor_ingresado = ? WHERE id = ?`,
                            [expectedCant, expectedValor, d.id]
                        );
                        d.valor_base = expectedCant;
                        d.valor_ingresado = expectedValor;
                        hasChanges = true;
                    }
                }
                // 2. Bonificación fija (cuenta con isBonificacionCuenta)
                else if (d.operacion === 'sumar' && isBonificacionCuenta(d)) {
                    const expectedBonif = esAusente ? 0 : Math.round(empBonifFija * 100) / 100;
                    if (parseFloat(d.valor_ingresado || 0) !== expectedBonif || parseFloat(d.valor_base || 0) !== expectedBonif) {
                        await pool.query(
                            `UPDATE rh_planilla_detalles SET valor_base = ?, valor_ingresado = ? WHERE id = ?`,
                            [expectedBonif, expectedBonif, d.id]
                        );
                        d.valor_base = expectedBonif;
                        d.valor_ingresado = expectedBonif;
                        hasChanges = true;
                    }
                }
                // 3. Descuentos programados (deducciones con matching discounts)
                else if (d.operacion === 'restar') {
                    // Si el empleado está ausente, todos los descuentos van a cero
                    if (esAusente) {
                        if (parseFloat(d.valor_ingresado || 0) !== 0) {
                            await pool.query(
                                `UPDATE rh_planilla_detalles SET valor_base = 0, valor_ingresado = 0 WHERE id = ?`,
                                [d.id]
                            );
                            d.valor_base = 0;
                            d.valor_ingresado = 0;
                            hasChanges = true;
                        }
                    } else {
                        const matchingDiscounts = myDiscounts.filter(disc => {
                            if (disc.cuenta_id && disc.cuenta_id === d.cuenta_id) return true;
                            const descD = (disc.desc_nombre || '').toLowerCase();
                            const descC = (d.descripcion || '').toLowerCase();
                            if (descD.includes('prestamo') && descC.includes('prestamo')) return true;
                            if (descD.includes('procuraduria') && descC.includes('procuraduria')) return true;
                            if ((descD.includes('fondo social') || descD.includes('fsv')) && (descC.includes('fondo social') || descC.includes('fsv'))) return true;
                            if (descD.includes('anticipo') && descC.includes('anticipo')) return true;
                            return false;
                        });

                        if (matchingDiscounts.length > 0) {
                            const sumMonto = matchingDiscounts.reduce((sum, disc) => sum + parseFloat(disc.valor || 0), 0);
                            const expectedVal = Math.round(sumMonto * 100) / 100;
                            if (parseFloat(d.valor_ingresado || 0) !== expectedVal) {
                                await pool.query(
                                    `UPDATE rh_planilla_detalles SET valor_base = ?, valor_ingresado = ? WHERE id = ?`,
                                    [expectedVal, expectedVal, d.id]
                                );
                                d.valor_base = expectedVal;
                                d.valor_ingresado = expectedVal;
                                hasChanges = true;
                            }
                        } else {
                            // Si el empleado ya no tiene este descuento programado activo y la cuenta es de tipo descuento programado
                            const descC = (d.descripcion || '').toLowerCase();
                            const isProgrammedAccount = (d.cuenta_id && programmedCuentaIds.has(d.cuenta_id)) ||
                                descC.includes('prestamo') ||
                                descC.includes('procuraduria') ||
                                descC.includes('fondo social') ||
                                descC.includes('fsv') ||
                                descC.includes('anticipo');

                            if (isProgrammedAccount && parseFloat(d.valor_ingresado || 0) !== 0) {
                                await pool.query(
                                    `UPDATE rh_planilla_detalles SET valor_base = 0, valor_ingresado = 0 WHERE id = ?`,
                                    [d.id]
                                );
                                d.valor_base = 0;
                                d.valor_ingresado = 0;
                                hasChanges = true;
                            }
                        }
                    }
                }
                // Las demás cuentas (horas extras, comisiones, turnos, etc.) NO se tocan en lo absoluto.
            }

            // También verificar si cambió el sueldo_base o bonificacion_fija en la cabecera
            if (parseFloat(planillaExistente.sueldo_base || 0) !== empSueldoBase ||
                parseFloat(planillaExistente.bonificacion_fija || 0) !== empBonifFija ||
                parseInt(planillaExistente.dias_trabajados) !== currentDias) {
                hasChanges = true;
            }

            if (hasChanges) {
                // Recalcular percepciones y deducciones respetando valores manuales de las otras cuentas
                let totalPercepciones = 0;
                let totalDeduccionesCuentas = 0;
                for (const d of currentDetalles) {
                    const val = parseFloat(d.valor_ingresado || 0);
                    if (d.operacion === 'sumar') totalPercepciones += val;
                    else totalDeduccionesCuentas += val;
                }

                totalPercepciones = Math.round(totalPercepciones * 100) / 100;
                totalDeduccionesCuentas = Math.round(totalDeduccionesCuentas * 100) / 100;

                const esJubilado = !!emp.es_jubilado;
                let descuentoISSS = 0;
                if (!esJubilado && isssTasa) {
                    const baseISSS = Math.min(totalPercepciones, isssTope || Infinity);
                    descuentoISSS = baseISSS * isssTasa / 100;
                }
                let descuentoAFP = 0;
                if (!esJubilado && emp.afp_id) {
                    const [afpRows] = await pool.query(
                        `SELECT porcentaje_empleado, tope_quincenal, tope_mensual FROM rh_afp_tasas 
                         WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
                         ORDER BY fecha_desde DESC LIMIT 1`,
                        [req.company_id, emp.afp_id, today, today]
                    );
                    if (afpRows.length > 0) {
                        const afpTope = afpRows[0].tope_quincenal || (afpRows[0].tope_mensual ? afpRows[0].tope_mensual / 2 : Infinity);
                        const baseAFP = Math.min(totalPercepciones, afpTope || Infinity);
                        descuentoAFP = baseAFP * afpRows[0].porcentaje_empleado / 100;
                    }
                }
                const ingresoGravadoQ2 = totalPercepciones - descuentoISSS - descuentoAFP;
                let descuentoRenta = 0;
                // Renta: solo aplica en 2da quincena y si el empleado tiene aplica_renta = 1
                const aplicaRentaEmpB = quincena === 'segunda' && (emp.aplica_renta === 1 || emp.aplica_renta === undefined || emp.aplica_renta === null);
                if (aplicaRentaEmpB) {
                    const q1Data = q1PlanillaMap.get(emp.id);
                    const q1Gravado = q1Data ? Math.max(0, parseFloat(q1Data.total_percepciones || 0) - parseFloat(q1Data.descuento_isss || 0) - parseFloat(q1Data.descuento_afp || 0)) : 0;
                    const ingresoGravadoTotalMes = Math.max(0, ingresoGravadoQ2 + q1Gravado);
                    const prevRentaQ1 = q1Data ? parseFloat(q1Data.descuento_renta || 0) : 0;

                    if (esJubilado) {
                        const rentaTotal = Math.round(ingresoGravadoTotalMes * 0.10 * 100) / 100;
                        descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                    } else if (rentaConfigId && ingresoGravadoTotalMes > 0) {
                        const [bracketRows] = await pool.query(
                            `SELECT porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ? ORDER BY sueldo_inicial ASC LIMIT 1`,
                            [rentaConfigId, ingresoGravadoTotalMes, ingresoGravadoTotalMes]
                        );
                        if (bracketRows.length > 0) {
                            const br = bracketRows[0];
                            const rentaTotal = ((ingresoGravadoTotalMes - br.exceso) * br.porcentaje / 100) + parseFloat(br.valor_descuento);
                            descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                        }
                    }
                }

                descuentoISSS = Math.round(descuentoISSS * 100) / 100;
                descuentoAFP = Math.round(descuentoAFP * 100) / 100;
                descuentoRenta = Math.round(descuentoRenta * 100) / 100;
                const totalDeducciones = Math.round((totalDeduccionesCuentas + descuentoISSS + descuentoAFP + descuentoRenta) * 100) / 100;
                const montoRecibir = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;

                await pool.query(
                    `UPDATE ${TABLE} 
                     SET dias_trabajados = ?,
                         sueldo_base = ?,
                         bonificacion_fija = ?,
                         total_percepciones = ?, 
                         total_deducciones = ?, 
                         descuento_isss = ?, 
                         descuento_afp = ?, 
                         descuento_renta = ?, 
                         monto_recibir = ? 
                     WHERE id = ?`,
                    [currentDias, empSueldoBase, empBonifFija, totalPercepciones, totalDeducciones, descuentoISSS, descuentoAFP, descuentoRenta, montoRecibir, planillaExistente.id]
                );

                actualizadosCount++;
            } else if (quincena === 'segunda') {
                // Si no cambiaron detalles ni sueldos, pero estamos en la 2da quincena, verificar si el descuento de renta actual coincide con el cálculo acumulado mensual
                let totalPercepciones = parseFloat(planillaExistente.total_percepciones || 0);
                let descuentoISSS = parseFloat(planillaExistente.descuento_isss || 0);
                let descuentoAFP = parseFloat(planillaExistente.descuento_afp || 0);
                const ingresoGravadoQ2 = Math.max(0, totalPercepciones - descuentoISSS - descuentoAFP);

                const esJubilado = !!emp.es_jubilado;
                let descuentoRenta = 0;
                const aplicaRentaEmpB = emp.aplica_renta === 1 || emp.aplica_renta === undefined || emp.aplica_renta === null;
                if (aplicaRentaEmpB) {
                    const q1Data = q1PlanillaMap.get(emp.id);
                    const q1Gravado = q1Data ? Math.max(0, parseFloat(q1Data.total_percepciones || 0) - parseFloat(q1Data.descuento_isss || 0) - parseFloat(q1Data.descuento_afp || 0)) : 0;
                    const ingresoGravadoTotalMes = Math.max(0, ingresoGravadoQ2 + q1Gravado);
                    const prevRentaQ1 = q1Data ? parseFloat(q1Data.descuento_renta || 0) : 0;

                    if (esJubilado) {
                        const rentaTotal = Math.round(ingresoGravadoTotalMes * 0.10 * 100) / 100;
                        descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                    } else if (rentaConfigId && ingresoGravadoTotalMes > 0) {
                        const [bracketRows] = await pool.query(
                            `SELECT porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ? ORDER BY sueldo_inicial ASC LIMIT 1`,
                            [rentaConfigId, ingresoGravadoTotalMes, ingresoGravadoTotalMes]
                        );
                        if (bracketRows.length > 0) {
                            const br = bracketRows[0];
                            const rentaTotal = ((ingresoGravadoTotalMes - br.exceso) * br.porcentaje / 100) + parseFloat(br.valor_descuento);
                            descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                        }
                    }
                }
                descuentoRenta = Math.round(descuentoRenta * 100) / 100;

                const currentRenta = parseFloat(planillaExistente.descuento_renta || 0);
                if (Math.abs(descuentoRenta - currentRenta) > 0.001) {
                    // Recalcular total deducciones y monto a recibir
                    let totalDeduccionesCuentas = 0;
                    for (const d of currentDetalles) {
                        if (d.operacion === 'restar') totalDeduccionesCuentas += parseFloat(d.valor_ingresado || 0);
                    }
                    totalDeduccionesCuentas = Math.round(totalDeduccionesCuentas * 100) / 100;
                    const totalDeducciones = Math.round((totalDeduccionesCuentas + descuentoISSS + descuentoAFP + descuentoRenta) * 100) / 100;
                    const montoRecibir = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;

                    await pool.query(
                        `UPDATE ${TABLE} SET descuento_renta = ?, total_deducciones = ?, monto_recibir = ? WHERE id = ?`,
                        [descuentoRenta, totalDeducciones, montoRecibir, planillaExistente.id]
                    );
                    actualizadosCount++;
                }
            }
        }

        res.json({
            message: `Sincronización completada: ${agregadosCount} empleado(s) nuevo(s) agregado(s), ${actualizadosCount} actualizado(s) con novedades.`,
            agregados: agregadosCount,
            actualizados: actualizadosCount,
            total: existentes.length + agregadosCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { sincronizarPlanilla };
