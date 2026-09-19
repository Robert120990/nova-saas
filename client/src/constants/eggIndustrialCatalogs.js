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
    { value: 'huevo en cascara', label: 'Huevo en cáscara / cascarón' },
    { value: 'materia prima', label: 'Materia prima en cáscara' },
    { value: 'otro', label: 'Otro' }
]);

export const RECIPE_FORMULA_NAMES = Object.freeze({
    'huevo entero': 'Huevo Entero Pasteurizado',
    'huevo rapido': 'Huevo Entero Rápido',
    'clara': 'Clara Pasteurizada',
    'clara ppg': 'Clara PPG',
    'yema salada': 'Yema Líquida Salada',
    'yema azucarada': 'Yema Líquida Azucarada',
    'yema': 'Yema Líquida',
    'fórmula especial': 'Fórmula Especial / Mezcla Premium',
    'huevo en cascara': 'Huevo en Cáscara / Cascarón',
    'materia prima': 'Materia Prima en Cáscara'
});

export const RECIPES_CATALOG = Object.freeze([
    { type: 'huevo entero', label: 'Huevo Entero Pasteurizado', defaultWeight: '32.00', defaultYield: '85.00' },
    { type: 'huevo rapido', label: 'Huevo Entero Rápido', defaultWeight: '32.00', defaultYield: '85.00' },
    { type: 'clara', label: 'Clara Pasteurizada', defaultWeight: '8.00', defaultYield: '85.00' },
    { type: 'clara ppg', label: 'Clara PPG', defaultWeight: '8.00', defaultYield: '85.00' },
    { type: 'yema salada', label: 'Yema Líquida Salada', defaultWeight: '4.00', defaultYield: '85.00' },
    { type: 'yema azucarada', label: 'Yema Líquida Azucarada', defaultWeight: '4.00', defaultYield: '85.00' },
    { type: 'fórmula especial', label: 'Fórmula Especial / Mezcla Premium', defaultWeight: '32.00', defaultYield: '85.00' },
    { type: 'huevo en cascara', label: 'Huevo en Cáscara / Cascarón', defaultWeight: '55.00', defaultYield: '100.00' }
]);

export const getRecipeFormulaName = (productType) => {
    if (!productType) return '';
    const clean = String(productType).trim().toLowerCase();
    return RECIPE_FORMULA_NAMES[clean] || INDUSTRIAL_PRODUCT_CATEGORIES.find(c => c.value === clean)?.label || productType;
};

export const INDUSTRIAL_PRESENTATIONS = Object.freeze([
    { value: 'cubeta 32LB', label: 'Cubeta (32 lb)', weightLbs: 32 },
    { value: 'cubeta 30LB', label: 'Cubeta (30 lb)', weightLbs: 30 },
    { value: 'galon 8LB', label: 'Galón (8 lb)', weightLbs: 8 },
    { value: 'medio galon 4LB', label: 'Medio galón (4 lb)', weightLbs: 4 },
    { value: 'litro 2LB', label: 'Litro (2 lb)', weightLbs: 2 },
    { value: 'carton 55LB', label: 'Cartón comercial (55 lb)', weightLbs: 55 },
    { value: 'caja 32LB', label: 'Caja de huevo blanco (32 lb)', weightLbs: 32 },
    { value: 'carton 30U', label: 'Cartón (30 unidades - 4 lb)', weightLbs: 4 },
    { value: 'unidad 0.2LB', label: 'Unidad de huevo (0.20 lb)', weightLbs: 0.2 },
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
    ['litro 2lb', 'litro 2LB'],
    ['carton 55lb', 'carton 55LB'],
    ['carton', 'carton 55LB'],
    ['cartón', 'carton 55LB'],
    ['caja 32lb', 'caja 32LB'],
    ['caja', 'caja 32LB'],
    ['unidad', 'unidad 0.2LB'],
    ['huevo unidad', 'unidad 0.2LB']
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
