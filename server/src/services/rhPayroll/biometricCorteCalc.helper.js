const LEGAL_FACTOR_DIURNA = 2.0;   // Código de Trabajo SV Art. 169: 100% recargo (200%)
const LEGAL_FACTOR_NOCTURNA = 2.5; // Código de Trabajo SV Arts. 168-169: 25% nocturnidad sobre extra (250%)
const LEGAL_DAYS_PER_MONTH = 30;
const LEGAL_HOURS_PER_DAY = 8;

const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;
const round4 = (val) => Math.round((Number(val) || 0) * 10000) / 10000;

/**
 * Calcula las tarifas legales de horas extra según Código de Trabajo de El Salvador:
 * Hora ordinaria = Sueldo mensual / 30 días / 8 horas (= Sueldo / 240).
 */
function computeLegalOvertimeRates(sueldoBase) {
    const sueldo = Number(sueldoBase) > 0 ? round2(sueldoBase) : 0;
    const valorHoraOrdinaria = sueldo > 0 ? (sueldo / LEGAL_DAYS_PER_MONTH) / LEGAL_HOURS_PER_DAY : 0;
    const tarifaDiurna = valorHoraOrdinaria * LEGAL_FACTOR_DIURNA;
    const tarifaNocturna = valorHoraOrdinaria * LEGAL_FACTOR_NOCTURNA;

    return {
        sueldo,
        valorHoraOrdinaria,
        tarifaDiurna,
        tarifaNocturna,
        factorDiurna: LEGAL_FACTOR_DIURNA,
        factorNocturna: LEGAL_FACTOR_NOCTURNA
    };
}

/**
 * Calcula montos positivos de horas extra diurnas (2.0x) y nocturnas (2.5x).
 * Nunca devuelve horas ni montos negativos.
 */
function computeLegalOvertimeAmounts(sueldoBase, horasDiurnas, horasNocturnas) {
    const rates = computeLegalOvertimeRates(sueldoBase);
    const hD = Math.max(0, round2(horasDiurnas));
    const hN = Math.max(0, round2(horasNocturnas));
    const montoDiurno = hD > 0 ? round2(hD * rates.tarifaDiurna) : 0;
    const montoNocturno = hN > 0 ? round2(hN * rates.tarifaNocturna) : 0;
    const montoTotal = round2(montoDiurno + montoNocturno);

    return {
        ...rates,
        horasDiurnas: hD,
        horasNocturnas: hN,
        montoDiurno,
        montoNocturno,
        montoTotal
    };
}

/**
 * Resuelve únicamente horas positivas pagables (> 0) de un saldo de corte,
 * excluyendo cualquier saldo neto negativo o cero (que queda en arrastre en Marcador Digital).
 */
function resolvePositivePayableSplit(saldo = {}, rawNightHours = 0, { separarNocturnas = true, incluirAvicola = true } = {}) {
    const saldoNeto = round2(saldo.saldo_neto);
    const avicolaPositiva = Math.max(0, round2(saldo.horas_extra_avicola));
    const pagablesRaw = saldo.horas_pagables !== undefined && saldo.horas_pagables !== null
        ? saldo.horas_pagables
        : saldoNeto;
    const pagablesBase = saldoNeto > 0 ? Math.max(0, round2(pagablesRaw)) : 0;
    const horasPagables = round2(pagablesBase + (incluirAvicola ? avicolaPositiva : 0));

    if (horasPagables <= 0) {
        return {
            saldoNeto,
            avicolaPositiva,
            pagablesBase,
            horasPagables: 0,
            horasDiurnas: 0,
            horasNocturnas: 0,
            esNegativo: saldoNeto < 0
        };
    }

    const horasNocturnas = separarNocturnas ? round2(Math.min(horasPagables, Math.max(0, round2(rawNightHours)))) : 0;
    const horasDiurnas = round2(Math.max(0, horasPagables - horasNocturnas));

    return {
        saldoNeto,
        avicolaPositiva,
        pagablesBase,
        horasPagables,
        horasDiurnas,
        horasNocturnas,
        esNegativo: false
    };
}

module.exports = {
    LEGAL_FACTOR_DIURNA,
    LEGAL_FACTOR_NOCTURNA,
    LEGAL_DAYS_PER_MONTH,
    LEGAL_HOURS_PER_DAY,
    round2,
    round4,
    computeLegalOvertimeRates,
    computeLegalOvertimeAmounts,
    resolvePositivePayableSplit
};
