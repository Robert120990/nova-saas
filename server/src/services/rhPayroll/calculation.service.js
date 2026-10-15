const { TABLE, LABEL } = require('./shared');

const calcular = async (req, res, pool) => {
    try {
        const { planilla_id, empleado_id: reqEmpleadoId, detalles: reqDetalles, quincena: reqQuincena, periodo_anio: reqPeriodoAnio, periodo_mes: reqPeriodoMes } = req.body;

        let empleadoId, afpId, esJubilado, aplicaRenta, detalles, quincena = reqQuincena || 'primera';
        let planilla = null;
        let periodoAnio = reqPeriodoAnio || null;
        let periodoMes = reqPeriodoMes || null;

        if (planilla_id) {
            const [planillaRows] = await pool.query(
                `SELECT p.*, e.afp_id, e.es_jubilado, e.aplica_renta, e.sueldo_base, e.bonificacion_fija
                 FROM ${TABLE} p
                 JOIN rh_empleados e ON p.empleado_id = e.id
                 WHERE p.id = ? AND p.company_id = ?`,
                [planilla_id, req.company_id]
            );
            if (planillaRows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
            planilla = planillaRows[0];
            if (planilla.estado === 'pagada') {
                return res.status(400).json({ message: 'No se puede recalcular una planilla pagada y cerrada.' });
            }
            empleadoId = planilla.empleado_id;
            afpId = planilla.afp_id;
            esJubilado = !!planilla.es_jubilado;
            aplicaRenta = planilla.aplica_renta === 0 ? false : true;
            quincena = planilla.quincena || quincena;
            periodoAnio = planilla.periodo_anio;
            periodoMes = planilla.periodo_mes;

            const [dRows] = await pool.query(
                `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ?`,
                [planilla_id]
            );
            detalles = dRows;
        } else if (reqEmpleadoId && reqDetalles) {
            empleadoId = reqEmpleadoId;
            const [empRows] = await pool.query(
                `SELECT afp_id, es_jubilado, aplica_renta FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [reqEmpleadoId, req.company_id]
            );
            if (empRows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
            afpId = empRows[0].afp_id;
            esJubilado = !!empRows[0].es_jubilado;
            aplicaRenta = empRows[0].aplica_renta === 0 ? false : true;
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

        const { getRentaContext, computeEmployeeRenta } = require('./rentaCalculation.service');
        const ingresoGravado = Math.max(0, totalPercepciones - descuentoISSS - descuentoAFP);
        const rentaCtx = await getRentaContext(req.company_id, quincena, today);

        let q1Data = null;
        if (rentaCtx.calculoRentaModo === 'segunda_quincena' && quincena === 'segunda' && periodoAnio && periodoMes) {
            const [q1Rows] = await pool.query(
                `SELECT total_percepciones, descuento_isss, descuento_afp, descuento_renta
                 FROM ${TABLE}
                 WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = 'primera'
                 LIMIT 1`,
                [req.company_id, empleadoId, periodoAnio, periodoMes]
            );
            if (q1Rows.length > 0) {
                q1Data = q1Rows[0];
            }
        }

        const aplicaRentaCalc = (aplicaRenta !== false && aplicaRenta !== 0);
        const { descuentoRenta: calcDescuentoRenta, rentaInfo } = computeEmployeeRenta({
            modo: rentaCtx.calculoRentaModo,
            brackets: rentaCtx.brackets,
            ingresoGravado,
            esJubilado,
            aplicaRenta: aplicaRentaCalc,
            quincena,
            q1Data
        });
        let descuentoRenta = calcDescuentoRenta;

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
                 monto_recibir = ?, updated_at = NOW()
                 WHERE id = ? AND company_id = ?`,
                [totalPercepciones, totalDeducciones,
                 descuentoISSS, descuentoAFP, descuentoRenta,
                 montoRecibir, planilla_id, req.company_id]
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

async function recalculateSavedPlanilla(connection, companyId, id) {
    const result = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    await calcular({ company_id: companyId, body: { planilla_id: id } }, result, connection);
    if (result.statusCode >= 400) {
        const error = new Error(result.body.message);
        error.statusCode = result.statusCode;
        throw error;
    }
    return result.body;
}

module.exports = { calcular, recalculateSavedPlanilla };
