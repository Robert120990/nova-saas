/**
 * Utilidades para clasificación y cálculo automático de tamaño/calibre de huevo
 * según gramaje unitario (g/huevo) y peso por caja (360 huevos / 30 docenas).
 * 
 * Tabla Técnica Oficial:
 * - Jumbo:         70.74g - 63.83g+  | 56.04 lb/caja
 * - Extra Grande:  63.84g - 56.74g   | 50.40 lb/caja
 * - Grande:        56.75g - 49.64g   | 45.00 lb/caja
 * - Mediano:       49.65g - 42.55g   | 39.30 lb/caja
 * - Pequeño:       42.56g - 35.45g   | 33.60 lb/caja
 * - Peewee:        < 35.46g          | 27.90 lb/caja
 */

export const EGG_SIZE_CATEGORIES = [
    {
        id: 'Jumbo',
        code: 'Jumbo',
        name: 'Jumbo',
        label: 'Jumbo (63.83g - 70.74g+ | 56.04 lb/caja)',
        shortLabel: 'Jumbo',
        minG: 63.83,
        nominalG: 70.74,
        boxWeightLbs: 56.04
    },
    {
        id: 'XL',
        code: 'XL',
        name: 'Extra Grande',
        label: 'Extra Grande - XL (56.74g - 63.84g | 50.4 lb/caja)',
        shortLabel: 'Extra Grande (XL)',
        minG: 56.74,
        maxG: 63.84,
        nominalG: 63.84,
        boxWeightLbs: 50.4
    },
    {
        id: 'L',
        code: 'L',
        name: 'Grande',
        label: 'Grande - L (49.64g - 56.75g | 45.0 lb/caja)',
        shortLabel: 'Grande (L)',
        minG: 49.64,
        maxG: 56.75,
        nominalG: 56.75,
        boxWeightLbs: 45.0
    },
    {
        id: 'M',
        code: 'M',
        name: 'Mediano',
        label: 'Mediano - M (42.55g - 49.65g | 39.3 lb/caja)',
        shortLabel: 'Mediano (M)',
        minG: 42.55,
        maxG: 49.65,
        nominalG: 49.65,
        boxWeightLbs: 39.3
    },
    {
        id: 'S',
        code: 'S',
        name: 'Pequeño',
        label: 'Pequeño - S (35.45g - 42.56g | 33.6 lb/caja)',
        shortLabel: 'Pequeño (S)',
        minG: 35.45,
        maxG: 42.56,
        nominalG: 42.56,
        boxWeightLbs: 33.6
    },
    {
        id: 'Peewee',
        code: 'Peewee',
        name: 'Peewee',
        label: 'Peewee (< 35.46g | 27.9 lb/caja)',
        shortLabel: 'Peewee',
        minG: 0,
        maxG: 35.45,
        nominalG: 35.46,
        boxWeightLbs: 27.9
    }
];

/**
 * Calcula automáticamente la categoría/talla de huevo según el peso unitario en gramos.
 * @param {number|string} grams Peso en gramos del huevo (muestreo)
 * @returns {string} Código oficial ('Jumbo', 'XL', 'L', 'M', 'S', 'Peewee') o '' si no es válido
 */
export function calculateEggSizeFromWeight(grams) {
    if (grams === null || grams === undefined || grams === '') return '';
    const g = parseFloat(grams);
    if (isNaN(g) || g <= 0) return '';

    // Evaluación según rangos de la tabla técnica oficial
    if (g >= 63.83) {
        return 'Jumbo';
    }
    if (g >= 56.74) {
        return 'XL';
    }
    if (g >= 49.64) {
        return 'L';
    }
    if (g >= 42.55) {
        return 'M';
    }
    if (g >= 35.45) {
        return 'S';
    }
    return 'Peewee';
}

/**
 * Obtiene la información técnica detallada de una categoría según su código.
 */
export function getEggSizeCategoryInfo(code) {
    if (!code) return null;
    const c = String(code).trim().toUpperCase();
    if (c === 'JUMBO') return EGG_SIZE_CATEGORIES[0];
    if (c === 'XL' || c.includes('EXTRA')) return EGG_SIZE_CATEGORIES[1];
    if (c === 'L' || c.includes('GRANDE')) return EGG_SIZE_CATEGORIES[2];
    if (c === 'M' || c.includes('MEDIAN')) return EGG_SIZE_CATEGORIES[3];
    if (c === 'S' || c.includes('PEQUE') || c.includes('CHIC')) return EGG_SIZE_CATEGORIES[4];
    if (c === 'PEEWEE' || c === 'PEWEE') return EGG_SIZE_CATEGORIES[5];
    return null;
}

/**
 * Normaliza el valor almacenado en BD o estado para que coincida con una de las opciones válidas.
 */
export function normalizeEggSize(val) {
    if (!val) return 'L';
    const s = String(val).trim().toUpperCase();
    if (s === 'JUMBO') return 'Jumbo';
    if (s === 'XL' || s.includes('EXTRA')) return 'XL';
    if (s === 'L' || s.includes('GRANDE')) return 'L';
    if (s === 'M' || s.includes('MEDIAN')) return 'M';
    if (s === 'S' || s.includes('PEQUE') || s.includes('CHIC')) return 'S';
    if (s === 'PEEWEE' || s === 'PEWEE') return 'Peewee';
    return val;
}

/**
 * Calcula el peso unitario en gramos a partir del peso neto en libras y total de cajas.
 * 1 caja = 360 huevos.
 * 1 libra = 453.59237 gramos.
 */
export function calculateUnitGramsFromBoxes(netLbs, totalBoxes) {
    const lbs = parseFloat(netLbs);
    const boxes = parseInt(totalBoxes, 10);
    if (!lbs || !boxes || lbs <= 0 || boxes <= 0) return null;
    const g = (lbs * 453.59237) / (boxes * 360);
    return Math.round(g * 100) / 100;
}
