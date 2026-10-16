const { TABLE, MESES, isBonificacionCuenta } = require('./shared');

const generarPlanilla = async (req, res, pool, notificationService) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        // 1. Verificar si hay planillas abiertas en otro período
        const [abiertas] = await pool.query(
            `SELECT periodo_anio, periodo_mes, quincena 
             FROM ${TABLE} 
             WHERE company_id = ? AND estado != 'pagada' 
               AND NOT (periodo_anio = ? AND periodo_mes = ? AND quincena = ?)
             LIMIT 1`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );
        if (abiertas.length > 0) {
            const ab = abiertas[0];
            const mesNombre = MESES[ab.periodo_mes] || ab.periodo_mes;
            const qLabel = ab.quincena === 'primera' ? '1ra Quincena' : '2da Quincena';
            return res.status(400).json({
                message: `No se puede generar una nueva planilla porque el período de ${mesNombre} ${ab.periodo_anio} (${qLabel}) aún está abierto. Debe cerrarlo antes de crear una nueva.`
            });
        }

        // 2. Verificar si este período ya fue cerrado/pagado
        const [cerradas] = await pool.query(
            `SELECT id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado = 'pagada' 
             LIMIT 1`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );
        if (cerradas.length > 0) {
            return res.status(400).json({
                message: 'Este período ya fue cerrado y pagado. No se puede regenerar.'
            });
        }

        const [existentes] = await pool.query(
            `SELECT id FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? LIMIT 1`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );
        if (existentes.length) {
            return res.status(409).json({
                message: 'Este período ya contiene planillas. Utilice Sincronizar para actualizar novedades y conservar los valores manuales.'
            });
        }

        const dias = 15;

        const [empleados] = await pool.query(
            `SELECT id, sueldo_base, bonificacion_fija, afp_id, es_jubilado, es_jubilado_con_afp, aplica_renta, codigo, nombres, apellidos, en_vacaciones, incapacitado,
                    branch_id, departamento_personal_id, cargo_id
             FROM rh_empleados WHERE company_id = ? AND es_activo = 1`,
            [req.company_id]
        );

        if (empleados.length === 0) {
            return res.status(400).json({ message: 'No hay empleados activos' });
        }

        const [cuentas] = await pool.query(
            `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
            [req.company_id]
        );

        // Descuentos programados activos para esta quincena
        const [empDescuentos] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             WHERE ed.company_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [req.company_id, quincena]
        );

        const today = new Date().toISOString().split('T')[0];
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

        // Renta: configuracion segun modo (segunda_quincena o cada_quincena)
        const { getRentaContext, computeEmployeeRenta } = require('./rentaCalculation.service');
        const rentaCtx = await getRentaContext(req.company_id, quincena, today);
        let q1PlanillaMap = new Map();
        if (rentaCtx.calculoRentaModo === 'segunda_quincena' && quincena === 'segunda') {
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

        for (const emp of empleados) {
            const esAusente = emp.en_vacaciones === 1 || emp.incapacitado === 1;
            const diasEmp = esAusente ? 0 : dias;
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const bonificacionFija = parseFloat(emp.bonificacion_fija || 0);
            const sueldoDiario = sueldoBase / 30;

            const [result] = await pool.query(
                `INSERT INTO ${TABLE} (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija, branch_id, departamento_personal_id, cargo_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, emp.id, periodo_anio, periodo_mes, quincena, diasEmp, sueldoBase, bonificacionFija, emp.branch_id || null, emp.departamento_personal_id || null, emp.cargo_id || null]
            );
            const planillaId = result.insertId;

            const myDiscounts = empDescuentos.filter(d => d.empleado_id === emp.id);
            let totalPercepciones = 0;
            let totalDeduccionesCuentas = 0;

            // Si el empleado está en vacaciones o incapacitado: todos los montos van a cero
            const detalleValues = cuentas.map(c => {
                let valor = 0;
                let cantidad = 0;

                if (!esAusente) {
                    if (c.operacion === 'sumar') {
                        if (isBonificacionCuenta(c)) {
                            valor = Math.round(bonificacionFija * 100) / 100;
                            cantidad = valor;
                        } else if (c.tipo_valor === 'dias') {
                            if (c.codigo === '01') {
                                cantidad = diasEmp;
                                valor = Math.round(sueldoDiario * diasEmp * 100) / 100;
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
                        // Deducción: buscar si hay descuento programado para esta cuenta
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

            const esJubiladoConAfp = !!emp.es_jubilado_con_afp;
            const esJubilado = !!emp.es_jubilado && !esJubiladoConAfp;
            const esCualquierJubilado = esJubilado || esJubiladoConAfp;

            let descuentoISSS = 0;
            if (!esCualquierJubilado && isssTasa) {
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
            const ingresoGravado = Math.max(0, totalPercepciones - descuentoISSS - descuentoAFP);
            const aplicaRentaEmp = (emp.aplica_renta === 1 || emp.aplica_renta === undefined || emp.aplica_renta === null);
            const q1Data = q1PlanillaMap.get(emp.id) || null;

            const { descuentoRenta } = computeEmployeeRenta({
                modo: rentaCtx.calculoRentaModo,
                brackets: rentaCtx.brackets,
                ingresoGravado,
                esJubilado: esCualquierJubilado,
                aplicaRenta: aplicaRentaEmp,
                quincena,
                q1Data
            });

            descuentoISSS = Math.round(descuentoISSS * 100) / 100;
            descuentoAFP = Math.round(descuentoAFP * 100) / 100;
            descuentoRenta = Math.round(descuentoRenta * 100) / 100;
            const totalDeducciones = Math.round((totalDeduccionesCuentas + descuentoISSS + descuentoAFP + descuentoRenta) * 100) / 100;
            const montoRecibir = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;

            await pool.query(
                `UPDATE ${TABLE} SET total_percepciones = ?, total_deducciones = ?, descuento_isss = ?, descuento_afp = ?, descuento_renta = ?, monto_recibir = ? WHERE id = ?`,
                [totalPercepciones, totalDeducciones, descuentoISSS, descuentoAFP, descuentoRenta, montoRecibir, planillaId]
            );
        }

        notificationService.notify('payroll_generated', req.company_id, req.user?.branch_id, {
            tipo_planilla: 'quincenal',
            periodo: `${periodo_mes}/${periodo_anio}`,
            total_empleados: empleados.length,
            total_pagar: 0,
            fecha_generacion: new Date().toISOString().split('T')[0]
        }).catch(() => {});

        res.json({ message: 'Planilla generada exitosamente', total: empleados.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { generarPlanilla };
