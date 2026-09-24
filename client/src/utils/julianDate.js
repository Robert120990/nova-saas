/**
 * Utilidades para cálculo de Calendario Juliano en Planta Industrial ANDELSA
 * Formato oficial ANDELSA Planta: LOTE [Corrida 2 dígitos]-[Día Juliano 3 dígitos]-[Año 2 dígitos] (ej: LOTE 01-265-26)
 */

/**
 * Obtiene la información detallada del día juliano para una fecha determinada
 * @param {string|Date} dateInput - Fecha en formato 'YYYY-MM-DD' o instancia de Date
 * @returns {object} { dayOfYear, dayOfYearStr, year2Digit, yearFull, isLeapYear }
 */
export const getJulianDayInfo = (dateInput) => {
    let d;
    if (!dateInput) {
        d = new Date();
    } else if (typeof dateInput === 'string') {
        const parts = dateInput.split('T')[0].split('-');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(dateInput);
        }
    } else {
        d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) {
        d = new Date();
    }

    const yearFull = d.getFullYear();
    const year2Digit = String(yearFull).slice(-2);
    const isLeapYear = (yearFull % 4 === 0 && yearFull % 100 !== 0) || (yearFull % 400 === 0);

    // Calcular días acumulados desde el 1 de enero
    const startOfYear = new Date(yearFull, 0, 1);
    const diffMs = d.getTime() - startOfYear.getTime();
    const oneDayMs = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diffMs / oneDayMs) + 1;
    const dayOfYearStr = String(Math.min(isLeapYear ? 366 : 365, Math.max(1, dayOfYear))).padStart(3, '0');

    return {
        dateObj: d,
        dayOfYear,
        dayOfYearStr,
        year2Digit,
        yearFull,
        isLeapYear,
        totalDaysInYear: isLeapYear ? 366 : 365
    };
};

/**
 * Genera el código de lote en formato juliano oficial
 * @param {string|Date} dateInput - Fecha de producción
 * @param {number|string} runNumber - Número de corrida o batch en el día (ej: 1, 2)
 * @param {'standard'|'andelsa'|'raw'} format - 'standard' para LOTE XX-JJJ-YY o 'andelsa'/'raw' para XX-JJJ-YY
 * @returns {string} Código de lote formateado (ej. LOTE 01-265-26)
 */
export const generateJulianLotCode = (dateInput, runNumber = 1, format = 'standard') => {
    const info = getJulianDayInfo(dateInput);
    const runStr = String(runNumber || 1).padStart(2, '0');

    if (format === 'andelsa' || format === 'raw') {
        return `${runStr}-${info.dayOfYearStr}-${info.year2Digit}`;
    }

    // Formato oficial ANDELSA Planta: LOTE 01-265-26
    return `LOTE ${runStr}-${info.dayOfYearStr}-${info.year2Digit}`;
};

/**
 * Detecta si un código de lote usa formato gregoriano (ej. LOTE-20260909-01 o LOTE-260909-01)
 * o formatos previos y lo convierte a su equivalente en numeración juliana oficial (ej. LOTE 01-265-26)
 * @param {string} lotCode - Código de lote existente
 * @param {string|Date} fallbackDate - Fecha de producción asociada como respaldo
 * @returns {string} Código de lote convertido a juliano oficial
 */
export const convertGregorianLotToJulian = (lotCode, fallbackDate) => {
    if (!lotCode) return generateJulianLotCode(fallbackDate);

    const clean = lotCode.trim();

    // Caso 1: Ya es formato oficial LOTE XX-JJJ-YY (ej. LOTE 01-265-26)
    const officialMatch = clean.match(/^LOTE\s*(\d{2})\s*-\s*(\d{3})\s*-\s*(\d{2})$/i);
    if (officialMatch) {
        return `LOTE ${officialMatch[1]}-${officialMatch[2]}-${officialMatch[3]}`;
    }

    // Caso 2: Formato XX-JJJ-YY sin prefijo LOTE (ej. 01 - 252 - 26 o 01-265-26)
    const rawMatch = clean.match(/^(\d{2})\s*-\s*(\d{3})\s*-\s*(\d{2})$/);
    if (rawMatch) {
        return `LOTE ${rawMatch[1]}-${rawMatch[2]}-${rawMatch[3]}`;
    }

    // Caso 3: Formato heredado LOTE-YYJJJ-NN (ej. LOTE-26252-01 donde JJJ <= 366)
    const legacyJulianMatch = clean.match(/^LOTE-(\d{2})(\d{3})-(\w+)$/i);
    if (legacyJulianMatch) {
        const jYear = legacyJulianMatch[1];
        const jDay = parseInt(legacyJulianMatch[2], 10);
        const jRun = legacyJulianMatch[3];
        if (jDay >= 1 && jDay <= 366) {
            return `LOTE ${String(jRun).padStart(2, '0')}-${String(jDay).padStart(3, '0')}-${jYear}`;
        }
    }

    // Caso 4: Formato LOTE-YYYYMMDD-NN (ej. LOTE-20260909-01)
    const ymdMatch = clean.match(/^LOTE-(\d{4})(\d{2})(\d{2})-(\w+)$/i);
    if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        const run = ymdMatch[4];
        const date = new Date(year, month, day);
        const info = getJulianDayInfo(date);
        return `LOTE ${String(run).padStart(2, '0')}-${info.dayOfYearStr}-${info.year2Digit}`;
    }

    // Caso 5: Usar fallbackDate
    if (fallbackDate) {
        return generateJulianLotCode(fallbackDate);
    }

    return clean;
};

/**
 * Comprueba si un lote tiene formato juliano válido
 * @param {string} lotCode 
 * @returns {boolean}
 */
export const isJulianLotCode = (lotCode) => {
    if (!lotCode) return false;
    const clean = lotCode.trim();
    if (/^LOTE\s*\d{2}\s*-\s*\d{3}\s*-\s*\d{2}$/i.test(clean)) return true;
    if (/^\d{2}\s*-\s*\d{3}\s*-\s*\d{2}$/.test(clean)) return true;
    const match = clean.match(/^LOTE-(\d{2})(\d{3})-(\w+)$/i);
    if (match) {
        const jDay = parseInt(match[2], 10);
        return jDay >= 1 && jDay <= 366;
    }
    return false;
};
