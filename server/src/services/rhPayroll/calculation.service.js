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

        let descuentoRenta = 0;
        const ingresoGravadoQ2 = Math.max(0, totalPercepciones - descuentoISSS - descuentoAFP);
        let rentaInfo = null;

        // Renta: solo aplica en 2da quincena y si el empleado tiene aplica_renta = 1
        // Usa tabla MENSUAL (tipo 'M') acumulando 1ra y 2da quincena
        const aplicaRentaCalc = quincena === 'segunda' && (aplicaRenta !== false);

        if (aplicaRentaCalc) {
            let q1Gravado = 0;
            let prevRentaQ1 = 0;

            if (periodoAnio && periodoMes) {
                const [q1Rows] = await pool.query(
                    `SELECT total_percepciones, descuento_isss, descuento_afp, descuento_renta
                     FROM ${TABLE}
                     WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = 'primera'
                     LIMIT 1`,
                    [req.company_id, empleadoId, periodoAnio, periodoMes]
                );
                if (q1Rows.length > 0) {
                    const q1 = q1Rows[0];
                    q1Gravado = Math.max(0, parseFloat(q1.total_percepciones || 0) - parseFloat(q1.descuento_isss || 0) - parseFloat(q1.descuento_afp || 0));
                    prevRentaQ1 = parseFloat(q1.descuento_renta || 0);
                }
            }

            const ingresoGravadoTotalMes = Math.max(0, ingresoGravadoQ2 + q1Gravado);

            if (esJubilado) {
                const rentaTotal = Math.round(ingresoGravadoTotalMes * 0.10 * 100) / 100;
                descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                rentaInfo = { tipo: 'jubilado', porcentaje: 10, ingreso_gravado: Math.round(ingresoGravadoTotalMes * 100) / 100, ingreso_gravado_q2: Math.round(ingresoGravadoQ2 * 100) / 100, ingreso_gravado_q1: Math.round(q1Gravado * 100) / 100, renta_anterior: prevRentaQ1 };
            } else {
                const [rentaConfigRows] = await pool.query(
                    `SELECT id, tipo FROM rh_renta_config 
                     WHERE company_id = ? AND tipo = 'M' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                     ORDER BY fecha_desde DESC LIMIT 1`,
                    [req.company_id, today, today]
                );

                if (rentaConfigRows.length > 0 && ingresoGravadoTotalMes > 0) {
                    const [bracketRows] = await pool.query(
                        `SELECT sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso FROM rh_renta_config_detalle 
                         WHERE renta_config_id = ? AND sueldo_inicial <= ? AND sueldo_final >= ?
                         ORDER BY sueldo_inicial ASC LIMIT 1`,
                        [rentaConfigRows[0].id, ingresoGravadoTotalMes, ingresoGravadoTotalMes]
                    );
                    if (bracketRows.length > 0) {
                        const bracket = bracketRows[0];
                        const excedente = ingresoGravadoTotalMes - bracket.exceso;
                        const rentaTotal = Math.max(0, (excedente * bracket.porcentaje / 100) + parseFloat(bracket.valor_descuento));
                        descuentoRenta = Math.max(0, rentaTotal - prevRentaQ1);
                        rentaInfo = {
                            sueldo_inicial: bracket.sueldo_inicial,
                            sueldo_final: bracket.sueldo_final,
                            porcentaje: bracket.porcentaje,
                            valor_descuento: bracket.valor_descuento,
                            exceso: bracket.exceso,
                            excedente: Math.round(excedente * 100) / 100,
                            ingreso_gravado: Math.round(ingresoGravadoTotalMes * 100) / 100,
                            ingreso_gravado_q2: Math.round(ingresoGravadoQ2 * 100) / 100,
                            ingreso_gravado_q1: Math.round(q1Gravado * 100) / 100,
                            renta_anterior: prevRentaQ1
                        };
                    }
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
