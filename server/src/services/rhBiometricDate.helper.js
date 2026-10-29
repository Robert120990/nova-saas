/**
 * Utilidades centralizadas de fechas, rangos y tiempos para Marcador Digital Biométrico.
 * Garantiza inmunidad de zona horaria (America/El_Salvador), prevención de rangos invertidos,
 * uso óptimo de índices SQL y descarte de fechas corruptas de batería CMOS en relojes ZKTeco.
 */

const MIN_VALID_BIOMETRIC_YEAR = 2018;

function getTodayDateOnly() {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}

function formatToSqlDateTime(val) {
    if (!val) return null;
    if (typeof val === 'string') {
        const s = val.trim();
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (match && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
            const hh = match[4] === '24' ? '00' : match[4];
            return `${match[1]}-${match[2]}-${match[3]} ${hh}:${match[5]}:${match[6]}`;
        }
        const d = new Date(s);
        if (isNaN(d.getTime())) return null;
        const svParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(d);
        const getP = (type) => svParts.find(p => p.type === type)?.value;
        const hh = getP('hour') === '24' ? '00' : getP('hour');
        return `${getP('year')}-${getP('month')}-${getP('day')} ${hh}:${getP('minute')}:${getP('second')}`;
    }
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
    }
    return null;
}

function parseWallClockUtcMs(sqlDtStr) {
    if (!sqlDtStr || typeof sqlDtStr !== 'string') return NaN;
    const m = sqlDtStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

function isValidBiometricDateTime(sqlDtStr) {
    if (!sqlDtStr || typeof sqlDtStr !== 'string') return false;
    const m = sqlDtStr.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return false;
    const year = Number(m[1]);
    if (year < MIN_VALID_BIOMETRIC_YEAR) return false;

    const punchWallMs = parseWallClockUtcMs(sqlDtStr);
    const nowSvStr = formatToSqlDateTime(new Date().toISOString());
    const nowWallMs = parseWallClockUtcMs(nowSvStr);
    if (isNaN(punchWallMs) || isNaN(nowWallMs)) return false;

    // Permitir margen máximo de +24 horas por leves desajustes de hora de verano/reloj, rechazando años futuros (ej. 2027-2118)
    return punchWallMs <= (nowWallMs + 24 * 60 * 60 * 1000);
}

function extractDateOnly(dt) {
    if (!dt) return '';
    if (typeof dt === 'string') {
        const m = dt.trim().match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
    }
    try {
        const d = dt instanceof Date ? dt : new Date(dt);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
        return '';
    }
}

function extractTime(dt, fallback = '---') {
    if (!dt) return fallback;
    if (typeof dt === 'string') {
        const s = dt.trim();
        const m = s.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}:\d{2})/);
        if (m && !s.endsWith('Z')) return m[1];
        const tOnly = s.match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
        if (tOnly) return `${tOnly[1]}:${tOnly[2] || '00'}`;
    }
    try {
        const d = dt instanceof Date ? dt : new Date(dt);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleTimeString('es-SV', {
            timeZone: 'America/El_Salvador',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch {
        return fallback;
    }
}

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function diffMinutesLocal(startDt, endDt) {
    if (!startDt || !endDt) return 0;
    const ms1 = typeof startDt === 'string' && !startDt.endsWith('Z')
        ? parseWallClockUtcMs(startDt)
        : new Date(startDt).getTime();
    const ms2 = typeof endDt === 'string' && !endDt.endsWith('Z')
        ? parseWallClockUtcMs(endDt)
        : new Date(endDt).getTime();
    if (isNaN(ms1) || isNaN(ms2)) return 0;
    return Math.max(0, Math.floor((ms2 - ms1) / 60000));
}

function addDays(dateStr, days) {
    const clean = extractDateOnly(dateStr);
    if (!clean) return '';
    const d = new Date(`${clean}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function normalizeDateRange(rawStart, rawEnd) {
    let startDate = extractDateOnly(rawStart);
    let endDate = extractDateOnly(rawEnd);
    if (startDate && endDate && startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
    }
    return { startDate, endDate };
}

function appendPunchTimeBounds(conditions, params, alias, rawStart, rawEnd) {
    const { startDate, endDate } = normalizeDateRange(rawStart, rawEnd);
    const col = alias ? `${alias}.punch_time` : 'punch_time';

    if (startDate) {
        conditions.push(`${col} >= ?`);
        params.push(`${startDate} 00:00:00`);
    } else {
        conditions.push(`${col} >= '2018-01-01 00:00:00'`);
    }

    if (endDate) {
        conditions.push(`${col} <= ?`);
        params.push(`${endDate} 23:59:59`);
    } else {
        conditions.push(`${col} <= DATE_ADD(NOW(), INTERVAL 1 DAY)`);
    }

    return { startDate, endDate };
}

module.exports = {
    MIN_VALID_BIOMETRIC_YEAR,
    getTodayDateOnly,
    formatToSqlDateTime,
    parseWallClockUtcMs,
    isValidBiometricDateTime,
    extractDateOnly,
    extractTime,
    timeStringToMinutes,
    diffMinutesLocal,
    addDays,
    normalizeDateRange,
    appendPunchTimeBounds
};
