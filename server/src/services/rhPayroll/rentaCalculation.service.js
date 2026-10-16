const pool = require('../../config/db');

/**
 * Retrieves the Renta (ISR) calculation configuration and active brackets for a company.
 *
 * @param {number} companyId - Tenant company ID
 * @param {string} quincena - 'primera' | 'segunda'
 * @param {string} [today] - Date string YYYY-MM-DD
 * @returns {Promise<{ calculoRentaModo: string, rentaConfigId: number|null, tipo: string, brackets: Array }>}
 */
async function getRentaContext(companyId, quincena, today = new Date().toISOString().split('T')[0]) {
    const [cfgRows] = await pool.query(
        `SELECT calculo_renta_modo FROM rh_config WHERE company_id = ? LIMIT 1`,
        [companyId]
    );
    const calculoRentaModo = cfgRows[0]?.calculo_renta_modo === 'cada_quincena' ? 'cada_quincena' : 'segunda_quincena';

    const tipo = calculoRentaModo === 'cada_quincena' ? 'Q' : 'M';
    let rentaConfigId = null;
    let brackets = [];

    // Brackets are needed in:
    // - Mode 'cada_quincena': in both 'primera' and 'segunda'
    // - Mode 'segunda_quincena': only in 'segunda'
    if (calculoRentaModo === 'cada_quincena' || quincena === 'segunda') {
        const [rentaConfigRows] = await pool.query(
            `SELECT id, tipo FROM rh_renta_config 
             WHERE company_id = ? AND tipo = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) 
             ORDER BY fecha_desde DESC LIMIT 1`,
            [companyId, tipo, today, today]
        );
        if (rentaConfigRows.length > 0) {
            rentaConfigId = rentaConfigRows[0].id;
            const [detailRows] = await pool.query(
                `SELECT sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso 
                 FROM rh_renta_config_detalle 
                 WHERE renta_config_id = ? 
                 ORDER BY sueldo_inicial ASC`,
                [rentaConfigId]
            );
            brackets = detailRows;
        }
    }

    return {
        calculoRentaModo,
        rentaConfigId,
        tipo,
        brackets
    };
}

/**
 * Pure calculation function for employee Renta (ISR).
 *
 * @param {Object} params
 * @param {string} params.modo - 'segunda_quincena' | 'cada_quincena'
 * @param {Array} params.brackets - Bracket details from rh_renta_config_detalle
 * @param {number} params.ingresoGravado - Taxable earnings for current quincena (percepciones - isss - afp)
 * @param {boolean} params.esJubilado - True if employee is retired (10% flat)
 * @param {boolean} params.aplicaRenta - True if employee has renta deduction enabled
 * @param {string} params.quincena - 'primera' | 'segunda'
 * @param {Object|null} [params.q1Data] - Q1 payroll summary for accumulation in 'segunda_quincena' mode
 * @returns {{ descuentoRenta: number, rentaInfo: Object|null }}
 */
function computeEmployeeRenta({ modo, brackets = [], ingresoGravado, esJubilado, aplicaRenta, quincena, q1Data = null }) {
    if (!aplicaRenta) {
        return { descuentoRenta: 0, rentaInfo: null };
    }

    const gravadoActual = Math.max(0, parseFloat(ingresoGravado || 0));

    // Jubilados (tanto normal como con AFP): retención fija del 10% plano sobre el ingreso gravado
    // Aplica en cada quincena directamente sobre el ingreso gravable (sin ISSS y descontando AFP si aplica)
    if (esJubilado) {
        const descuentoRenta = Math.round(gravadoActual * 0.10 * 100) / 100;
        return {
            descuentoRenta,
            rentaInfo: {
                tipo: 'jubilado',
                porcentaje: 10,
                ingreso_gravado: Math.round(gravadoActual * 100) / 100,
                modo: modo || 'cada_quincena'
            }
        };
    }

    // MODE: Cada quincena usando tabla quincenal ('Q')
    if (modo === 'cada_quincena') {

        if (brackets.length > 0 && gravadoActual > 0) {
            const br = brackets.find(b =>
                gravadoActual >= parseFloat(b.sueldo_inicial) &&
                (b.sueldo_final === null || b.sueldo_final === undefined || gravadoActual <= parseFloat(b.sueldo_final))
            );
            if (br) {
                const excedente = Math.max(0, gravadoActual - parseFloat(br.exceso || 0));
                const porcentaje = parseFloat(br.porcentaje || 0);
                const valorDescuento = parseFloat(br.valor_descuento || 0);
                const rentaBruta = (excedente * porcentaje / 100) + valorDescuento;
                const descuentoRenta = Math.round(Math.max(0, rentaBruta) * 100) / 100;

                return {
                    descuentoRenta,
                    rentaInfo: {
                        sueldo_inicial: br.sueldo_inicial,
                        sueldo_final: br.sueldo_final,
                        porcentaje: br.porcentaje,
                        valor_descuento: br.valor_descuento,
                        exceso: br.exceso,
                        excedente: Math.round(excedente * 100) / 100,
                        ingreso_gravado: Math.round(gravadoActual * 100) / 100,
                        modo: 'cada_quincena'
                    }
                };
            }
        }

        return { descuentoRenta: 0, rentaInfo: null };
    }

    // MODE: Segunda quincena acumulando tabla mensual ('M') - Default
    if (quincena !== 'segunda') {
        return { descuentoRenta: 0, rentaInfo: null };
    }

    const q1Gravado = q1Data
        ? Math.max(0, parseFloat(q1Data.total_percepciones || 0) - parseFloat(q1Data.descuento_isss || 0) - parseFloat(q1Data.descuento_afp || 0))
        : 0;
    const ingresoGravadoTotalMes = Math.max(0, gravadoActual + q1Gravado);
    const prevRentaQ1 = q1Data ? parseFloat(q1Data.descuento_renta || 0) : 0;

    if (brackets.length > 0 && ingresoGravadoTotalMes > 0) {
        const br = brackets.find(b =>
            ingresoGravadoTotalMes >= parseFloat(b.sueldo_inicial) &&
            (b.sueldo_final === null || b.sueldo_final === undefined || ingresoGravadoTotalMes <= parseFloat(b.sueldo_final))
        );
        if (br) {
            const excedente = Math.max(0, ingresoGravadoTotalMes - parseFloat(br.exceso || 0));
            const porcentaje = parseFloat(br.porcentaje || 0);
            const valorDescuento = parseFloat(br.valor_descuento || 0);
            const rentaTotal = (excedente * porcentaje / 100) + valorDescuento;
            const descuentoRenta = Math.round(Math.max(0, rentaTotal - prevRentaQ1) * 100) / 100;

            return {
                descuentoRenta,
                rentaInfo: {
                    sueldo_inicial: br.sueldo_inicial,
                    sueldo_final: br.sueldo_final,
                    porcentaje: br.porcentaje,
                    valor_descuento: br.valor_descuento,
                    exceso: br.exceso,
                    excedente: Math.round(excedente * 100) / 100,
                    ingreso_gravado: Math.round(ingresoGravadoTotalMes * 100) / 100,
                    ingreso_gravado_q2: Math.round(gravadoActual * 100) / 100,
                    ingreso_gravado_q1: Math.round(q1Gravado * 100) / 100,
                    renta_anterior: prevRentaQ1,
                    modo: 'segunda_quincena'
                }
            };
        }
    }

    return { descuentoRenta: 0, rentaInfo: null };
}

module.exports = {
    getRentaContext,
    computeEmployeeRenta
};
