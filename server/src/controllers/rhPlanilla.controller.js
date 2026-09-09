const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { generatePlanillaPDF, generatePlanillaReciboPDF } = require('../services/pdf.service');
const { numberToWords } = require('../utils/numberToWords');
const notificationService = require('../services/notification.service');

const TABLE = 'rh_planillas';
const LABEL = 'Planilla';

const isBonificacionCuenta = (c) => {
    return c.codigo === '02' || (c.descripcion || '').toUpperCase().includes('BONIF');
};

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
            dias_trabajados, detalles,
            total_percepciones, total_deducciones,
            descuento_isss, descuento_afp, descuento_renta, monto_recibir
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
              dias_trabajados, sueldo_base, bonificacion_fija,
              total_percepciones, total_deducciones, descuento_isss, descuento_afp, descuento_renta, monto_recibir)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id, empleado_id, periodo_anio, periodo_mes, quincena,
                dias, sueldoBase, bonificacionFija,
                total_percepciones || 0, total_deducciones || 0,
                descuento_isss || 0, descuento_afp || 0, descuento_renta || 0, monto_recibir || 0
            ]
        );
        const planillaId = result.insertId;

        if (detalles && detalles.length > 0) {
            const values = detalles.map(d => [
                planillaId, d.cuenta_id, d.codigo, d.descripcion,
                d.operacion, d.tipo_valor,
                d.valor_base !== undefined ? d.valor_base : (d.cantidad !== undefined ? d.cantidad : null),
                d.valor_ingresado || 0,
                d.orden || 0
            ]);
            await pool.query(
                `INSERT INTO rh_planilla_detalles 
                 (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
                 VALUES ?`,
                [values]
            );
        } else {
            await cargarCuentasPorDefecto(pool, planillaId, req.company_id, dias, sueldoBase, empleado_id, quincena, bonificacionFija);
        }

        res.status(201).json({ id: planillaId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const cargarCuentasPorDefecto = async (pool, planillaId, companyId, diasTrabajados, sueldoBase, empleadoId = null, quincena = 'primera', bonificacionFija = 0) => {
    const [cuentas] = await pool.query(
        `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
        [companyId]
    );

    if (cuentas.length === 0) return;

    let empDescuentos = [];
    let bonifFija = parseFloat(bonificacionFija || 0);
    if (empleadoId) {
        const [dRows] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             WHERE ed.company_id = ? AND ed.empleado_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [companyId, empleadoId, quincena]
        );
        empDescuentos = dRows;

        if (!bonifFija) {
            const [empRows] = await pool.query(
                `SELECT bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [empleadoId, companyId]
            );
            if (empRows.length > 0) {
                bonifFija = parseFloat(empRows[0].bonificacion_fija || 0);
            }
        }
    }

    const sueldoDiario = sueldoBase / 30;
    const values = cuentas.map(c => {
        let valor = 0;
        let cantidad = 0;

        if (c.operacion === 'sumar') {
            if (isBonificacionCuenta(c)) {
                valor = Math.round(bonifFija * 100) / 100;
                cantidad = valor;
            } else if (c.tipo_valor === 'dias') {
                if (c.codigo === '01') {
                    cantidad = diasTrabajados;
                    valor = sueldoDiario * diasTrabajados;
                }
            } else if (c.tipo_valor === 'valor') {
                valor = parseFloat(c.valor_base || 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'porcentaje') {
                const pct = parseFloat(c.valor_base || 0);
                cantidad = pct;
                valor = sueldoBase * (pct / 100);
            } else if (c.tipo_valor === 'horas') {
                const hrs = parseFloat(c.valor_base || 0);
                cantidad = hrs;
                if (hrs > 0) {
                    const isNocturna = (c.descripcion || '').toUpperCase().includes('NOCTURNA');
                    const factor = isNocturna ? 2.5 : 2.0;
                    valor = (sueldoDiario / 8 * factor) * hrs;
                }
            }
        } else {
            const matchingDiscounts = empDescuentos.filter(d => {
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
                valor = matchingDiscounts.reduce((s, d) => s + parseFloat(d.valor || 0), 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'valor') {
                valor = parseFloat(c.valor_base || 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'porcentaje') {
                const pct = parseFloat(c.valor_base || 0);
                cantidad = pct;
                valor = sueldoBase * (pct / 100);
            }
        }

        return [
            planillaId, c.id, c.codigo, c.descripcion,
            c.operacion, c.tipo_valor, cantidad || null, Math.round(valor * 100) / 100, c.orden || 0
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
            dias_trabajados, detalles,
            total_percepciones, total_deducciones,
            descuento_isss, descuento_afp, descuento_renta, monto_recibir
        } = req.body;

        const [existing] = await pool.query(
            `SELECT id FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const updateFields = [];
        const updateParams = [];

        if (dias_trabajados !== undefined) {
            updateFields.push('dias_trabajados = ?');
            updateParams.push(dias_trabajados);
        }
        if (total_percepciones !== undefined) {
            updateFields.push('total_percepciones = ?');
            updateParams.push(total_percepciones);
        }
        if (total_deducciones !== undefined) {
            updateFields.push('total_deducciones = ?');
            updateParams.push(total_deducciones);
        }
        if (descuento_isss !== undefined) {
            updateFields.push('descuento_isss = ?');
            updateParams.push(descuento_isss);
        }
        if (descuento_afp !== undefined) {
            updateFields.push('descuento_afp = ?');
            updateParams.push(descuento_afp);
        }
        if (descuento_renta !== undefined) {
            updateFields.push('descuento_renta = ?');
            updateParams.push(descuento_renta);
        }
        if (monto_recibir !== undefined) {
            updateFields.push('monto_recibir = ?');
            updateParams.push(monto_recibir);
        }

        if (updateFields.length > 0) {
            updateParams.push(id, req.company_id);
            await pool.query(
                `UPDATE ${TABLE} SET ${updateFields.join(', ')} WHERE id = ? AND company_id = ?`,
                updateParams
            );
        }

        if (detalles && detalles.length > 0) {
            await pool.query(`DELETE FROM rh_planilla_detalles WHERE planilla_id = ?`, [id]);
            const values = detalles.map(d => [
                id, d.cuenta_id, d.codigo, d.descripcion,
                d.operacion, d.tipo_valor,
                d.valor_base !== undefined ? d.valor_base : (d.cantidad !== undefined ? d.cantidad : null),
                d.valor_ingresado || 0,
                d.orden || 0
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

const descontarCuotas = async (companyId, empleadoIds, quincena) => {
    if (!empleadoIds || empleadoIds.length === 0) return;
    await pool.query(
        `UPDATE rh_empleado_descuentos
         SET cuotas_restantes = GREATEST(0, cuotas_restantes - 1),
             activo = IF(cuotas_restantes - 1 <= 0, 0, activo)
         WHERE company_id = ? 
           AND empleado_id IN (?)
           AND activo = 1 
           AND cuotas_restantes > 0
           AND (quincena = 'ambas' OR quincena = ?)`,
        [companyId, empleadoIds, quincena]
    );
};

const revertirCuotas = async (companyId, empleadoIds, quincena) => {
    if (!empleadoIds || empleadoIds.length === 0) return;
    await pool.query(
        `UPDATE rh_empleado_descuentos
         SET cuotas_restantes = cuotas_restantes + 1,
             activo = 1
         WHERE company_id = ? 
           AND empleado_id IN (?)
           AND (quincena = 'ambas' OR quincena = ?)`,
        [companyId, empleadoIds, quincena]
    );
};

const pagarPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query(
            `SELECT empleado_id, quincena, estado FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        if (existing[0].estado !== 'pagada') {
            await descontarCuotas(req.company_id, [existing[0].empleado_id], existing[0].quincena);
        }

        await pool.query(
            `UPDATE ${TABLE} SET estado = 'pagada' WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        notificationService.notify('payroll_closed', req.company_id, req.user?.branch_id, {
            tipo_planilla: 'quincenal',
            periodo: '',
            total_empleados: 1,
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

        const [pendientes] = await pool.query(
            `SELECT DISTINCT empleado_id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado != 'pagada'`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        if (pendientes.length > 0) {
            const empIds = pendientes.map(p => p.empleado_id);
            await descontarCuotas(req.company_id, empIds, quincena);
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

        const [pagadas] = await pool.query(
            `SELECT DISTINCT empleado_id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado = 'pagada'`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        if (pagadas.length > 0) {
            const empIds = pagadas.map(p => p.empleado_id);
            await revertirCuotas(req.company_id, empIds, quincena);
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
            `SELECT id, sueldo_base, bonificacion_fija, afp_id, es_jubilado, codigo, nombres, apellidos 
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

        await pool.query(
            `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
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

        let rentaConfigId = null;
        const [rentaConfigRows] = await pool.query(
            `SELECT id, tipo FROM rh_renta_config 
             WHERE company_id = ? AND (tipo = 'Q' OR tipo = 'M') AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
             ORDER BY FIELD(tipo, 'Q', 'M'), fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (rentaConfigRows.length > 0) rentaConfigId = rentaConfigRows[0].id;

        for (const emp of empleados) {
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
            const ingresoGravado = totalPercepciones - descuentoISSS - descuentoAFP;
            let descuentoRenta = 0;
            if (esJubilado) {
                descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
            } else if (rentaConfigId && ingresoGravado > 0) {
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

const sincronizarPlanilla = async (req, res) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        // 1. Empleados activos de la empresa
        const [empleados] = await pool.query(
            `SELECT id, sueldo_base, bonificacion_fija, afp_id, es_jubilado, codigo, nombres, apellidos, en_vacaciones, incapacitado 
             FROM rh_empleados WHERE company_id = ? AND es_activo = 1`,
            [req.company_id]
        );

        if (empleados.length === 0) {
            return res.status(400).json({ message: 'No hay empleados activos en la empresa' });
        }

        // 2. Planillas registradas actualmente para este período
        const [existentes] = await pool.query(
            `SELECT id, empleado_id, dias_trabajados, sueldo_base, bonificacion_fija
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

        let rentaConfigId = null;
        const [rentaConfigRows] = await pool.query(
            `SELECT id, tipo FROM rh_renta_config 
             WHERE company_id = ? AND (tipo = 'Q' OR tipo = 'M') AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
             ORDER BY FIELD(tipo, 'Q', 'M'), fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (rentaConfigRows.length > 0) rentaConfigId = rentaConfigRows[0].id;

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
            const ingresoGravado = totalPercepciones - descuentoISSS - descuentoAFP;
            let descuentoRenta = 0;
            if (esJubilado) {
                descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
            } else if (rentaConfigId && ingresoGravado > 0) {
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

            agregadosCount++;
        }

        // B. Para empleados existentes: actualizar si están marcados en vacaciones o incapacitados y aún tenían días > 0
        for (const emp of empleados) {
            const planillaExistente = existentesMap.get(emp.id);
            if (!planillaExistente) continue;

            const esAusente = emp.en_vacaciones === 1 || emp.incapacitado === 1;
            if (esAusente && planillaExistente.dias_trabajados > 0) {
                // Actualizar la cuenta 01 a 0 días y $0.00
                await pool.query(
                    `UPDATE rh_planilla_detalles SET valor_base = 0, valor_ingresado = 0
                     WHERE planilla_id = ? AND codigo = '01'`,
                    [planillaExistente.id]
                );

                // Recalcular percepciones y deducciones de la planilla existente respetando sus otras cuentas
                const [detallesRows] = await pool.query(
                    `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ?`,
                    [planillaExistente.id]
                );

                let totalPercepciones = 0;
                let totalDeduccionesCuentas = 0;
                for (const d of detallesRows) {
                    const val = parseFloat(d.valor_ingresado || 0);
                    if (d.operacion === 'sumar') totalPercepciones += val;
                    else totalDeduccionesCuentas += val;
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
                const ingresoGravado = totalPercepciones - descuentoISSS - descuentoAFP;
                let descuentoRenta = 0;
                if (esJubilado) {
                    descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
                } else if (rentaConfigId && ingresoGravado > 0) {
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
                    `UPDATE ${TABLE} SET dias_trabajados = 0, total_percepciones = ?, total_deducciones = ?, descuento_isss = ?, descuento_afp = ?, descuento_renta = ?, monto_recibir = ? WHERE id = ?`,
                    [totalPercepciones, totalDeducciones, descuentoISSS, descuentoAFP, descuentoRenta, montoRecibir, planillaExistente.id]
                );

                actualizadosCount++;
            }
        }

        res.json({
            message: `Sincronización completada: ${agregadosCount} empleado(s) nuevo(s) agregado(s), ${actualizadosCount} actualizado(s).`,
            agregados: agregadosCount,
            actualizados: actualizadosCount,
            total: existentes.length + agregadosCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const calcular = async (req, res) => {
    try {
        const { planilla_id, empleado_id: reqEmpleadoId, detalles: reqDetalles, quincena: reqQuincena } = req.body;

        let empleadoId, afpId, esJubilado, detalles, quincena = reqQuincena || 'primera';

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
            quincena = planilla.quincena || quincena;

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
                `SELECT porcentaje_empleado, tope_quincenal, tope_mensual FROM rh_isss_tasas 
                 WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );
            if (isssRows.length > 0) {
                const tasa = isssRows[0];
                const tope = tasa.tope_quincenal || (tasa.tope_mensual ? tasa.tope_mensual / 2 : Infinity);
                isssInfo = { porcentaje: tasa.porcentaje_empleado, tope };
                const baseISSS = Math.min(totalPercepciones, tope || Infinity);
                descuentoISSS = baseISSS * tasa.porcentaje_empleado / 100;
            }
        }

        let descuentoAFP = 0;
        let afpInfo = null;
        if (!esJubilado && afpId) {
            const [afpRows] = await pool.query(
                `SELECT t.porcentaje_empleado, t.tope_quincenal, t.tope_mensual, a.descripcion as afp_nombre
                 FROM rh_afp_tasas t
                 JOIN rh_afp a ON t.afp_id = a.id
                 WHERE t.company_id = ? AND t.afp_id = ? AND t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
                 ORDER BY t.fecha_desde DESC LIMIT 1`,
                [req.company_id, afpId, today, today]
            );
            if (afpRows.length > 0) {
                const tasa = afpRows[0];
                const tope = tasa.tope_quincenal || (tasa.tope_mensual ? tasa.tope_mensual / 2 : Infinity);
                afpInfo = { nombre: tasa.afp_nombre, porcentaje: tasa.porcentaje_empleado, tope };
                const baseAFP = Math.min(totalPercepciones, tope || Infinity);
                descuentoAFP = baseAFP * tasa.porcentaje_empleado / 100;
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
                `SELECT id, tipo FROM rh_renta_config 
                 WHERE company_id = ? AND (tipo = 'Q' OR tipo = 'M') AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY FIELD(tipo, 'Q', 'M'), fecha_desde DESC LIMIT 1`,
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
                    ROUND(SUM((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15)), 2) as total_sueldos_quincenal,
                    ROUND(GREATEST(0, SUM(p.total_percepciones) - SUM((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15))), 2) as total_ingresos_adic,
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

            const otrasDed = detalles.reduce((acc, d) => acc + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
            const totalPercep = detalles.reduce((acc, d) => acc + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
            const isss = parseFloat(p.descuento_isss || 0);
            const afp = parseFloat(p.descuento_afp || 0);
            const renta = parseFloat(p.descuento_renta || 0);
            const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
            const netoPercep = totalPercep > 0 ? totalPercep : parseFloat(p.total_percepciones || 0);
            const montoRecibir = Math.round((netoPercep - totalDed) * 100) / 100;

            const pdfData = {
                id: p.id,
                company_name: p.company_name,
                company_nit: p.company_nit,
                logo_url: p.logo_url,
                responsable_nombre: responsable,
                firma_url: firmaUrl,
                sello_url: selloUrl,
                empleado_codigo: p.empleado_codigo,
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
                total_percepciones: netoPercep,
                total_deducciones: totalDed,
                descuento_isss: isss,
                descuento_afp: afp,
                descuento_renta: renta,
                monto_recibir: montoRecibir,
                isss_porcentaje: isssPorcentaje,
                afp_porcentaje: afpPorcentaje,
                monto_letras: numberToWords(parseFloat(montoRecibir))
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

        const [empDescuentos] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre,
                    cp.codigo as cuenta_codigo, cp.descripcion as cuenta_descripcion
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             LEFT JOIN rh_cuentas_planillas cp ON dp.cuenta_id = cp.id
             WHERE ed.company_id = ? AND ed.empleado_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [req.company_id, id, quincena || 'primera']
        );

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
                if (pRows.length > 0) {
                    const row = pRows[0];
                    const otrasDed = dRows.filter(d => d.operacion === 'restar').reduce((s, d) => s + parseFloat(d.valor_ingresado || 0), 0);
                    const isss = parseFloat(row.descuento_isss || 0);
                    const afp = parseFloat(row.descuento_afp || 0);
                    const renta = parseFloat(row.descuento_renta || 0);
                    const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
                    const totPercep = parseFloat(row.total_percepciones || 0);
                    const neto = Math.round((totPercep - totalDed) * 100) / 100;
                    totales = {
                        ...row,
                        total_deducciones_cuentas: otrasDed,
                        total_deducciones: totalDed,
                        monto_recibir: neto
                    };
                }
            }
        }

        if (!planillaId) {
            const [cuentas] = await pool.query(
                `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
                [req.company_id]
            );
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const bonificacionFija = parseFloat(emp.bonificacion_fija || 0);
            const sueldoDiario = sueldoBase / 30;
            const dias = 15;

            detalles = cuentas.map(c => {
                let valor = 0;
                let cantidad = 0;

                if (c.operacion === 'sumar') {
                    if (isBonificacionCuenta(c)) {
                        valor = Math.round(bonificacionFija * 100) / 100;
                        cantidad = valor;
                    } else if (c.tipo_valor === 'dias' && c.codigo === '01') {
                        cantidad = dias;
                        valor = Math.round(sueldoDiario * dias * 100) / 100;
                    } else if (c.tipo_valor === 'valor') {
                        valor = parseFloat(c.valor_base || 0);
                        cantidad = valor;
                    } else if (c.tipo_valor === 'porcentaje') {
                        const pct = parseFloat(c.valor_base || 0);
                        cantidad = pct;
                        valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                    }
                } else {
                    const matching = empDescuentos.filter(d => {
                        if (d.cuenta_id && d.cuenta_id === c.id) return true;
                        const descD = (d.desc_nombre || '').toLowerCase();
                        const descC = (c.descripcion || '').toLowerCase();
                        if (descD.includes('prestamo') && descC.includes('prestamo')) return true;
                        if (descD.includes('procuraduria') && descC.includes('procuraduria')) return true;
                        if ((descD.includes('fondo social') || descD.includes('fsv')) && (descC.includes('fondo social') || descC.includes('fsv'))) return true;
                        if (descD.includes('anticipo') && descC.includes('anticipo')) return true;
                        return false;
                    });

                    if (matching.length > 0) {
                        valor = Math.round(matching.reduce((s, d) => s + parseFloat(d.valor || 0), 0) * 100) / 100;
                        cantidad = valor;
                    } else if (c.tipo_valor === 'valor') {
                        valor = parseFloat(c.valor_base || 0);
                        cantidad = valor;
                    } else if (c.tipo_valor === 'porcentaje') {
                        const pct = parseFloat(c.valor_base || 0);
                        cantidad = pct;
                        valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                    }
                }

                return {
                    cuenta_id: c.id,
                    codigo: c.codigo,
                    descripcion: c.descripcion,
                    operacion: c.operacion,
                    tipo_valor: c.tipo_valor,
                    valor_base: cantidad || null,
                    cantidad: cantidad || 0,
                    valor_ingresado: valor,
                    orden: c.orden || 0
                };
            });
        }

        res.json({ ...emp, planilla_id: planillaId, detalles, totales, descuentos_programados: empDescuentos });
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

        const otrasDed = detalles.reduce((acc, d) => acc + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const totalPercep = detalles.reduce((acc, d) => acc + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const isss = parseFloat(p.descuento_isss || 0);
        const afp = parseFloat(p.descuento_afp || 0);
        const renta = parseFloat(p.descuento_renta || 0);
        const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
        const netoPercep = totalPercep > 0 ? totalPercep : parseFloat(p.total_percepciones || 0);
        const montoRecibir = Math.round((netoPercep - totalDed) * 100) / 100;

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_codigo: p.empleado_codigo,
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
            total_percepciones: netoPercep,
            total_deducciones: totalDed,
            descuento_isss: isss,
            descuento_afp: afp,
            descuento_renta: renta,
            monto_recibir: montoRecibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(montoRecibir))
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

        const otrasDed = detalles.reduce((acc, d) => acc + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const totalPercep = detalles.reduce((acc, d) => acc + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const isss = parseFloat(p.descuento_isss || 0);
        const afp = parseFloat(p.descuento_afp || 0);
        const renta = parseFloat(p.descuento_renta || 0);
        const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
        const netoPercep = totalPercep > 0 ? totalPercep : parseFloat(p.total_percepciones || 0);
        const montoRecibir = Math.round((netoPercep - totalDed) * 100) / 100;

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            responsable_nombre: responsable,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            empleado_codigo: p.empleado_codigo,
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
            total_percepciones: netoPercep,
            total_deducciones: totalDed,
            descuento_isss: isss,
            descuento_afp: afp,
            descuento_renta: renta,
            monto_recibir: montoRecibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(montoRecibir))
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

const MONTH_NAMES = [
    '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function formatCurrency(val, showDashWhenZero = true) {
    if (val === null || val === undefined || isNaN(val)) return '';
    const n = Number(val);
    if (Math.abs(n) < 0.001) {
        return showDashWhenZero ? '$ -' : '$ 0.00';
    }
    const formatted = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (n < 0) {
        return `$(${formatted})`;
    }
    return `$ ${formatted}`;
}

function fitText(doc, text, maxWidth) {
    if (!text) return '';
    const s = String(text).trim();
    if (doc.widthOfString(s) <= maxWidth) return s;
    let truncated = s;
    while (truncated.length > 0 && doc.widthOfString(truncated + '…') > maxWidth) {
        truncated = truncated.slice(0, -1).trimEnd();
    }
    return truncated ? truncated + '…' : '';
}

function renderHeader(doc, company, title, periodText, orientation = 'landscape') {
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Emission timestamp at top-left
    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b').text(`${dateStr}  ${timeStr}`, 30, 20);

    // 1. Company Name
    const companyName = (company.razon_social || company.nombre_comercial || 'EMPRESA REGISTRADA').toUpperCase();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, 30, 20, { align: 'center', width: contentWidth });

    // 2. Report Title
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase(), 30, 35, { align: 'center', width: contentWidth });

    // 3. Tax Identifiers
    const taxText = `NUMERO DE REGISTRO DE I.V.A.: ${company.nrc || 'N/A'}    |    NIT: ${company.nit || 'N/A'}`;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(taxText, 30, 49, { align: 'center', width: contentWidth });

    // 4. Period
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(periodText.toUpperCase(), 30, 61, { align: 'center', width: contentWidth });

    // 5. Currency standard legend
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)', 30, 73, { align: 'center', width: contentWidth });

    // Subtle divider line
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, 85).lineTo(pageWidth - 30, 85).stroke();

    doc.y = 92;
    return 92;
}

function renderClosingFooter(doc, startX, y, count, entityName = 'Empleados') {
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    doc.text(`Número de ${entityName} Impresos : ${count || 0}`, startX, y, { lineBreak: false });
    doc.text('FIN DEL REPORTE.', startX, y + 9, { lineBreak: false });
    return y + 22;
}

function renderPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Página ${i + 1} de ${range.count}`, 30, doc.page.height - 20, {
            align: 'center',
            width: doc.page.width - 60,
            lineBreak: false
        });
        doc.page.margins.bottom = oldBottom;
    }
}

const exportPlanillaReportePDF = async (req, res) => {
    try {
        const { anio, mes, quincena } = req.query;
        if (!anio || !mes || !quincena) {
            return res.status(400).json({ message: 'Parámetros anio, mes y quincena requeridos' });
        }

        const [compRows] = await pool.query(
            'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies WHERE id = ?',
            [req.company_id]
        );
        const company = compRows[0] || {
            razon_social: 'EMPRESA REGISTRADA',
            nombre_comercial: 'EMPRESA',
            nit: '0000-000000-000-0',
            nrc: '000000-0'
        };

        const [planillas] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   COALESCE(
                       (SELECT d.valor_ingresado FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.codigo = '01' LIMIT 1),
                       ROUND((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15), 2)
                   ) as sueldo_quincenal,
                   COALESCE(
                       (SELECT SUM(d.valor_ingresado) FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.operacion = 'sumar'),
                       p.total_percepciones
                   ) as devengado_calc,
                   COALESCE(
                       (SELECT SUM(d.valor_ingresado) FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.operacion = 'restar'),
                       0
                   ) as otras_deducciones_calc
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.quincena = ?
            ORDER BY e.codigo ASC
        `, [req.company_id, parseInt(anio), parseInt(mes), quincena]);

        const doc = new PDFDocument({
            margin: 30,
            size: 'LETTER',
            layout: 'landscape',
            bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Planilla_${anio}_${mes}_${quincena}.pdf`);
            res.send(result);
        });

        const mesNombre = MONTH_NAMES[parseInt(mes)] || '';
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : 'SEGUNDA QUINCENA';
        const periodText = `CORRESPONDIENTE AL MES DE ${mesNombre} DE ${anio} - ${quincenaText}`;
        const title = 'Planilla de Sueldos y Salarios';
        const startX = 30;
        const contentWidth = 732;

        renderHeader(doc, company, title, periodText, 'landscape');

        const colW = {
            num: 14,
            code: 32,
            name: 154,
            cargo: 96,
            dias: 20,
            sueldoQuincenal: 48,
            ingresosAdic: 48,
            devengado: 50,
            isss: 38,
            afp: 38,
            renta: 40,
            otrasDed: 46,
            totalDed: 50,
            neto: 58
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 2;
            doc.text('Nº', x, yPos + 3.5, { width: colW.num, align: 'center', lineBreak: false }); x += colW.num;
            doc.text('CÓDIGO', x, yPos + 3.5, { width: colW.code, lineBreak: false }); x += colW.code;
            doc.text('EMPLEADO', x, yPos + 3.5, { width: colW.name, lineBreak: false }); x += colW.name;
            doc.text('CARGO / DEPTO', x, yPos + 3.5, { width: colW.cargo, lineBreak: false }); x += colW.cargo;
            doc.text('DÍAS', x, yPos + 3.5, { width: colW.dias, align: 'center', lineBreak: false }); x += colW.dias;
            doc.text('S. QUINC.', x, yPos + 3.5, { width: colW.sueldoQuincenal - 3, align: 'right', lineBreak: false }); x += colW.sueldoQuincenal;
            doc.text('ING. ADIC.', x, yPos + 3.5, { width: colW.ingresosAdic - 3, align: 'right', lineBreak: false }); x += colW.ingresosAdic;
            doc.text('TOTAL DEV.', x, yPos + 3.5, { width: colW.devengado - 3, align: 'right', lineBreak: false }); x += colW.devengado;
            doc.text('ISSS', x, yPos + 3.5, { width: colW.isss - 3, align: 'right', lineBreak: false }); x += colW.isss;
            doc.text('AFP', x, yPos + 3.5, { width: colW.afp - 3, align: 'right', lineBreak: false }); x += colW.afp;
            doc.text('RENTA', x, yPos + 3.5, { width: colW.renta - 3, align: 'right', lineBreak: false }); x += colW.renta;
            doc.text('OTRAS DED.', x, yPos + 3.5, { width: colW.otrasDed - 3, align: 'right', lineBreak: false }); x += colW.otrasDed;
            doc.text('TOTAL DED.', x, yPos + 3.5, { width: colW.totalDed - 3, align: 'right', lineBreak: false }); x += colW.totalDed;
            doc.text('NETO A PAGAR', x, yPos + 3.5, { width: colW.neto - 3, align: 'right', lineBreak: false });
            return yPos + 17;
        };

        let y = drawTableHeader(doc.y + 4);

        if (planillas.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron registros de planilla para el período seleccionado.', startX, y + 10, { lineBreak: false });
            y += 30;
        } else {
            let totalSueldoQuincenal = 0;
            let totalIngresosAdic = 0;
            let totalDevengado = 0;
            let totalISSS = 0;
            let totalAFP = 0;
            let totalRenta = 0;
            let totalOtrasDed = 0;
            let totalDeducciones = 0;
            let totalNeto = 0;

            for (let idx = 0; idx < planillas.length; idx++) {
                const p = planillas[idx];
                if (y > 530) {
                    doc.addPage();
                    renderHeader(doc, company, title, periodText, 'landscape');
                    y = drawTableHeader(doc.y + 4);
                }

                const sueldoBase = parseFloat(p.sueldo_base || 0);
                const diasTrab = parseInt(p.dias_trabajados ?? 15);
                const sueldoQuincenal = parseFloat(p.sueldo_quincenal !== null && p.sueldo_quincenal !== undefined ? p.sueldo_quincenal : ((sueldoBase / 30) * diasTrab));
                const devengado = parseFloat(p.devengado_calc !== null && p.devengado_calc !== undefined ? p.devengado_calc : (p.total_percepciones || 0));
                const ingresosAdic = Math.max(0, Math.round((devengado - sueldoQuincenal) * 100) / 100);
                const isss = parseFloat(p.descuento_isss || 0);
                const afp = parseFloat(p.descuento_afp || 0);
                const renta = parseFloat(p.descuento_renta || 0);
                const otrasDed = parseFloat(p.otras_deducciones_calc !== null && p.otras_deducciones_calc !== undefined
                    ? p.otras_deducciones_calc
                    : Math.max(0, Math.round((parseFloat(p.total_deducciones || 0) - isss - afp - renta) * 100) / 100));
                const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
                const neto = Math.round((devengado - totalDed) * 100) / 100;

                totalSueldoQuincenal += sueldoQuincenal;
                totalIngresosAdic += ingresosAdic;
                totalDevengado += devengado;
                totalISSS += isss;
                totalAFP += afp;
                totalRenta += renta;
                totalOtrasDed += otrasDed;
                totalDeducciones += totalDed;
                totalNeto += neto;

                if (idx % 2 === 1) {
                    doc.rect(startX, y - 1.5, contentWidth, 12.5).fill('#f8fafc');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
                let rx = startX + 2;
                doc.text(String(idx + 1), rx, y, { width: colW.num, align: 'center', lineBreak: false }); rx += colW.num;
                doc.text(p.empleado_codigo || '', rx, y, { width: colW.code, lineBreak: false }); rx += colW.code;
                const empNombre = `${p.empleado_nombres || ''} ${p.empleado_apellidos || ''}`.trim();
                doc.text(fitText(doc, empNombre, colW.name - 4), rx, y, { width: colW.name - 3, lineBreak: false }); rx += colW.name;
                const cargoDepto = p.cargo_nombre || p.departamento_nombre || 'GENERAL';
                doc.text(fitText(doc, cargoDepto, colW.cargo - 4), rx, y, { width: colW.cargo - 3, lineBreak: false }); rx += colW.cargo;
                doc.text(String(diasTrab), rx, y, { width: colW.dias, align: 'center', lineBreak: false }); rx += colW.dias;
                doc.text(formatCurrency(sueldoQuincenal), rx, y, { width: colW.sueldoQuincenal - 3, align: 'right', lineBreak: false }); rx += colW.sueldoQuincenal;
                doc.text(formatCurrency(ingresosAdic), rx, y, { width: colW.ingresosAdic - 3, align: 'right', lineBreak: false }); rx += colW.ingresosAdic;
                doc.text(formatCurrency(devengado), rx, y, { width: colW.devengado - 3, align: 'right', lineBreak: false }); rx += colW.devengado;
                doc.text(formatCurrency(isss), rx, y, { width: colW.isss - 3, align: 'right', lineBreak: false }); rx += colW.isss;
                doc.text(formatCurrency(afp), rx, y, { width: colW.afp - 3, align: 'right', lineBreak: false }); rx += colW.afp;
                doc.text(formatCurrency(renta), rx, y, { width: colW.renta - 3, align: 'right', lineBreak: false }); rx += colW.renta;
                doc.text(formatCurrency(otrasDed), rx, y, { width: colW.otrasDed - 3, align: 'right', lineBreak: false }); rx += colW.otrasDed;
                doc.text(formatCurrency(totalDed), rx, y, { width: colW.totalDed - 3, align: 'right', lineBreak: false }); rx += colW.totalDed;
                doc.font('Helvetica-Bold').text(formatCurrency(neto), rx, y, { width: colW.neto - 3, align: 'right', lineBreak: false });
                y += 12;
            }

            // Totales
            if (y > 515) {
                doc.addPage();
                renderHeader(doc, company, title, periodText, 'landscape');
                y = doc.y + 10;
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTALES:', startX + 2, y, { lineBreak: false });

            let tx = startX + colW.num + colW.code + colW.name + colW.cargo + colW.dias;
            doc.text(formatCurrency(totalSueldoQuincenal), tx, y, { width: colW.sueldoQuincenal - 3, align: 'right', lineBreak: false }); tx += colW.sueldoQuincenal;
            doc.text(formatCurrency(totalIngresosAdic), tx, y, { width: colW.ingresosAdic - 3, align: 'right', lineBreak: false }); tx += colW.ingresosAdic;
            doc.text(formatCurrency(totalDevengado), tx, y, { width: colW.devengado - 3, align: 'right', lineBreak: false }); tx += colW.devengado;
            doc.text(formatCurrency(totalISSS), tx, y, { width: colW.isss - 3, align: 'right', lineBreak: false }); tx += colW.isss;
            doc.text(formatCurrency(totalAFP), tx, y, { width: colW.afp - 3, align: 'right', lineBreak: false }); tx += colW.afp;
            doc.text(formatCurrency(totalRenta), tx, y, { width: colW.renta - 3, align: 'right', lineBreak: false }); tx += colW.renta;
            doc.text(formatCurrency(totalOtrasDed), tx, y, { width: colW.otrasDed - 3, align: 'right', lineBreak: false }); tx += colW.otrasDed;
            doc.text(formatCurrency(totalDeducciones), tx, y, { width: colW.totalDed - 3, align: 'right', lineBreak: false }); tx += colW.totalDed;
            doc.text(formatCurrency(totalNeto), tx, y, { width: colW.neto - 3, align: 'right', lineBreak: false });

            y += 11;
            doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y + 2).lineTo(startX + contentWidth, y + 2).stroke();
            y += 12;
        }

        renderClosingFooter(doc, startX, y, planillas.length, 'Empleados');
        renderPageNumbers(doc);
        doc.end();
    } catch (error) {
        console.error('[exportPlanillaReportePDF Error]:', error);
        res.status(500).json({ message: 'Error generando PDF de la planilla: ' + error.message });
    }
};

module.exports = {
    getPlanillas, getPlanilla, createPlanilla, updatePlanilla, deletePlanilla,
    pagarPlanilla, cerrarPeriodo, eliminarPeriodo, calcular, generarPlanilla, sincronizarPlanilla, getGruposPlanilla, exportRecibosMasivos, getEmpleadoData, getCuentasActivas, exportPDF, exportRecibo,
    exportPlanillaReportePDF
};
