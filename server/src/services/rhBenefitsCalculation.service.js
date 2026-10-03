const httpError = (status, message) => Object.assign(new Error(message), { status });

async function calculateVacaciones(pool, companyId, query) {

        const { empleado_id, monto, quincena } = query;
        if (!empleado_id || !monto) {
            throw httpError(400, 'empleado_id y monto son requeridos');
        }

        const vacacionesMonto = parseFloat(monto) || 0;
        const today = new Date().toISOString().split('T')[0];

        // 1. Get employee data
        const [empRows] = await pool.query(
            `SELECT afp_id, sueldo_base, bonificacion_fija, es_jubilado FROM rh_empleados WHERE id = ? AND company_id = ?`,
            [empleado_id, companyId]
        );
        if (empRows.length === 0) {
            throw httpError(404, 'Empleado no encontrado');
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
                [companyId, today, today]
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
                [companyId, empleado.afp_id, today, today]
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
                [companyId, today, today]
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

        return {
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
        };
}

async function calculateLiquidaciones(pool, companyId, query) {

        const { empleado_id, monto, vacaciones, aguinaldo, ultimos_dias } = query;
        if (!empleado_id) {
            throw httpError(400, 'empleado_id es requerido');
        }

        const montoVacaciones = parseFloat(vacaciones) || 0;
        const montoAguinaldo = parseFloat(aguinaldo) || 0;
        const montoUltimosDias = parseFloat(ultimos_dias) || 0;

        // Base sujeta a ISSS y AFP: Vacaciones + Salarios pendientes (el aguinaldo e indemnización están exentos)
        const baseCotizable = (vacaciones !== undefined || ultimos_dias !== undefined)
            ? (montoVacaciones + montoUltimosDias)
            : (parseFloat(monto) || 0);

        const excedenteAguinaldo = Math.max(0, montoAguinaldo - 1500);

        const today = new Date().toISOString().split('T')[0];

        const [empRows] = await pool.query(
            `SELECT afp_id, sueldo_base, es_jubilado FROM rh_empleados WHERE id = ? AND company_id = ?`,
            [empleado_id, companyId]
        );
        if (empRows.length === 0) {
            throw httpError(404, 'Empleado no encontrado');
        }
        const empleado = empRows[0];
        const esJubilado = !!empleado.es_jubilado;

        // ISSS (skip if jubilado)
        let descuentoISSS = 0;
        let isssInfo = null;
        if (!esJubilado && baseCotizable > 0) {
            const [isssRows] = await pool.query(
                `SELECT porcentaje_empleado, tope_mensual FROM rh_isss_tasas 
                 WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [companyId, today, today]
            );
            if (isssRows.length > 0) {
                const tasa = isssRows[0];
                const tope = tasa.tope_mensual ? parseFloat(tasa.tope_mensual) : Infinity;
                isssInfo = { porcentaje: tasa.porcentaje_empleado, tope };
                const base = Math.min(baseCotizable, tope);
                descuentoISSS = Math.round(base * tasa.porcentaje_empleado / 100 * 100) / 100;
            }
        }

        // AFP (skip if jubilado)
        let descuentoAFP = 0;
        let afpInfo = null;
        if (!esJubilado && empleado.afp_id && baseCotizable > 0) {
            const [afpRows] = await pool.query(
                `SELECT t.porcentaje_empleado, t.tope_mensual, a.descripcion as afp_nombre
                 FROM rh_afp_tasas t
                 JOIN rh_afp a ON t.afp_id = a.id
                 WHERE t.company_id = ? AND t.afp_id = ? AND t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
                 ORDER BY t.fecha_desde DESC LIMIT 1`,
                [companyId, empleado.afp_id, today, today]
            );
            if (afpRows.length > 0) {
                const tasa = afpRows[0];
                const tope = tasa.tope_mensual ? parseFloat(tasa.tope_mensual) : Infinity;
                afpInfo = { nombre: tasa.afp_nombre, porcentaje: tasa.porcentaje_empleado, tope };
                const base = Math.min(baseCotizable, tope);
                descuentoAFP = Math.round(base * tasa.porcentaje_empleado / 100 * 100) / 100;
            }
        }

        // Renta: Base imponible = baseCotizable + excedenteAguinaldo - ISSS - AFP
        let descuentoRenta = 0;
        const ingresoGravado = Math.max(0, (baseCotizable + excedenteAguinaldo) - descuentoISSS - descuentoAFP);
        let rentaInfo = null;

        if (esJubilado) {
            descuentoRenta = Math.round(ingresoGravado * 0.10 * 100) / 100;
            rentaInfo = { tipo: 'jubilado', porcentaje: 10, ingreso_gravado: Math.round(ingresoGravado * 100) / 100 };
        } else {
            const [rentaConfigRows] = await pool.query(
                `SELECT id FROM rh_renta_config 
                 WHERE company_id = ? AND tipo = 'M' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [companyId, today, today]
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

        return {
            base_sueldo: empleado.sueldo_base,
            descuento_isss: Math.round(descuentoISSS * 100) / 100,
            descuento_afp: Math.round(descuentoAFP * 100) / 100,
            descuento_renta: Math.round(descuentoRenta * 100) / 100,
            isss_info: isssInfo,
            afp_info: afpInfo,
            renta_info: rentaInfo,
            es_jubilado: esJubilado,
            base_cotizable: baseCotizable,
            total_deducciones_auto: Math.round(totalDeducciones * 100) / 100
        };
}

module.exports = { calculateVacaciones, calculateLiquidaciones };
