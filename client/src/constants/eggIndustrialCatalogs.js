/**
 * Catálogos canónicos del módulo de Huevo Industrial.
 *
 * Los valores se persisten en minúsculas/sin tildes cuando es posible para
 * conservar compatibilidad con los lotes, empaques y mapeos ya existentes.
 * Las etiquetas sí se muestran con la redacción comercial correcta.
 */

export const POUNDS_PER_KILOGRAM = 2.2046226218;

export const INDUSTRIAL_PRODUCT_CATEGORIES = Object.freeze([
    { value: 'huevo entero', label: 'Huevo entero' },
    { value: 'huevo rapido', label: 'Huevo rápido' },
    { value: 'clara', label: 'Clara' },
    { value: 'clara ppg', label: 'Clara PPG' },
    { value: 'yema salada', label: 'Yema salada' },
    { value: 'yema azucarada', label: 'Yema azucarada' },
    // Se conservan las categorías ya usadas por lotes y mapeos anteriores.
    { value: 'yema', label: 'Yema líquida' },
    { value: 'fórmula especial', label: 'Fórmula especial' },
    { value: 'materia prima', label: 'Materia prima en cáscara' },
    { value: 'otro', label: 'Otro' }
]);

export const INDUSTRIAL_PRESENTATIONS = Object.freeze([
    { value: 'cubeta 32LB', label: 'Cubeta (32 lb)', weightLbs: 32 },
    { value: 'cubeta 30LB', label: 'Cubeta (30 lb)', weightLbs: 30 },
    { value: 'galon 8LB', label: 'Galón (8 lb)', weightLbs: 8 },
    { value: 'medio galon 4LB', label: 'Medio galón (4 lb)', weightLbs: 4 },
    { value: 'litro 2LB', label: 'Litro (2 lb)', weightLbs: 2 },
    // Se mantienen para que los registros existentes no pierdan su presentación.
    { value: 'bolsa 5LB', label: 'Bolsa (5 lb)', weightLbs: 5 },
    { value: 'tanque 2000LB', label: 'Tanque / tote (2,000 lb)', weightLbs: 2000 },
    { value: 'otra', label: 'Otra presentación', weightLbs: 0 }
]);

export const INDUSTRIAL_MEASUREMENT_UNITS = Object.freeze([
    { value: 'lb', label: 'Libra (lb)' },
    { value: 'kg', label: 'Kilogramo (kg)' }
]);

export const DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY = INDUSTRIAL_PRODUCT_CATEGORIES[0].value;
export const DEFAULT_INDUSTRIAL_PRESENTATION = INDUSTRIAL_PRESENTATIONS[0].value;
export const DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT = INDUSTRIAL_MEASUREMENT_UNITS[0].value;

const presentationAliases = new Map([
    ['cubeta', 'cubeta 32LB'],
    ['cubeta 32lb', 'cubeta 32LB'],
    ['cubeta 30lb', 'cubeta 30LB'],
    ['galon', 'galon 8LB'],
    ['galon 8lb', 'galon 8LB'],
    ['galón', 'galon 8LB'],
    ['galón 8lb', 'galon 8LB'],
    ['medio galon', 'medio galon 4LB'],
    ['medio galon 4lb', 'medio galon 4LB'],
    ['medio galón', 'medio galon 4LB'],
    ['medio galón 4lb', 'medio galon 4LB'],
    ['litro', 'litro 2LB'],
    ['litro 2lb', 'litro 2LB']
]);

export const normalizeIndustrialPresentation = (presentation) => {
    const rawValue = String(presentation || '').trim();
    if (!rawValue) return DEFAULT_INDUSTRIAL_PRESENTATION;

    const matched = INDUSTRIAL_PRESENTATIONS.find(item => item.value.toLowerCase() === rawValue.toLowerCase());
    if (matched) return matched.value;

    return presentationAliases.get(rawValue.toLowerCase()) || rawValue;
};

export const getIndustrialPresentation = (presentation) => {
    const normalized = normalizeIndustrialPresentation(presentation);
    return INDUSTRIAL_PRESENTATIONS.find(item => item.value === normalized) || null;
};

export const getIndustrialPresentationWeightLbs = (presentation, fallback = 0) => {
    return getIndustrialPresentation(presentation)?.weightLbs ?? fallback;
};

export const poundsToKilograms = (pounds) => {
    const numericPounds = Number(pounds);
    return Number.isFinite(numericPounds) ? numericPounds / POUNDS_PER_KILOGRAM : 0;
};

export const kilogramsToPounds = (kilograms) => {
    const numericKilograms = Number(kilograms);
    return Number.isFinite(numericKilograms) ? numericKilograms * POUNDS_PER_KILOGRAM : 0;
};
