const pool = require('../config/db');
const { generateVacacionPDF } = require('../services/pdf.service');
const { numberToWords } = require('../utils/numberToWords');
const notificationService = require('../services/notification.service');

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
        notificationService.notify('vacation_payroll_generated', req.company_id, req.user?.branch_id, {
            periodo: `${periodo_mes}/${periodo_año}`,
            total_empleados: 1,
            total_pagar: monto_recibir || 0,
            fecha_generacion: new Date().toISOString().split('T')[0]
        }).catch(() => {});

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
        const { empleado_id, monto, quincena } = req.query;
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
                `SELECT porcentaje_empleado, tope_mensual, tope_quincenal FROM rh_isss_tasas 
                 WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );
            if (isssRows.length > 0) {
                const tasa = isssRows[0];
                const tope = (quincena && tasa.tope_quincenal) 
                    ? parseFloat(tasa.tope_quincenal) 
                    : (tasa.tope_mensual ? parseFloat(tasa.tope_mensual) : Infinity);
                isssInfo = { porcentaje: tasa.porcentaje_empleado, tope: tope };
                const base = Math.min(vacacionesMonto, tope);
                descuentoISSS = Math.round(base * tasa.porcentaje_empleado / 100 * 100) / 100;
            }
        }

        // 3. AFP calculation (skip if jubilado)
        let descuentoAFP = 0;
        let afpInfo = null;
        if (!esJubilado && empleado.afp_id) {
            const [afpRows] = await pool.query(
                `SELECT t.porcentaje_empleado, t.tope_mensual, t.tope_quincenal, a.descripcion as afp_nombre
                 FROM rh_afp_tasas t
                 JOIN rh_afp a ON t.afp_id = a.id
                 WHERE t.company_id = ? AND t.afp_id = ? AND t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
                 ORDER BY t.fecha_desde DESC LIMIT 1`,
                [req.company_id, empleado.afp_id, today, today]
            );
            if (afpRows.length > 0) {
                const tasa = afpRows[0];
                const tope = (quincena && tasa.tope_quincenal) 
                    ? parseFloat(tasa.tope_quincenal) 
                    : (tasa.tope_mensual ? parseFloat(tasa.tope_mensual) : Infinity);
                afpInfo = { nombre: tasa.afp_nombre, porcentaje: tasa.porcentaje_empleado, tope: tope };
                const base = Math.min(vacacionesMonto, tope);
                descuentoAFP = Math.round(base * tasa.porcentaje_empleado / 100 * 100) / 100;
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
            // Normal: progressive table (prefer Q if quincena is indicated, else M)
            const tipoOrder = quincena ? "FIELD(tipo, 'Q', 'M')" : "FIELD(tipo, 'M', 'Q')";
            const [rentaConfigRows] = await pool.query(
                `SELECT id, tipo FROM rh_renta_config 
                 WHERE company_id = ? AND (tipo = 'Q' OR tipo = 'M') AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY ${tipoOrder}, fecha_desde DESC LIMIT 1`,
                [req.company_id, today, today]
            );

            if (rentaConfigRows.length > 0 && ingresoGravado > 0) {
                const [bracketRows] = await pool.query(
                    `SELECT sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle 
                     WHERE renta_config_id = ? AND sueldo_inicial <= ? AND (sueldo_final >= ? OR sueldo_final IS NULL OR sueldo_final = 0)
                     ORDER BY sueldo_inicial ASC LIMIT 1`,
                    [rentaConfigRows[0].id, ingresoGravado, ingresoGravado]
                );
                if (bracketRows.length > 0) {
                    const bracket = bracketRows[0];
                    const excedente = Math.max(0, ingresoGravado - parseFloat(bracket.exceso || 0));
                    descuentoRenta = Math.max(0, (excedente * parseFloat(bracket.porcentaje) / 100) + parseFloat(bracket.valor_descuento || 0));
                    rentaInfo = {
                        tipo: rentaConfigRows[0].tipo,
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

// --- Última planilla de vacaciones del empleado (para determinar período inicio) ---

const getUltimaVacacion = async (req, res) => {
    try {
        const { empleado_id } = req.params;
        // Most recent vacation record ordered by the final date of the service period
        const [rows] = await pool.query(
            `SELECT * FROM ${TABLE}
             WHERE empleado_id = ? AND company_id = ? AND fecha_final IS NOT NULL
             ORDER BY fecha_final DESC, id DESC LIMIT 1`,
            [empleado_id, req.company_id]
        );
        res.json(rows.length > 0 ? rows[0] : null);
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
            empleado_codigo: p.empleado_codigo,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            departamento_nombre: p.departamento_nombre,
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

// --- Empleados elegibles para vacación en un mes determinado ---

const getElegibles = async (req, res) => {
    try {
        const companyId = req.company_id;
        const now = new Date();
        const año = parseInt(req.query.año) || now.getFullYear();
        const mes = parseInt(req.query.mes) || (now.getMonth() + 1); // 1-12
        const incluirPendientes = req.query.incluir_pendientes === 'true' || req.query.incluir_pendientes === '1';

        // 1. Obtener empleados activos
        const [empleados] = await pool.query(`
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, 
                   DATE_FORMAT(e.fecha_ingreso, '%Y-%m-%d') as fecha_ingreso,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1
            ORDER BY e.apellidos ASC, e.nombres ASC
        `, [companyId]);

        // 2. Obtener todas las planillas de vacaciones de la empresa
        const [vacaciones] = await pool.query(`
            SELECT id, empleado_id, 
                   DATE_FORMAT(fecha_inicial, '%Y-%m-%d') as fecha_inicial,
                   DATE_FORMAT(fecha_final, '%Y-%m-%d') as fecha_final,
                   periodo_año, periodo_mes, vacaciones_monto
            FROM rh_planilla_vacaciones
            WHERE company_id = ? AND fecha_final IS NOT NULL
            ORDER BY fecha_final DESC, id DESC
        `, [companyId]);

        const vacacionesPorEmpleado = {};
        for (const v of vacaciones) {
            if (!vacacionesPorEmpleado[v.empleado_id]) {
                vacacionesPorEmpleado[v.empleado_id] = [];
            }
            vacacionesPorEmpleado[v.empleado_id].push(v);
        }

        const ultimoDiaMes = new Date(año, mes, 0).getDate();
        const fechaFinMesStr = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;
        const fechaFinMes = new Date(`${fechaFinMesStr}T23:59:59`);

        const elegibles = [];

        for (const emp of empleados) {
            if (!emp.fecha_ingreso) continue;

            const fechaIngresoStr = emp.fecha_ingreso;
            const [ingAño, ingMes, ingDia] = fechaIngresoStr.split('-').map(Number);
            const fechaIngresoDate = new Date(`${fechaIngresoStr}T00:00:00`);

            // Total de días desde el ingreso hasta el fin del mes evaluado
            const diffMsIngreso = fechaFinMes.getTime() - fechaIngresoDate.getTime();
            const diasTotalesIngreso = Math.floor(diffMsIngreso / (1000 * 60 * 60 * 24));

            // Debe tener al menos 365 días continuos de servicio (Art. 177 C.Tr.)
            if (diasTotalesIngreso < 365) {
                continue;
            }

            const empVacaciones = vacacionesPorEmpleado[emp.id] || [];
            const ultimaVacacion = empVacaciones.length > 0 ? empVacaciones[0] : null;

            let fechaInicioPeriodo = '';
            let fechaFinPeriodo = '';
            let diasServicioPeriodo = 0;
            let esMesAniversario = false;
            let origen = '';
            let ultimaFechaFinalStr = null;

            if (ultimaVacacion && ultimaVacacion.fecha_final) {
                // --- CASO 1: El empleado TIENE vacación previa registrada ---
                origen = 'ultima_vacacion';
                ultimaFechaFinalStr = ultimaVacacion.fecha_final;

                const ultFinalDate = new Date(`${ultimaFechaFinalStr}T00:00:00`);
                const sigInicioDate = new Date(ultFinalDate);
                sigInicioDate.setDate(sigInicioDate.getDate() + 1);
                fechaInicioPeriodo = sigInicioDate.toISOString().substring(0, 10);

                const sigFinDate = new Date(sigInicioDate);
                sigFinDate.setDate(sigFinDate.getDate() + 364); // Ciclo anual de 365 días
                fechaFinPeriodo = sigFinDate.toISOString().substring(0, 10);

                const mesCumplimiento = sigFinDate.getMonth() + 1;
                const añoCumplimiento = sigFinDate.getFullYear();

                const diffMs = fechaFinMes.getTime() - sigInicioDate.getTime();
                diasServicioPeriodo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

                // Cumple aniversario en el mes y año consultado
                esMesAniversario = (mesCumplimiento === mes && añoCumplimiento === año);

                // Verificar si ya tiene registrada una planilla para este ciclo
                const yaRegistrada = empVacaciones.some(v => {
                    const vIni = v.fecha_inicial || '';
                    return (vIni && vIni >= fechaInicioPeriodo) || (v.periodo_año === año && v.periodo_mes === mes);
                });
                if (yaRegistrada) continue;

                // Debe tener al menos 365 días en este período a la fecha evaluada
                if (diasServicioPeriodo < 365) continue;

                // Para no salir todos los meses, solo se muestra en su mes aniversario a menos que se incluya acumuladas
                if (!esMesAniversario && !incluirPendientes) {
                    continue;
                }

            } else {
                // --- CASO 2: El empleado NO TIENE vacaciones previas ---
                origen = 'fecha_ingreso';

                // Su mes aniversario de ley es el mes de contratación
                const mesAniversario = ingMes;
                esMesAniversario = (mesAniversario === mes);

                // Regla solicitada: si tiene p. ej. 1588 días para no salir todos los meses,
                // se computa desde su fecha de ingreso pero del año anterior
                const añoAnterior = año - 1;
                const maxDiasMesAnt = new Date(añoAnterior, ingMes, 0).getDate();
                const diaInicioAjustado = Math.min(ingDia, maxDiasMesAnt);
                const fechaInicioDate = new Date(`${añoAnterior}-${String(ingMes).padStart(2, '0')}-${String(diaInicioAjustado).padStart(2, '0')}T00:00:00`);
                fechaInicioPeriodo = fechaInicioDate.toISOString().substring(0, 10);

                const maxDiasMesAct = new Date(año, ingMes, 0).getDate();
                const diaFinAjustado = Math.min(ingDia, maxDiasMesAct);
                const fechaFinDate = new Date(`${año}-${String(ingMes).padStart(2, '0')}-${String(diaFinAjustado).padStart(2, '0')}T00:00:00`);
                fechaFinPeriodo = fechaFinDate.toISOString().substring(0, 10);

                const diffMsPeriodo = fechaFinDate.getTime() - fechaInicioDate.getTime();
                diasServicioPeriodo = Math.floor(diffMsPeriodo / (1000 * 60 * 60 * 24)) + 1;

                // Para evitar que salga todos los meses del año (p.ej. 1588 días)
                if (!esMesAniversario && !incluirPendientes) {
                    continue;
                }

                // Verificar si ya existe vacación registrada para este año y mes
                const yaRegistrada = empVacaciones.some(v => v.periodo_año === año && v.periodo_mes === mes);
                if (yaRegistrada) continue;
            }

            // Estimación económica de ley: 15 días continuos + 30% recargo
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const sueldoDiario = sueldoBase / 30;
            const montoBase = sueldoDiario * 15;
            const vacacionesMonto = Math.round(montoBase * 1.30 * 100) / 100;

            elegibles.push({
                empleado_id: emp.id,
                empleado_codigo: emp.codigo,
                empleado_nombres: emp.nombres,
                empleado_apellidos: emp.apellidos,
                nombre_completo: `${emp.nombres} ${emp.apellidos}`,
                cargo_nombre: emp.cargo_nombre || 'Sin cargo',
                departamento_nombre: emp.departamento_nombre || 'General',
                sueldo_base: sueldoBase,
                fecha_ingreso: fechaIngresoStr,
                dias_totales_empresa: diasTotalesIngreso,
                ultima_vacacion_fecha_final: ultimaFechaFinalStr,
                origen,
                fecha_inicio_periodo: fechaInicioPeriodo,
                fecha_fin_periodo: fechaFinPeriodo,
                dias_servicio: diasServicioPeriodo,
                vacaciones_monto_estimado: vacacionesMonto,
                es_mes_aniversario: esMesAniversario,
                estado: esMesAniversario ? 'cumple_este_mes' : 'pendiente_acumulada'
            });
        }

        res.json({
            año,
            mes,
            total: elegibles.length,
            data: elegibles
        });
    } catch (error) {
        console.error('[Vacaciones Elegibles] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPlanillas, getPlanilla, createPlanilla, updatePlanilla, deletePlanilla,
    calcular, getEmpleadoData, getUltimaVacacion, getElegibles, exportPDF
};
