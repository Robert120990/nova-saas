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

export default {
    getTodayString,
    getFirstDayOfMonth,
    getLastDayOfMonth,
    formatDateDMY
};
