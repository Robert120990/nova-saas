const pool = require('../config/db');
const { generatePlanillaPDF, generatePlanillaReciboPDF } = require('../services/pdf.service');
const { numberToWords } = require('../utils/numberToWords');
const notificationService = require('../services/notification.service');

const TABLE = 'rh_planillas';
const LABEL = 'Planilla';

const getPlanillas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, anio, mes, quincena } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base as empleado_sueldo_base,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.company_id = ?
        `;
        let params = [req.company_id];

        if (anio) {
            query += ` AND p.periodo_anio = ?`;
            params.push(parseInt(anio));
        }
        if (mes) {
            query += ` AND p.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (quincena) {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, p.quincena, e.codigo ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT p.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.bonificacion_fija,
                    e.num_dui,
                    e.num_nit,
                    e.fecha_ingreso,
                    e.afp_id,
                    e.es_jubilado,
                    e.cargo_id,
                    e.departamento_personal_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} p
             JOIN rh_empleados e ON p.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE p.id = ? AND p.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const planilla = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

        planilla.detalles = detalles;
        res.json(planilla);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createPlanilla = async (req, res) => {
    try {
        const {
            empleado_id, periodo_anio, periodo_mes, quincena,
            dias_trabajados, detalles
        } = req.body;

        const dias = dias_trabajados || 15;

        const [empRows] = await pool.query(
            `SELECT sueldo_base, bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?`,
            [empleado_id, req.company_id]
        );
        if (empRows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
        const sueldoBase = parseFloat(empRows[0].sueldo_base || 0);
        const bonificacionFija = parseFloat(empRows[0].bonificacion_fija || 0);

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} 
             (company_id, empleado_id, periodo_anio, periodo_mes, quincena,
              dias_trabajados, sueldo_base, bonificacion_fija)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, empleado_id, periodo_anio, periodo_mes, quincena,
             dias, sueldoBase, bonificacionFija]
        );
        const planillaId = result.insertId;

        if (detalles && detalles.length > 0) {
            const values = detalles.map(d => [
                planillaId, d.cuenta_id, d.codigo, d.descripcion,
                d.operacion, d.tipo_valor, d.valor_base || null, d.valor_ingresado || 0, d.orden || 0
            ]);
            await pool.query(
                `INSERT INTO rh_planilla_detalles 
                 (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
                 VALUES ?`,
                [values]
            );
        } else {
            await cargarCuentasPorDefecto(pool, planillaId, req.company_id, dias, sueldoBase);
        }

        res.status(201).json({ id: planillaId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const cargarCuentasPorDefecto = async (pool, planillaId, companyId, diasTrabajados, sueldoBase) => {
    const [cuentas] = await pool.query(
        `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
        [companyId]
    );

    if (cuentas.length === 0) return;

    const values = cuentas.map(c => {
        let valor = 0;
        if (c.tipo_valor === 'dias') {
            if (c.codigo === '01') valor = (sueldoBase / 30) * diasTrabajados;
        } else if (c.tipo_valor === 'valor') {
            valor = parseFloat(c.valor_base || 0);
        } else if (c.tipo_valor === 'porcentaje') {
            valor = sueldoBase * (parseFloat(c.valor_base || 0) / 100);
        }
        return [
            planillaId, c.id, c.codigo, c.descripcion,
            c.operacion, c.tipo_valor, c.valor_base || null, Math.round(valor * 100) / 100, c.orden || 0
        ];
    });

    await pool.query(
        `INSERT INTO rh_planilla_detalles 
         (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
         VALUES ?`,
        [values]
    );
};

const updatePlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            dias_trabajados, detalles
        } = req.body;

        const [existing] = await pool.query(
            `SELECT id FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        if (dias_trabajados) {
            await pool.query(
                `UPDATE ${TABLE} SET dias_trabajados = ? WHERE id = ?`,
                [dias_trabajados, id]
            );
        }

        if (detalles && detalles.length > 0) {
            await pool.query(`DELETE FROM rh_planilla_detalles WHERE planilla_id = ?`, [id]);
            const values = detalles.map(d => [
                id, d.cuenta_id, d.codigo, d.descripcion,
                d.operacion, d.tipo_valor, d.valor_base || null, d.valor_ingresado || 0, d.orden || 0
            ]);
            await pool.query(
                `INSERT INTO rh_planilla_detalles 
                 (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
                 VALUES ?`,
                [values]
            );
        }

        res.json({ id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deletePlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const pagarPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET estado = 'pagada' WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        notificationService.notify('payroll_closed', req.company_id, req.user?.branch_id, {
            tipo_planilla: 'quincenal',
            periodo: '',
            total_empleados: 0,
            total_pagado: 0,
            fecha_pago: new Date().toISOString().split('T')[0]
        }).catch(() => {});

        res.json({ message: 'Planilla marcada como pagada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const cerrarPeriodo = async (req, res) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET estado = 'pagada' WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        res.json({ message: `Periodo cerrado exitosamente`, total: result.affectedRows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const eliminarPeriodo = async (req, res) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        const [result] = await pool.query(
            `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        res.json({ message: `Período eliminado exitosamente`, total: result.affectedRows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const generarPlanilla = async (req, res) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        const dias = 15;

        const [empleados] = await pool.query(
            `SELECT id, sueldo_base, bonificacion_fija, afp_id, codigo, nombres, apellidos FROM rh_empleados WHERE company_id = ? AND es_activo = 1`,
            [req.company_id]
        );

        if (empleados.length === 0) {
            return res.status(400).json({ message: 'No hay empleados activos' });
        }

        const [cuentas] = await pool.query(
            `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
            [req.company_id]
        );

        await pool.query(
            `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        const today = new Date().toISOString().split('T')[0];
        let isssTasa = null, isssTope = null;
        const [isssRows] = await pool.query(
            `SELECT porcentaje_empleado, tope_mensual FROM rh_isss_tasas 
             WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
             ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (isssRows.length > 0) {
            isssTasa = isssRows[0].porcentaje_empleado;
            isssTope = isssRows[0].tope_mensual;
        }

        let rentaConfigId = null;
        const [rentaConfigRows] = await pool.query(
            `SELECT id FROM rh_renta_config WHERE company_id = ? AND tipo = 'M' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (rentaConfigRows.length > 0) rentaConfigId = rentaConfigRows[0].id;

        for (const emp of empleados) {
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const sueldoDiario = sueldoBase / 30;

            const [result] = await pool.query(
                `INSERT INTO ${TABLE} (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, emp.id, periodo_anio, periodo_mes, quincena, dias, sueldoBase, parseFloat(emp.bonificacion_fija || 0)]
            );
            const planillaId = result.insertId;

            let totalPercepciones = 0;
            let totalDeduccionesCuentas = 0;
            const detalleValues = cuentas.map(c => {
                let valor = 0;
                if (c.tipo_valor === 'dias') {
                    if (c.codigo === '01') valor = Math.round(sueldoDiario * dias * 100) / 100;
                } else if (c.tipo_valor === 'valor') {
                    valor = parseFloat(c.valor_base || 0);
                } else if (c.tipo_valor === 'porcentaje') {
                    valor = Math.round(sueldoBase * (parseFloat(c.valor_base || 0) / 100) * 100) / 100;
                }
                if (c.operacion === 'sumar') totalPercepciones += valor;
                else totalDeduccionesCuentas += valor;
                return [planillaId, c.id, c.codigo, c.descripcion, c.operacion, c.tipo_valor, c.valor_base || null, valor, c.orden || 0];
            });

            if (detalleValues.length > 0) {
                await pool.query(
                    `INSERT INTO rh_planilla_detalles (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden) VALUES ?`,
                    [detalleValues]
                );
            }

            const esJubilado = false;
            let descuentoISSS = 0;
            if (!esJubilado && isssTasa) {
                descuentoISSS = Math.min(totalPercepciones * isssTasa / 100, isssTope || Infinity);
            }
            let descuentoAFP = 0;
            if (!esJubilado && emp.afp_id) {
                const [afpRows] = await pool.query(
                    `SELECT porcentaje_empleado, tope_mensual FROM rh_afp_tasas WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) ORDER BY fecha_desde DESC LIMIT 1`,
                    [req.company_id, emp.afp_id, today, today]
                );
                if (afpRows.length > 0) {
                    descuentoAFP = Math.min(totalPercepciones * afpRows[0].porcentaje_empleado / 100, afpRows[0].tope_mensual || Infinity);
                }
            }
            const ingresoGravado = totalPercepciones - descuentoISSS - descuentoAFP;
            let descuentoRenta = 0;
            if (rentaConfigId && ingresoGravado > 0) {
                const [bracketRows] = await pool.query(
                    `SELECT porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ? ORDER BY sueldo_inicial ASC LIMIT 1`,
                    [rentaConfigId, ingresoGravado, ingresoGravado]
                );
                if (bracketRows.length > 0) {
                    const br = bracketRows[0];
                    descuentoRenta = Math.max(0, ((ingresoGravado - br.exceso) * br.porcentaje / 100) + parseFloat(br.valor_descuento));
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

const calcular = async (req, res) => {
    try {
        const { planilla_id, empleado_id: reqEmpleadoId, detalles: reqDetalles } = req.body;

        let empleadoId, afpId, esJubilado, detalles;

        if (planilla_id) {
            const [planillaRows] = await pool.query(
                `SELECT p.*, e.afp_id, e.es_jubilado, e.sueldo_base, e.bonificacion_fija
                 FROM ${TABLE} p
                 JOIN rh_empleados e ON p.empleado_id = e.id
                 WHERE p.id = ? AND p.company_id = ?`,
                [planilla_id, req.company_id]
            );
            if (planillaRows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
            const planilla = planillaRows[0];
            empleadoId = planilla.empleado_id;
            afpId = planilla.afp_id;
            esJubilado = !!planilla.es_jubilado;

            const [dRows] = await pool.query(
                `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ?`,
                [planilla_id]
            );
            detalles = dRows;
        } else if (reqEmpleadoId && reqDetalles) {
            empleadoId = reqEmpleadoId;
            const [empRows] = await pool.query(
                `SELECT afp_id, es_jubilado FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [reqEmpleadoId, req.company_id]
            );
            if (empRows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
            afpId = empRows[0].afp_id;
            esJubilado = !!empRows[0].es_jubilado;
            detalles = reqDetalles;
        } else {
            return res.status(400).json({ message: 'planilla_id o (empleado_id + detalles) requerido' });
        }

        let totalPercepciones = 0;
        let totalDeduccionesCuentas = 0;

        for (const d of detalles) {
            const val = parseFloat(d.valor_ingresado || 0);
            if (d.operacion === 'sumar') {
                totalPercepciones += val;
            } else {
                totalDeduccionesCuentas += val;
            }
        }

        const today = new Date().toISOString().split('T')[0];

        let descuentoISSS = 0;
        let isssInfo = null;
        if (!esJubilado) {
            const [isssRows] = await pool.query(
                `SELECT porcentaje_empleado, tope_mensual FROM rh_isss_tasas 
                 WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );
            if (isssRows.length > 0) {
                const tasa = isssRows[0];
                isssInfo = { porcentaje: tasa.porcentaje_empleado, tope: tasa.tope_mensual };
                descuentoISSS = Math.min(totalPercepciones * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        let descuentoAFP = 0;
        let afpInfo = null;
        if (!esJubilado && afpId) {
            const [afpRows] = await pool.query(
                `SELECT t.porcentaje_empleado, t.tope_mensual, a.descripcion as afp_nombre
                 FROM rh_afp_tasas t
                 JOIN rh_afp a ON t.afp_id = a.id
                 WHERE t.company_id = ? AND t.afp_id = ? AND t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
                 ORDER BY t.fecha_desde DESC LIMIT 1`,
                [req.company_id, afpId, today, today]
            );
            if (afpRows.length > 0) {
                const tasa = afpRows[0];
                afpInfo = { nombre: tasa.afp_nombre, porcentaje: tasa.porcentaje_empleado, tope: tasa.tope_mensual };
                descuentoAFP = Math.min(totalPercepciones * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        let descuentoRenta = 0;
        const ingresoGravado = totalPercepciones - descuentoISSS - descuentoAFP;
        let rentaInfo = null;

        if (esJubilado) {
            descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
            rentaInfo = { tipo: 'jubilado', porcentaje: 10, ingreso_gravado: Math.round(ingresoGravado * 100) / 100 };
        } else {
            const [rentaConfigRows] = await pool.query(
                `SELECT id FROM rh_renta_config 
                 WHERE company_id = ? AND tipo = 'M' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );

            if (rentaConfigRows.length > 0 && ingresoGravado > 0) {
                const [bracketRows] = await pool.query(
                    `SELECT sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle 
                     WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ?
                     ORDER BY sueldo_inicial ASC LIMIT 1`,
                    [rentaConfigRows[0].id, ingresoGravado, ingresoGravado]
                );
                if (bracketRows.length > 0) {
                    const bracket = bracketRows[0];
                    const excedente = ingresoGravado - bracket.exceso;
                    descuentoRenta = Math.max(0, (excedente * bracket.porcentaje / 100) + parseFloat(bracket.valor_descuento));
                    rentaInfo = {
                        sueldo_inicial: bracket.sueldo_inicial,
                        sueldo_final: bracket.sueldo_final,
                        porcentaje: bracket.porcentaje,
                        valor_descuento: bracket.valor_descuento,
                        exceso: bracket.exceso,
                        excedente: Math.round(excedente * 100) / 100,
                        ingreso_gravado: Math.round(ingresoGravado * 100) / 100
                    };
                }
            }
        }

        descuentoISSS = Math.round(descuentoISSS * 100) / 100;
        descuentoAFP = Math.round(descuentoAFP * 100) / 100;
        descuentoRenta = Math.round(descuentoRenta * 100) / 100;

        const totalDeducciones = Math.round((totalDeduccionesCuentas + descuentoISSS + descuentoAFP + descuentoRenta) * 100) / 100;
        const montoRecibir = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;

        if (planilla_id) {
            await pool.query(
                `UPDATE ${TABLE} SET
                 total_percepciones = ?, total_deducciones = ?,
                 descuento_isss = ?, descuento_afp = ?, descuento_renta = ?,
                 monto_recibir = ?
                 WHERE id = ?`,
                [totalPercepciones, totalDeducciones,
                 descuentoISSS, descuentoAFP, descuentoRenta,
                 montoRecibir, planilla_id]
            );
        }

        res.json({
            total_percepciones: totalPercepciones,
            total_deducciones_cuentas: totalDeduccionesCuentas,
            descuento_isss: descuentoISSS,
            descuento_afp: descuentoAFP,
            descuento_renta: descuentoRenta,
            isss_info: isssInfo,
            afp_info: afpInfo,
            renta_info: rentaInfo,
            es_jubilado: esJubilado,
            total_deducciones: totalDeducciones,
            monto_recibir: montoRecibir
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getGruposPlanilla = async (req, res) => {
    try {
        const { anio, mes, quincena, page: pageQ, limit: limitQ } = req.query;
        const page = parseInt(pageQ) || 1;
        const limit = parseInt(limitQ) || 20;
        const offset = (page - 1) * limit;

        let where = 'WHERE p.company_id = ?';
        const params = [req.company_id];

        if (anio) { where += ' AND p.periodo_anio = ?'; params.push(anio); }
        if (mes) { where += ' AND p.periodo_mes = ?'; params.push(mes); }
        if (quincena) { where += ' AND p.quincena = ?'; params.push(quincena); }

        const [countRows] = await pool.query(
            `SELECT COUNT(DISTINCT CONCAT(p.periodo_anio, '-', p.periodo_mes, '-', p.quincena)) as total FROM ${TABLE} p ${where}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT p.periodo_anio, p.periodo_mes, p.quincena,
                    COUNT(*) as total_empleados,
                    ROUND(SUM(p.sueldo_base), 2) as total_sueldos,
                    ROUND(SUM(p.total_percepciones), 2) as total_percepciones,
                    ROUND(SUM(p.total_deducciones), 2) as total_deducciones,
                    ROUND(SUM(p.descuento_isss), 2) as total_isss,
                    ROUND(SUM(p.descuento_afp), 2) as total_afp,
                    ROUND(SUM(p.descuento_renta), 2) as total_renta,
                    ROUND(SUM(p.monto_recibir), 2) as total_neto,
                    MIN(p.estado) as estado_general
             FROM ${TABLE} p
             ${where}
             GROUP BY p.periodo_anio, p.periodo_mes, p.quincena
             ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, FIELD(p.quincena, 'primera', 'segunda')
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);
        res.json({ data: rows, total, page, totalPages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportRecibosMasivos = async (req, res) => {
    try {
        const { anio, mes, quincena } = req.query;
        if (!anio || !mes || !quincena) {
            return res.status(400).json({ message: 'anio, mes y quincena requeridos' });
        }

        const [planillas] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   e.cargo_id, e.departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            JOIN companies comp ON p.company_id = comp.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.quincena = ?
            ORDER BY e.codigo ASC`,
            [req.company_id, anio, mes, quincena]
        );

        if (planillas.length === 0) return res.status(404).json({ message: 'No hay planillas en este período' });

        const { generatePlanillaReciboPDF } = require('../services/pdf.service');
        const { PDFDocument } = require('pdf-lib');
        const mergedPdf = await PDFDocument.create();

        for (const p of planillas) {
            const [detalles] = await pool.query(
                `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
                [p.id]
            );

            const today = new Date().toISOString().split('T')[0];
            let isssPorcentaje = 0, afpPorcentaje = 0;
            const [isssRows] = await pool.query(
                `SELECT porcentaje_empleado FROM rh_isss_tasas WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );
            if (isssRows.length > 0) isssPorcentaje = isssRows[0].porcentaje_empleado;
            if (p.afp_id) {
                const [afpRows] = await pool.query(
                    `SELECT porcentaje_empleado FROM rh_afp_tasas WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) ORDER BY fecha_desde DESC LIMIT 1`,
                    [req.company_id, p.afp_id, today, today]
                );
                if (afpRows.length > 0) afpPorcentaje = afpRows[0].porcentaje_empleado;
            }

            let responsable = '', firmaUrl = '', selloUrl = '';
            const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [req.company_id]);
            if (rhCfg.length > 0) {
                if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
                firmaUrl = rhCfg[0].firma_url || '';
                selloUrl = rhCfg[0].sello_url || '';
            }

            const { default: numberToWords } = await import('number-to-words');

            const pdfData = {
                id: p.id,
                company_name: p.company_name,
                company_nit: p.company_nit,
                logo_url: p.logo_url,
                responsable_nombre: responsable,
                firma_url: firmaUrl,
                sello_url: selloUrl,
                empleado_nombres: p.empleado_nombres,
                empleado_apellidos: p.empleado_apellidos,
                sueldo_base: p.sueldo_base,
                cargo_nombre: p.cargo_nombre,
                departamento_nombre: p.departamento_nombre,
                fecha_ingreso: p.fecha_ingreso,
                num_dui: p.num_dui,
                num_nit: p.num_nit,
                periodo_anio: p.periodo_anio,
                periodo_mes: p.periodo_mes,
                quincena: p.quincena,
                dias_trabajados: p.dias_trabajados,
                detalles: detalles,
                total_percepciones: p.total_percepciones,
                total_deducciones: p.total_deducciones,
                descuento_isss: p.descuento_isss,
                descuento_afp: p.descuento_afp,
                descuento_renta: p.descuento_renta,
                monto_recibir: p.monto_recibir,
                isss_porcentaje: isssPorcentaje,
                afp_porcentaje: afpPorcentaje,
                monto_letras: numberToWords(parseFloat(p.monto_recibir))
            };

            const pdfBuffer = await generatePlanillaReciboPDF(pdfData);
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedBuffer = Buffer.from(await mergedPdf.save());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibos_Planilla_${anio}_${mes}_${quincena}.pdf`);
        res.send(mergedBuffer);
    } catch (error) {
        console.error('[Recibos Masivos] Error:', error);
        res.status(500).json({ message: 'Error al generar recibos masivos' });
    }
};

const getEmpleadoData = async (req, res) => {
    try {
        const { id } = req.params;
        const { periodo_anio, periodo_mes, quincena } = req.query;
        const [rows] = await pool.query(
            `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.bonificacion_fija,
                    e.afp_id, e.cargo_id, e.departamento_personal_id, e.num_dui, e.num_nit,
                    e.fecha_ingreso, e.es_jubilado,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM rh_empleados e
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE e.id = ? AND e.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
        const emp = rows[0];

        let planillaId = null, detalles = [], totales = null;

        if (periodo_anio && periodo_mes && quincena) {
            const [planillas] = await pool.query(
                `SELECT id FROM ${TABLE} WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
                [req.company_id, id, periodo_anio, periodo_mes, quincena]
            );
            if (planillas.length > 0) {
                planillaId = planillas[0].id;
                const [dRows] = await pool.query(
                    `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
                    [planillaId]
                );
                detalles = dRows;
                const [pRows] = await pool.query(
                    `SELECT total_percepciones, total_deducciones, descuento_isss, descuento_afp, descuento_renta, monto_recibir
                     FROM ${TABLE} WHERE id = ?`,
                    [planillaId]
                );
                if (pRows.length > 0) totales = pRows[0];
            }
        }

        res.json({ ...emp, planilla_id: planillaId, detalles, totales });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCuentasActivas = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   e.cargo_id, e.departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            JOIN companies comp ON p.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.id = ? AND p.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

        const today = new Date().toISOString().split('T')[0];
        let isssPorcentaje = 0, afpPorcentaje = 0;

        const [isssRows] = await pool.query(
            `SELECT porcentaje_empleado FROM rh_isss_tasas 
             WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
             ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (isssRows.length > 0) isssPorcentaje = isssRows[0].porcentaje_empleado;

        if (p.afp_id) {
            const [afpRows] = await pool.query(
                `SELECT porcentaje_empleado FROM rh_afp_tasas
                 WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, p.afp_id, today, today]
            );
            if (afpRows.length > 0) afpPorcentaje = afpRows[0].porcentaje_empleado;
        }

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            departamento_nombre: p.departamento_nombre,
            fecha_ingreso: p.fecha_ingreso,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            periodo_anio: p.periodo_anio,
            periodo_mes: p.periodo_mes,
            quincena: p.quincena,
            dias_trabajados: p.dias_trabajados,
            detalles: detalles,
            total_percepciones: p.total_percepciones,
            total_deducciones: p.total_deducciones,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            monto_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generatePlanillaPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Planilla_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Planilla PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportRecibo = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   e.cargo_id, e.departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            JOIN companies comp ON p.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.id = ? AND p.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

        const today = new Date().toISOString().split('T')[0];
        let isssPorcentaje = 0, afpPorcentaje = 0;

        const [isssRows] = await pool.query(
            `SELECT porcentaje_empleado FROM rh_isss_tasas 
             WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
             ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (isssRows.length > 0) isssPorcentaje = isssRows[0].porcentaje_empleado;

        if (p.afp_id) {
            const [afpRows] = await pool.query(
                `SELECT porcentaje_empleado FROM rh_afp_tasas
                 WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, p.afp_id, today, today]
            );
            if (afpRows.length > 0) afpPorcentaje = afpRows[0].porcentaje_empleado;
        }

        let responsable = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(
            `SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`,
            [req.company_id]
        );
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            responsable_nombre: responsable,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            departamento_nombre: p.departamento_nombre,
            fecha_ingreso: p.fecha_ingreso,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            periodo_anio: p.periodo_anio,
            periodo_mes: p.periodo_mes,
            quincena: p.quincena,
            dias_trabajados: p.dias_trabajados,
            detalles: detalles,
            total_percepciones: p.total_percepciones,
            total_deducciones: p.total_deducciones,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            monto_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generatePlanillaReciboPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibo_Planilla_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Planilla Recibo] Error:', error);
        res.status(500).json({ message: 'Error al generar recibo' });
    }
};

module.exports = {
    getPlanillas, getPlanilla, createPlanilla, updatePlanilla, deletePlanilla,
    pagarPlanilla, cerrarPeriodo, eliminarPeriodo, calcular, generarPlanilla, getGruposPlanilla, exportRecibosMasivos, getEmpleadoData, getCuentasActivas, exportPDF, exportRecibo
};
