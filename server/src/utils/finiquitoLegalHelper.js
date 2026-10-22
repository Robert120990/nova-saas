const { numeroALetras } = require('./numberToWords');

const DEPARTMENTS = {
    '01': 'AHUACHAPÁN',
    '02': 'SANTA ANA',
    '03': 'SONSONATE',
    '04': 'CHALATENANGO',
    '05': 'LA LIBERTAD',
    '06': 'SAN SALVADOR',
    '07': 'CUSCATLÁN',
    '08': 'LA PAZ',
    '09': 'CABAÑAS',
    '10': 'SAN VICENTE',
    '11': 'USULUTÁN',
    '12': 'SAN MIGUEL',
    '13': 'MORAZÁN',
    '14': 'LA UNIÓN'
};

const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DIGIT_WORDS = {
    '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
    '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve'
};

function formatDuiWords(dui) {
    if (!dui) return '';
    const clean = String(dui).trim().replace(/[^0-9-]/g, '');
    const parts = clean.split('-');
    const mainNumStr = parts[0] || '';
    const checkDigit = parts[1] || '';

    let leadingZeros = 0;
    while (leadingZeros < mainNumStr.length && mainNumStr[leadingZeros] === '0') {
        leadingZeros++;
    }

    const zerosPrefix = leadingZeros > 0
        ? Array(leadingZeros).fill('cero').join(' ') + ' '
        : '';

    const numVal = parseInt(mainNumStr, 10);
    const mainWords = isNaN(numVal) || numVal === 0
        ? (leadingZeros === 0 ? 'cero' : '')
        : numeroALetras(numVal).toLowerCase();

    const checkWord = DIGIT_WORDS[checkDigit] || (checkDigit ? numeroALetras(parseInt(checkDigit, 10)).toLowerCase() : '');

    return `${zerosPrefix}${mainWords} - ${checkWord}`.trim().replace(/\s+/g, ' ');
}

function formatDateWords(dateObj) {
    const d = dateObj ? new Date(dateObj) : new Date();
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();

    const dayWord = (day === 1 ? 'un' : numeroALetras(day).toLowerCase());
    const yearWord = numeroALetras(year).toLowerCase();

    return {
        day, month, year,
        dayWord, yearWord,
        fullClosing: `a los ${dayWord} días del mes de ${month} del año ${yearWord}`,
        fullNotary: `del día ${dayWord} de ${month} del año ${yearWord}`
    };
}

function formatTimeWords(dateObj) {
    const d = dateObj ? new Date(dateObj) : new Date();
    const hour = d.getHours();
    const minutes = d.getMinutes();

    let hourWord = '';
    if (hour === 1 || hour === 13) hourWord = 'a la una';
    else {
        const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        hourWord = `a las ${numeroALetras(h12).toLowerCase()}`;
    }

    if (minutes === 0) {
        return `${hourWord} horas`;
    } else {
        return `${hourWord} horas con ${numeroALetras(minutes).toLowerCase()} minutos`;
    }
}

function calculateAgeWords(birthDate) {
    if (!birthDate) return 'veinticinco';
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 'veinticinco';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    if (age <= 0 || age > 110) age = 25;
    return numeroALetras(age).toLowerCase();
}

function resolveDepartmentName(codeOrName) {
    if (!codeOrName) return 'San Salvador';
    const trimmed = String(codeOrName).trim();
    if (DEPARTMENTS[trimmed]) return DEPARTMENTS[trimmed];
    return trimmed;
}

function resolveDistrictOrCity(data = {}) {
    const candidates = [
        data.distrito_nombre,
        data.empleado_distrito,
        data.distrito,
        data.municipio_nombre,
        data.empleado_municipio,
        data.municipio,
        data.ciudad
    ];
    for (const val of candidates) {
        if (val && typeof val === 'string' && isNaN(val.trim())) {
            return val.trim();
        }
    }
    return 'San Salvador';
}

module.exports = {
    formatDuiWords,
    formatDateWords,
    formatTimeWords,
    calculateAgeWords,
    resolveDepartmentName,
    resolveDistrictOrCity,
    DEPARTMENTS,
    MONTH_NAMES
};
