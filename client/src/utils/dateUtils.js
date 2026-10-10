/**
 * Date utilities using LOCAL timezone.
 * Prevents the UTC offset bug where .toISOString().split('T')[0] jumps
 * to the next day after 6:00 PM in El Salvador (UTC-6).
 */

/**
 * Returns a date formatted as YYYY-MM-DD in LOCAL time.
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export const getTodayString = (d = new Date()) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Normaliza fechas de API para inputs date sin desplazar fechas civiles por UTC. */
export const toDateInput = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    return getTodayString(value);
};

export const getNowDateTimeLocal = (date = new Date()) => {
    const value = date instanceof Date ? date : new Date(date);
    if (isNaN(value.getTime())) return '';
    return `${getTodayString(value)}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
};

/**
 * Returns the first day of month formatted as YYYY-MM-01 in LOCAL time.
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} YYYY-MM-01
 */
export const getFirstDayOfMonth = (d = new Date()) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};

/**
 * Returns the last day of month formatted as YYYY-MM-DD in LOCAL time.
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export const getLastDayOfMonth = (d = new Date()) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return getTodayString(lastDate);
};

/**
 * Formats a date string or Date object to DD/MM/YYYY.
 * @param {Date|string} dateStr
 * @returns {string} DD/MM/YYYY
 */
export const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string') {
        const cleanStr = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
            const datePart = cleanStr.split('T')[0].split(' ')[0];
            const [year, month, day] = datePart.split('-');
            if (year && month && day) {
                return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
            }
        }
    }
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Formats a single date or date range string (e.g. "2026-09-08 al 2026-09-30" or "2026-09-08 a 2026-09-30")
 * @param {Date|string} dateStr
 * @param {string} [fallback='---']
 * @returns {string}
 */
export const formatDateRange = (dateStr, fallback = '---') => {
    if (!dateStr) return fallback;
    const str = String(dateStr).trim();
    if (str.includes(' al ')) {
        const [start, end] = str.split(' al ');
        return `${formatDateDMY(start)} al ${formatDateDMY(end)}`;
    }
    if (str.includes(' a ')) {
        const [start, end] = str.split(' a ');
        return `${formatDateDMY(start)} al ${formatDateDMY(end)}`;
    }
    if (str.includes(' - ')) {
        const [start, end] = str.split(' - ');
        return `${formatDateDMY(start)} al ${formatDateDMY(end)}`;
    }
    return formatDateDMY(str) || fallback;
};

/**
 * Standard date formatter for UI tables and modals.
 * Supports single dates and ranges ("YYYY-MM-DD a YYYY-MM-DD").
 * @param {Date|string} dateStr
 * @param {string} [fallback='---']
 * @returns {string}
 */
export const formatDate = (dateStr, fallback = '---') => {
    if (!dateStr) return fallback;
    if (typeof dateStr === 'string' && (dateStr.includes(' a ') || dateStr.includes(' al ') || dateStr.includes(' - '))) {
        return formatDateRange(dateStr, fallback);
    }
    const formatted = formatDateDMY(dateStr);
    return formatted || fallback;
};

/**
 * Formats a date and time to DD/MM/YYYY HH:mm:ss.
 * @param {Date|string} dateStr
 * @param {string} [fallback='---']
 * @returns {string}
 */
export const formatDateTime = (dateStr, fallback = '---') => {
    if (!dateStr) return fallback;
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    const dateFormatted = formatDateDMY(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${dateFormatted} ${hours}:${minutes}:${seconds}`;
};

/**
 * Formats time only to HH:mm:ss.
 * @param {Date|string} dateStr
 * @param {string} [fallback='']
 * @returns {string}
 */
export const formatTime = (dateStr, fallback = '') => {
    if (!dateStr) return fallback;
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

/**
 * Convierte horas decimales (ej. 2.80) a formato legible en horas y minutos (ej. "2h 48 min" o "2h 48m").
 * @param {number|string} decimalHours
 * @param {Object} [options]
 * @param {boolean} [options.short=false]
 * @param {string} [options.fallback]
 * @returns {string}
 */
export const formatDecimalHours = (decimalHours, options = {}) => {
    const val = parseFloat(decimalHours);
    const fallback = options.fallback || (options.short ? '0m' : '0 min');
    if (!val || isNaN(val) || val <= 0) return fallback;
    const totalMinutes = Math.round(val * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const minSuffix = options.short ? 'm' : ' min';
    if (h > 0 && m > 0) return `${h}h ${m}${minSuffix}`;
    if (h > 0) return options.short ? `${h}h` : `${h}h 00 min`;
    return `${m}${minSuffix}`;
};

/**
 * Genera el Lote Juliano Oficial de Recepción de Materia Prima (MP-DDD-YY)
 * @param {Date|string} [dateInput=new Date()]
 * @returns {string} Lote MP
 */
export const computeMpJulianLot = (dateInput) => {
    let d = dateInput;
    if (!d) {
        d = new Date();
    } else if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(dateInput);
        }
    } else {
        d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) d = new Date();
    const yearFull = d.getFullYear();
    const year2Digit = String(yearFull).slice(-2);
    const startOfYear = new Date(yearFull, 0, 1);
    const diffMs = d.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const dayOfYearStr = String(dayOfYear).padStart(3, '0');
    return `MP-${dayOfYearStr}-${year2Digit}`;
};

export default {
    getTodayString,
    getFirstDayOfMonth,
    getLastDayOfMonth,
    formatDateDMY,
    formatDate,
    formatDateTime,
    formatTime,
    formatDecimalHours,
    computeMpJulianLot
};

