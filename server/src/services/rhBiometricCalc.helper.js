/**
 * Motor compartido de cálculo biométrico (anti-rebote, detección de marcas incompletas,
 * redondeo configurable por bloques, compensación semanal 44h / sábados,
 * desglose legal de horas extra diurnas/nocturnas/domingo/festivo y formato legible).
 */
const {
    extractTime,
    timeStringToMinutes,
    diffMinutesLocal
} = require('./rhBiometricDate.helper');

const DEFAULT_DEBOUNCE_MINUTES = 3;
const NIGHT_START_MIN = 19 * 60; // 19:00 (Código de Trabajo SV: jornada nocturna 19:00 - 06:00)
const NIGHT_END_MIN = 6 * 60;    // 06:00

/**
 * Formatea horas decimales (ej. 2.80 o -4.00) a texto legible ("2h 48 min", "-4h").
 */
function formatDecimalHoursText(decimalHours, short = false) {
    const val = parseFloat(decimalHours);
    if (!val || isNaN(val)) return short ? '0m' : '0 min';
    const sign = val < 0 ? '-' : '';
    const totalMinutes = Math.round(Math.abs(val) * 60);
    if (totalMinutes === 0) return short ? '0m' : '0 min';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const suffix = short ? 'm' : ' min';
    if (h > 0 && m > 0) return `${sign}${h}h ${m}${suffix}`;
    if (h > 0) return short ? `${sign}${h}h` : `${sign}${h}h 00 min`;
    return `${sign}${m}${suffix}`;
}

/**
 * Redondea minutos extra (positivos o negativos) según bloques configurables.
 * Ej. stepMinutes = 30, thresholdMinutes = 15 (estándar planta 0.5h):
 *   0..14 min -> 0h | 15..44 min -> 0.5h | 45..74 min -> 1.0h (simétrico para negativos).
 * Si stepMinutes <= 0 devuelve decimal exacto con 2 decimales.
 */
function roundOvertimeMinutesToHours(deltaMinutes, stepMinutes = 0, thresholdMinutes = 15) {
    if (!deltaMinutes || isNaN(deltaMinutes)) return 0;
    const step = parseInt(stepMinutes, 10) || 0;
    if (step <= 0) {
        return parseFloat((deltaMinutes / 60).toFixed(2)) || 0;
    }
    const threshold = Math.max(1, Math.min(step, parseInt(thresholdMinutes, 10) || Math.ceil(step / 2)));
    const sign = deltaMinutes < 0 ? -1 : 1;
    const absMin = Math.abs(deltaMinutes);
    const blocks = Math.floor(absMin / step);
    const rem = absMin % step;
    const roundedBlocks = blocks + (rem >= threshold ? 1 : 0);
    const hours = parseFloat(((roundedBlocks * step) / 60).toFixed(2));
    return hours === 0 ? 0 : sign * hours;
}

/**
 * Elimina rebotes / dobles toques consecutivos del lector biométrico (ej. < 3 minutos).
 */
function debouncePunches(rawPunches = [], minGapMinutes = DEFAULT_DEBOUNCE_MINUTES) {
    const sorted = [...rawPunches].filter(Boolean).sort();
    if (sorted.length <= 1) {
        return { punches: sorted, removedDuplicates: 0 };
    }

    const filtered = [sorted[0]];
    let removedDuplicates = 0;

    for (let i = 1; i < sorted.length; i++) {
        const prev = filtered[filtered.length - 1];
        const curr = sorted[i];
        const gapMins = diffMinutesLocal(prev, curr);
        if (gapMins < minGapMinutes) {
            removedDuplicates++;
            continue;
        }
        filtered.push(curr);
    }

    return { punches: filtered, removedDuplicates };
}

/**
 * Clasifica las marcaciones de un día y calcula horas trabajadas, tardanza,
 * alertas de marcación incompleta y horas extra según política de la empresa.
 */
function evaluateDayAttendance(rawPunches, options = {}) {
    const {
        fecha = '',
        horaEntradaEsperada = '08:00:00',
        toleranciaMinutos = 15,
        jornadaHoras = 8.0,
        exentoHorasExtras = false,
        esFestivo = false,
        esAusenciaJustificada = false,
        debounceMinutes = DEFAULT_DEBOUNCE_MINUTES,
        modoCalculoJornada = 'neto_sin_almuerzo',
        redondeoMinutos = 0,
        umbralRedondeoMinutos = 15,
        compensarSabado = false,
        horasJornadaSabado = 4.0,
        permitirSaldoNegativo = false,
        incluirDeficitDiario = false
    } = options;

    const { punches: sorted, removedDuplicates } = debouncePunches(rawPunches, debounceMinutes);
    const marcasCount = sorted.length;

    const horaEntrada = sorted[0] || null;
    let horaSalidaAlmuerzo = null;
    let horaEntradaAlmuerzo = null;
    let horaSalida = null;
    let esMarcacionIncompleta = false;
    const alertas = [];

    if (marcasCount === 1) {
        esMarcacionIncompleta = true;
        alertas.push('Solo 1 marca (falta salida)');
    } else if (marcasCount === 2) {
        horaSalida = sorted[1];
    } else if (marcasCount === 3) {
        esMarcacionIncompleta = true;
        const midTime = extractTime(sorted[1], '');
        if (midTime && midTime < '12:45:00') {
            horaSalidaAlmuerzo = sorted[1];
            alertas.push('3 marcas (falta regreso almuerzo)');
        } else {
            horaEntradaAlmuerzo = sorted[1];
            alertas.push('3 marcas (falta salida almuerzo)');
        }
        horaSalida = sorted[2];
    } else if (marcasCount >= 4) {
        horaSalidaAlmuerzo = sorted[1];
        horaEntradaAlmuerzo = sorted[2];
        horaSalida = sorted[marcasCount - 1];
        if (marcasCount > 4) {
            alertas.push(`${marcasCount} marcas en el día`);
        }
    }

    if (removedDuplicates > 0) {
        alertas.push(`${removedDuplicates} doble(s) toque filtrado(s)`);
    }

    const dayOfWeek = fecha ? new Date(`${fecha}T12:00:00Z`).getUTCDay() : -1;
    const esDomingo = dayOfWeek === 0;
    const esSabado = dayOfWeek === 6;

    const entradaEsperadaMins = timeStringToMinutes(horaEntradaEsperada);
    const limiteEntrada = entradaEsperadaMins + toleranciaMinutos;

    let minutosTardanza = 0;
    let esLlegadaTarde = false;
    if (horaEntrada && !esSabado && !esDomingo) {
        const entradaRealMins = timeStringToMinutes(extractTime(horaEntrada));
        if (entradaRealMins > limiteEntrada) {
            minutosTardanza = entradaRealMins - entradaEsperadaMins;
            esLlegadaTarde = true;
        }
    }

    let minutosTrabajados = 0;
    let minutosAlmuerzo = 0;
    if (horaEntrada && horaSalida) {
        let diffMins = diffMinutesLocal(horaEntrada, horaSalida);
        if (horaSalidaAlmuerzo && horaEntradaAlmuerzo) {
            const lunchMins = diffMinutesLocal(horaSalidaAlmuerzo, horaEntradaAlmuerzo);
            if (lunchMins >= 5 && lunchMins <= 180) {
                minutosAlmuerzo = lunchMins;
                if (modoCalculoJornada !== 'bruto_con_almuerzo') {
                    diffMins = Math.max(0, diffMins - lunchMins);
                }
            }
        }
        minutosTrabajados = diffMins;
    }

    const horasTrabajadas = parseFloat((minutosTrabajados / 60).toFixed(2));
    const jornadaMins = Math.round(jornadaHoras * 60);
    const sabadoMins = Math.round((parseFloat(horasJornadaSabado) || 4.0) * 60);

    let minutosExtra = 0;
    let horasExtraCalculadas = 0;

    if (!exentoHorasExtras) {
        if (esDomingo && compensarSabado && minutosTrabajados > 0) {
            minutosExtra = minutosTrabajados;
            horasExtraCalculadas = roundOvertimeMinutesToHours(minutosExtra, redondeoMinutos, umbralRedondeoMinutos);
        } else if (esSabado && compensarSabado) {
            if (minutosTrabajados > 0) {
                const deltaSab = minutosTrabajados - sabadoMins;
                if (deltaSab >= 0 || permitirSaldoNegativo) {
                    minutosExtra = deltaSab;
                    horasExtraCalculadas = roundOvertimeMinutesToHours(deltaSab, redondeoMinutos, umbralRedondeoMinutos);
                }
            } else if (!esFestivo && !esAusenciaJustificada && permitirSaldoNegativo) {
                minutosExtra = -sabadoMins;
                horasExtraCalculadas = roundOvertimeMinutesToHours(-sabadoMins, redondeoMinutos, umbralRedondeoMinutos);
            }
        } else if (minutosTrabajados > jornadaMins) {
            minutosExtra = minutosTrabajados - jornadaMins;
            horasExtraCalculadas = roundOvertimeMinutesToHours(minutosExtra, redondeoMinutos, umbralRedondeoMinutos);
        } else if (incluirDeficitDiario && !esFestivo && !esAusenciaJustificada && minutosTrabajados > 0 && minutosTrabajados < jornadaMins) {
            minutosExtra = minutosTrabajados - jornadaMins;
            horasExtraCalculadas = roundOvertimeMinutesToHours(minutosExtra, redondeoMinutos, umbralRedondeoMinutos);
        }
    }

    const { horasExtraDiurnas, horasExtraNocturnas } = splitOvertimeDayNight(
        horaSalida,
        Math.max(0, Math.round(Math.max(0, horasExtraCalculadas) * 60))
    );

    return {
        horaEntrada,
        horaSalidaAlmuerzo,
        horaEntradaAlmuerzo,
        horaSalida,
        marcasCount,
        removedDuplicates,
        esMarcacionIncompleta,
        alertaMarcacion: alertas.join(' · '),
        minutosTardanza,
        esLlegadaTarde,
        minutosAlmuerzo,
        minutosTrabajados,
        horasTrabajadas,
        horasExtraCalculadas,
        horasExtraDiurnas,
        horasExtraNocturnas,
        esSabado,
        esDomingo,
        esFestivo: !!esFestivo
    };
}

/**
 * Clasifica los minutos extra al final de la jornada en diurnos (06:00-19:00)
 * y nocturnos (19:00-06:00) según Código de Trabajo de El Salvador.
 */
function splitOvertimeDayNight(horaSalida, overtimeMinutes) {
    if (!overtimeMinutes || overtimeMinutes <= 0) {
        return { horasExtraDiurnas: 0, horasExtraNocturnas: 0 };
    }
    if (!horaSalida) {
        return {
            horasExtraDiurnas: parseFloat((overtimeMinutes / 60).toFixed(2)),
            horasExtraNocturnas: 0
        };
    }

    const endMin = timeStringToMinutes(extractTime(horaSalida));
    const startMin = endMin - overtimeMinutes;
    let nightMins = 0;

    for (let m = startMin; m < endMin; m++) {
        const mod = ((m % 1440) + 1440) % 1440;
        if (mod >= NIGHT_START_MIN || mod < NIGHT_END_MIN) {
            nightMins++;
        }
    }

    const dayMins = Math.max(0, overtimeMinutes - nightMins);
    return {
        horasExtraDiurnas: parseFloat((dayMins / 60).toFixed(2)),
        horasExtraNocturnas: parseFloat((nightMins / 60).toFixed(2))
    };
}

module.exports = {
    DEFAULT_DEBOUNCE_MINUTES,
    formatDecimalHoursText,
    roundOvertimeMinutesToHours,
    debouncePunches,
    evaluateDayAttendance,
    splitOvertimeDayNight
};
