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
    ['cubeta 32 lb', 'cubeta 32LB'],
    ['cubeta 30lb', 'cubeta 30LB'],
    ['cubeta 30 lb', 'cubeta 30LB'],
    ['galon', 'galon 8LB'],
    ['galon 8lb', 'galon 8LB'],
    ['galon 8 lb', 'galon 8LB'],
    ['galón', 'galon 8LB'],
    ['galón 8lb', 'galon 8LB'],
    ['galón 8 lb', 'galon 8LB'],
    ['medio galon', 'medio galon 4LB'],
    ['medio galon 4lb', 'medio galon 4LB'],
    ['medio galon 4 lb', 'medio galon 4LB'],
    ['medio galón', 'medio galon 4LB'],
    ['medio galón 4lb', 'medio galon 4LB'],
    ['medio galón 4 lb', 'medio galon 4LB'],
    ['litro', 'litro 2LB'],
    ['litro 2lb', 'litro 2LB'],
    ['litro 2 lb', 'litro 2LB'],
    ['carton 55lb', 'carton 55LB'],
    ['carton 55 lb', 'carton 55LB'],
    ['carton', 'carton 55LB'],
    ['cartón', 'carton 55LB'],
    ['cartón 55lb', 'carton 55LB'],
    ['cartón 55 lb', 'carton 55LB'],
    ['caja 32lb', 'caja 32LB'],
    ['caja 32 lb', 'caja 32LB'],
    ['caja', 'caja 32LB'],
    ['carton 4 lb', 'carton 30U'],
    ['carton 4lb', 'carton 30U'],
    ['cartón 4 lb', 'carton 30U'],
    ['cartón 4lb', 'carton 30U'],
    ['unidad', 'unidad 0.2LB'],
    ['unidad 0.2lb', 'unidad 0.2LB'],
    ['unidad 0.2 lb', 'unidad 0.2LB'],
    ['unidad 0.20 lb', 'unidad 0.2LB'],
    ['huevo unidad', 'unidad 0.2LB']
]);

export const normalizeIndustrialPresentation = (presentation) => {
    const rawValue = String(presentation || '').trim();
    if (!rawValue) return DEFAULT_INDUSTRIAL_PRESENTATION;

    const lower = rawValue.toLowerCase();
    const matched = INDUSTRIAL_PRESENTATIONS.find(item => item.value.toLowerCase() === lower);
    if (matched) return matched.value;

    if (presentationAliases.has(lower)) {
        return presentationAliases.get(lower);
    }

    const collapsed = lower.replace(/\s+/g, ' ');
    if (presentationAliases.has(collapsed)) {
        return presentationAliases.get(collapsed);
    }

    const noSpace = lower.replace(/\s*lb/g, 'lb');
    if (presentationAliases.has(noSpace)) {
        return presentationAliases.get(noSpace);
    }

    return rawValue;
};

export const getIndustrialPresentation = (presentation) => {
    const normalized = normalizeIndustrialPresentation(presentation);
    return INDUSTRIAL_PRESENTATIONS.find(item => item.value === normalized) || null;
};

export const getIndustrialPresentationWeightLbs = (presentation, fallback = 0) => {
    const direct = getIndustrialPresentation(presentation)?.weightLbs;
    if (direct !== undefined && direct !== null && direct > 0) return direct;

    const raw = String(presentation || '').trim().toLowerCase();
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
    if (match) {
        const parsed = parseFloat(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    if (raw.includes('galon') || raw.includes('galón')) return 8;
    if (raw.includes('litro')) return 2;
    if (raw.includes('medio')) return 4;
    if (raw.includes('carton') || raw.includes('cartón')) return 55;
    if (raw.includes('caja')) return 32;
    if (raw.includes('bolsa')) return 5;
    if (raw.includes('tanque')) return 2000;
    if (raw.includes('unidad') || raw.includes('unid')) return 0.20;

    return fallback;
};

export const poundsToKilograms = (pounds) => {
    const numericPounds = Number(pounds);
    return Number.isFinite(numericPounds) ? numericPounds / POUNDS_PER_KILOGRAM : 0;
};

export const kilogramsToPounds = (kilograms) => {
    const numericKilograms = Number(kilograms);
    return Number.isFinite(numericKilograms) ? numericKilograms * POUNDS_PER_KILOGRAM : 0;
};

/**
 * Determina si un lote de producción es compatible con el tipo de producto solicitado
 * (ej. Huevo Entero solo vincula lotes de huevo entero, Clara con clara, Yema con yema).
 */
export const isBatchCompatibleWithProduct = (batchProductType, itemProductType) => {
    if (!itemProductType) return true;
    const bType = String(batchProductType || '').trim().toLowerCase();
    const pType = String(itemProductType || '').trim().toLowerCase();

    if (!bType) return true;
    if (bType === pType) return true;

    // Huevo entero / rápido
    const isItemEntero = pType.includes('entero') || pType.includes('rapido') || pType.includes('rápido');
    const isBatchEntero = bType.includes('entero') || bType.includes('rapido') || bType.includes('rápido');
    if (isItemEntero || isBatchEntero) {
        return isItemEntero && isBatchEntero;
    }

    // Clara / clara ppg
    const isItemClara = pType.includes('clara');
    const isBatchClara = bType.includes('clara');
    if (isItemClara || isBatchClara) {
        return isItemClara && isBatchClara;
    }

    // Yema / yema salada / yema azucarada
    const isItemYema = pType.includes('yema');
    const isBatchYema = bType.includes('yema');
    if (isItemYema || isBatchYema) {
        return isItemYema && isBatchYema;
    }

    // Fórmulas especiales / mezclas
    const isItemFormula = pType.includes('formula') || pType.includes('fórmula') || pType.includes('mezcla') || pType.includes('formulad');
    const isBatchFormula = bType.includes('formula') || bType.includes('fórmula') || bType.includes('mezcla') || bType.includes('formulad');
    if (isItemFormula || isBatchFormula) {
        return isItemFormula && isBatchFormula;
    }

    // Cáscara / cascarón / materia prima
    const isItemCascara = pType.includes('cascara') || pType.includes('cáscara') || pType.includes('cascaron') || pType.includes('cascarón') || pType.includes('materia prima');
    const isBatchCascara = bType.includes('cascara') || bType.includes('cáscara') || bType.includes('cascaron') || bType.includes('cascarón') || bType.includes('materia prima');
    if (isItemCascara || isBatchCascara) {
        return isItemCascara && isBatchCascara;
    }

    return bType.includes(pType) || pType.includes(bType);
};
