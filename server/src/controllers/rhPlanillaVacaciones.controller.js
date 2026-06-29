const pool = require('../config/db');
const { generateVacacionPDF } = require('../services/pdf.service');
const { numberToWords } = require('../utils/numberToWords');

const TABLE = 'rh_planilla_vacaciones';
const LABEL = 'Planilla de Vacaciones';

const getNextCode = (prefix) => {
    // placeholder for future code generation if needed
    return null;
};

// --- CRUD ---

const getPlanillas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, año, mes } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT pv.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pv
            JOIN rh_empleados e ON pv.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pv.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pv.periodo_año = ?`;
            params.push(parseInt(año));
        }
        if (mes) {
            query += ` AND pv.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY pv.periodo_año DESC, pv.periodo_mes DESC, pv.id DESC LIMIT ? OFFSET ?`;
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
            `SELECT pv.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.cargo_id,
                    e.departamento_personal_id,
                    e.afp_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} pv
             JOIN rh_empleados e ON pv.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE pv.id = ? AND pv.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createPlanilla = async (req, res) => {
    try {
        const {
            empleado_id, periodo_año, periodo_mes, quincena,
            fecha_inicial, fecha_final, dias_transcurridos, vacaciones_monto,
            descuento_isss, descuento_afp, descuento_renta,
            total_devengado, total_deducciones, monto_recibir
        } = req.body;

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} 
             (company_id, empleado_id, periodo_año, periodo_mes, quincena,
              fecha_inicial, fecha_final, dias_transcurridos, vacaciones_monto,
              descuento_isss, descuento_afp, descuento_renta,
              total_devengado, total_deducciones, monto_recibir)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, empleado_id, periodo_año, periodo_mes, quincena,
             fecha_inicial, fecha_final, dias_transcurridos || 0, vacaciones_monto || 0,
             descuento_isss || 0, descuento_afp || 0, descuento_renta || 0,
             total_devengado || 0, total_deducciones || 0, monto_recibir || 0]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updatePlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            empleado_id, periodo_año, periodo_mes, quincena,
            fecha_inicial, fecha_final, dias_transcurridos, vacaciones_monto,
            descuento_isss, descuento_afp, descuento_renta,
            total_devengado, total_deducciones, monto_recibir
        } = req.body;

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET
             empleado_id = ?, periodo_año = ?, periodo_mes = ?, quincena = ?,
             fecha_inicial = ?, fecha_final = ?, dias_transcurridos = ?, vacaciones_monto = ?,
             descuento_isss = ?, descuento_afp = ?, descuento_renta = ?,
             total_devengado = ?, total_deducciones = ?, monto_recibir = ?
             WHERE id = ? AND company_id = ?`,
            [empleado_id, periodo_año, periodo_mes, quincena,
             fecha_inicial, fecha_final, dias_transcurridos || 0, vacaciones_monto || 0,
             descuento_isss || 0, descuento_afp || 0, descuento_renta || 0,
             total_devengado || 0, total_deducciones || 0, monto_recibir || 0,
             id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
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

// --- CÁLCULO DE DEDUCCIONES ---

const calcular = async (req, res) => {
    try {
        const { empleado_id, monto } = req.query;
        if (!empleado_id || !monto) {
            return res.status(400).json({ message: 'empleado_id y monto son requeridos' });
        }

        const vacacionesMonto = parseFloat(monto) || 0;
        const today = new Date().toISOString().split('T')[0];

        // 1. Get employee data
        const [empRows] = await pool.query(
            `SELECT afp_id, sueldo_base, bonificacion_fija, es_jubilado FROM rh_empleados WHERE id = ? AND company_id = ?`,
            [empleado_id, req.company_id]
        );
        if (empRows.length === 0) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }
        const empleado = empRows[0];
        const esJubilado = !!empleado.es_jubilado;

        // 2. ISSS calculation (skip if jubilado)
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
                descuentoISSS = Math.min(vacacionesMonto * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        // 3. AFP calculation (skip if jubilado)
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
                descuentoAFP = Math.min(vacacionesMonto * tasa.porcentaje_empleado / 100, tasa.tope_mensual || Infinity);
            }
        }

        // 4. Renta calculation
        let descuentoRenta = 0;
        const ingresoGravado = vacacionesMonto - descuentoISSS - descuentoAFP;
        let rentaInfo = null;

        if (esJubilado) {
            // Jubilado: flat 10% ISR
            descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
            rentaInfo = { tipo: 'jubilado', porcentaje: 10, ingreso_gravado: Math.round(ingresoGravado * 100) / 100 };
        } else {
            // Normal: progressive table
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

        const totalDeducciones = descuentoISSS + descuentoAFP + descuentoRenta;

        res.json({
            base_sueldo: empleado.sueldo_base,
            vacaciones_monto: vacacionesMonto,
            descuento_isss: Math.round(descuentoISSS * 100) / 100,
            descuento_afp: Math.round(descuentoAFP * 100) / 100,
            descuento_renta: Math.round(descuentoRenta * 100) / 100,
            isss_info: isssInfo,
            afp_info: afpInfo,
            renta_info: rentaInfo,
            es_jubilado: esJubilado,
            total_devengado: vacacionesMonto,
            total_deducciones: Math.round(totalDeducciones * 100) / 100,
            monto_recibir: Math.round((vacacionesMonto - totalDeducciones) * 100) / 100
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Obtener datos completos del empleado para prellenado ---

const getEmpleadoData = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.bonificacion_fija,
                    e.afp_id, e.cargo_id, e.departamento_personal_id,
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

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pv.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.num_dui, e.num_nit,
                    e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM rh_planilla_vacaciones pv
            JOIN rh_empleados e ON pv.empleado_id = e.id
            JOIN companies comp ON pv.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pv.id = ? AND pv.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        // Fetch ISSS/AFP rates for display
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
            fecha_ingreso: p.fecha_ingreso,
            fecha_inicial: p.fecha_inicial,
            fecha_final: p.fecha_final,
            vacaciones_monto: p.vacaciones_monto,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            total_devengado: p.total_devengado,
            total_deducciones: p.total_deducciones,
            total_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generateVacacionPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Vacacion_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Vacaciones PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

module.exports = {
    getPlanillas, getPlanilla, createPlanilla, updatePlanilla, deletePlanilla,
    calcular, getEmpleadoData, exportPDF
};
