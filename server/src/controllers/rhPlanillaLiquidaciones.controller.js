const pool = require('../config/db');
const { generateLiquidacionPDF, generateFiniquitoPDF, generateAcuerdoPagoPDF } = require('../services/pdf.service');
const { numberToWords } = require('../utils/numberToWords');

const TABLE = 'rh_planilla_liquidaciones';
const LABEL = 'Planilla de Liquidaciones';

// --- CRUD ---

const getLiquidaciones = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, año, mes } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pl.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pl.periodo_año = ?`;
            params.push(parseInt(año));
        }
        if (mes) {
            query += ` AND pl.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY pl.periodo_año DESC, pl.periodo_mes DESC, pl.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getLiquidacion = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT pl.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.cargo_id,
                    e.departamento_personal_id,
                    e.afp_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} pl
             JOIN rh_empleados e ON pl.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE pl.id = ? AND pl.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createLiquidacion = async (req, res) => {
    try {
        const {
            empleado_id, periodo_año, periodo_mes,
            periodo_indemnizacion_desde, periodo_indemnizacion_hasta,
            periodo_vacaciones_desde, periodo_vacaciones_hasta,
            periodo_aguinaldo_desde, periodo_aguinaldo_hasta,
            dias_indemnizacion, dias_vacaciones, dias_aguinaldo,
            ultimos_dias_laborados, pago_ultimos_dias,
            total_indemnizacion, total_vacaciones, total_aguinaldo, total_devengado,
            descuento_isss, descuento_afp, descuento_renta, otros_descuentos, total_deducciones, monto_recibir,
            pago_cuotas, cuotas, pago_por_cuota
        } = req.body;

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} 
             (company_id, empleado_id, periodo_año, periodo_mes,
              periodo_indemnizacion_desde, periodo_indemnizacion_hasta,
              periodo_vacaciones_desde, periodo_vacaciones_hasta,
              periodo_aguinaldo_desde, periodo_aguinaldo_hasta,
              dias_indemnizacion, dias_vacaciones, dias_aguinaldo,
              ultimos_dias_laborados, pago_ultimos_dias,
              total_indemnizacion, total_vacaciones, total_aguinaldo, total_devengado,
              descuento_isss, descuento_afp, descuento_renta, otros_descuentos, total_deducciones, monto_recibir,
              pago_cuotas, cuotas, pago_por_cuota)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, empleado_id, periodo_año, periodo_mes,
             periodo_indemnizacion_desde || null, periodo_indemnizacion_hasta || null,
             periodo_vacaciones_desde || null, periodo_vacaciones_hasta || null,
             periodo_aguinaldo_desde || null, periodo_aguinaldo_hasta || null,
             dias_indemnizacion || 0, dias_vacaciones || 0, dias_aguinaldo || 0,
             ultimos_dias_laborados || null, pago_ultimos_dias || 0,
             total_indemnizacion || 0, total_vacaciones || 0, total_aguinaldo || 0, total_devengado || 0,
             descuento_isss || 0, descuento_afp || 0, descuento_renta || 0, otros_descuentos || 0, total_deducciones || 0, monto_recibir || 0,
             pago_cuotas ? 1 : 0, cuotas || 1, pago_por_cuota || 0]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateLiquidacion = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            empleado_id, periodo_año, periodo_mes,
            periodo_indemnizacion_desde, periodo_indemnizacion_hasta,
            periodo_vacaciones_desde, periodo_vacaciones_hasta,
            periodo_aguinaldo_desde, periodo_aguinaldo_hasta,
            dias_indemnizacion, dias_vacaciones, dias_aguinaldo,
            ultimos_dias_laborados, pago_ultimos_dias,
            total_indemnizacion, total_vacaciones, total_aguinaldo, total_devengado,
            descuento_isss, descuento_afp, descuento_renta, otros_descuentos, total_deducciones, monto_recibir,
            pago_cuotas, cuotas, pago_por_cuota
        } = req.body;

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET
             empleado_id = ?, periodo_año = ?, periodo_mes = ?,
             periodo_indemnizacion_desde = ?, periodo_indemnizacion_hasta = ?,
             periodo_vacaciones_desde = ?, periodo_vacaciones_hasta = ?,
             periodo_aguinaldo_desde = ?, periodo_aguinaldo_hasta = ?,
             dias_indemnizacion = ?, dias_vacaciones = ?, dias_aguinaldo = ?,
             ultimos_dias_laborados = ?, pago_ultimos_dias = ?,
             total_indemnizacion = ?, total_vacaciones = ?, total_aguinaldo = ?, total_devengado = ?,
             descuento_isss = ?, descuento_afp = ?, descuento_renta = ?, otros_descuentos = ?, total_deducciones = ?, monto_recibir = ?,
             pago_cuotas = ?, cuotas = ?, pago_por_cuota = ?
             WHERE id = ? AND company_id = ?`,
            [empleado_id, periodo_año, periodo_mes,
             periodo_indemnizacion_desde || null, periodo_indemnizacion_hasta || null,
             periodo_vacaciones_desde || null, periodo_vacaciones_hasta || null,
             periodo_aguinaldo_desde || null, periodo_aguinaldo_hasta || null,
             dias_indemnizacion || 0, dias_vacaciones || 0, dias_aguinaldo || 0,
             ultimos_dias_laborados || null, pago_ultimos_dias || 0,
             total_indemnizacion || 0, total_vacaciones || 0, total_aguinaldo || 0, total_devengado || 0,
             descuento_isss || 0, descuento_afp || 0, descuento_renta || 0, otros_descuentos || 0, total_deducciones || 0, monto_recibir || 0,
             pago_cuotas ? 1 : 0, cuotas || 1, pago_por_cuota || 0,
             id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteLiquidacion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- CÁLCULO DE DEDUCCIONES ---

const calcular = async (req, res) => {
    try {
        const { empleado_id, monto } = req.query;
        if (!empleado_id || !monto) {
            return res.status(400).json({ message: 'empleado_id y monto son requeridos' });
        }

        const totalDevengado = parseFloat(monto) || 0;
        const today = new Date().toISOString().split('T')[0];

        const [empRows] = await pool.query(
            `SELECT afp_id, sueldo_base, es_jubilado FROM rh_empleados WHERE id = ? AND company_id = ?`,
            [empleado_id, req.company_id]
        );
        if (empRows.length === 0) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }
        const empleado = empRows[0];
        const esJubilado = !!empleado.es_jubilado;

        // ISSS (skip if jubilado)
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
                descuentoISSS = Math.min(totalDevengado * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        // AFP (skip if jubilado)
        let descuentoAFP = 0;
        let afpInfo = null;
        if (!esJubilado && empleado.afp_id) {
            const [afpRows] = await pool.query(
                `SELECT t.porcentaje_empleado, t.tope_mensual, a.descripcion as afp_nombre
                 FROM rh_afp_tasas t
                 JOIN rh_afp a ON t.afp_id = a.id
                 WHERE t.company_id = ? AND t.afp_id = ? AND t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
                 ORDER BY t.fecha_desde DESC LIMIT 1`,
                [req.company_id, empleado.afp_id, today, today]
            );
            if (afpRows.length > 0) {
                const tasa = afpRows[0];
                afpInfo = { nombre: tasa.afp_nombre, porcentaje: tasa.porcentaje_empleado, tope: tasa.tope_mensual };
                descuentoAFP = Math.min(totalDevengado * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        // Renta
        let descuentoRenta = 0;
        const ingresoGravado = totalDevengado - descuentoISSS - descuentoAFP;
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
        let rentaInfo = null;
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

        const totalDeducciones = descuentoISSS + descuentoAFP + descuentoRenta;

        res.json({
            base_sueldo: empleado.sueldo_base,
            descuento_isss: Math.round(descuentoISSS * 100) / 100,
            descuento_afp: Math.round(descuentoAFP * 100) / 100,
            descuento_renta: Math.round(descuentoRenta * 100) / 100,
            isss_info: isssInfo,
            afp_info: afpInfo,
            renta_info: rentaInfo,
            es_jubilado: esJubilado,
            total_devengado: totalDevengado,
            total_deducciones_auto: Math.round(totalDeducciones * 100) / 100,
            monto_antes_otros: Math.round((totalDevengado - totalDeducciones) * 100) / 100
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Datos del empleado para prellenado ---

const getEmpleadoData = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.bonificacion_fija,
                    e.afp_id, e.cargo_id, e.departamento_personal_id, e.fecha_ingreso,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM rh_empleados e
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE e.id = ? AND e.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Última liquidación del empleado ---

const getUltimaLiquidacion = async (req, res) => {
    try {
        const { empleado_id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM ${TABLE} WHERE empleado_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1`,
            [empleado_id, req.company_id]
        );
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- PDF ---

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];

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
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            fecha_ingreso: p.fecha_ingreso,
            periodo_indemnizacion_desde: p.periodo_indemnizacion_desde,
            periodo_indemnizacion_hasta: p.periodo_indemnizacion_hasta,
            periodo_vacaciones_desde: p.periodo_vacaciones_desde,
            periodo_vacaciones_hasta: p.periodo_vacaciones_hasta,
            periodo_aguinaldo_desde: p.periodo_aguinaldo_desde,
            periodo_aguinaldo_hasta: p.periodo_aguinaldo_hasta,
            dias_indemnizacion: p.dias_indemnizacion,
            dias_vacaciones: p.dias_vacaciones,
            dias_aguinaldo: p.dias_aguinaldo,
            ultimos_dias_laborados: p.ultimos_dias_laborados,
            pago_ultimos_dias: p.pago_ultimos_dias,
            total_indemnizacion: p.total_indemnizacion,
            total_vacaciones: p.total_vacaciones,
            total_aguinaldo: p.total_aguinaldo,
            total_devengado: p.total_devengado,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            otros_descuentos: p.otros_descuentos,
            total_deducciones: p.total_deducciones,
            monto_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            pago_cuotas: p.pago_cuotas,
            cuotas: p.cuotas,
            pago_por_cuota: p.pago_por_cuota,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generateLiquidacionPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Liquidacion_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Liquidaciones PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportFiniquito = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.query;

        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];

        let empleadorNombre = p.company_name;
        let notarioNombre = '', notarioDomicilio = '', notarioDept = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, notario_nombre, notario_domicilio, notario_departamento FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) empleadorNombre = rhCfg[0].responsable_nombre;
            notarioNombre = rhCfg[0].notario_nombre || '';
            notarioDomicilio = rhCfg[0].notario_domicilio || '';
            notarioDept = rhCfg[0].notario_departamento || '';
        }

        const pdfData = {
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            cargo_nombre: p.cargo_nombre,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            empleador_nombre: empleadorNombre,
            notario_nombre: notarioNombre,
            notario_domicilio: notarioDomicilio,
            notario_dept: notarioDept,
            motivo: motivo || 'RENUNCIA INMEDIATA'
        };

        const pdfBuffer = await generateFiniquitoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Finiquito_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Finiquito PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de finiquito' });
    }
};

const exportAcuerdoPago = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_dui, e.num_nit,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];
        if (!p.pago_cuotas) return res.status(400).json({ message: 'Esta liquidacion no tiene pago en cuotas' });

        let empleadorNombre = p.company_name;
        let notarioNombre = '', notarioDomicilio = '', notarioDept = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, notario_nombre, notario_domicilio, notario_departamento FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) empleadorNombre = rhCfg[0].responsable_nombre;
            notarioNombre = rhCfg[0].notario_nombre || '';
            notarioDomicilio = rhCfg[0].notario_domicilio || '';
            notarioDept = rhCfg[0].notario_departamento || '';
        }

        const pdfData = {
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            cargo_nombre: p.cargo_nombre,
            num_dui: p.num_dui,
            empleador_nombre: empleadorNombre,
            notario_nombre: notarioNombre,
            notario_domicilio: notarioDomicilio,
            notario_dept: notarioDept,
            monto_recibir: p.monto_recibir,
            cuotas: p.cuotas,
            pago_por_cuota: p.pago_por_cuota
        };

        const pdfBuffer = await generateAcuerdoPagoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=AcuerdoPago_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[AcuerdoPago PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de acuerdo de pago' });
    }
};

module.exports = {
    getLiquidaciones, getLiquidacion, createLiquidacion, updateLiquidacion, deleteLiquidacion,
    calcular, getEmpleadoData, getUltimaLiquidacion, exportPDF, exportFiniquito, exportAcuerdoPago
};
