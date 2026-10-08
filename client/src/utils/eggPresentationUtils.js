/**
 * Utilidades centralizadas para resolución y sugerencia automática
 * de presentaciones comerciales para productos de huevo industrial.
 */

export const PRESENTATION_OPTIONS = [
    { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
    { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
    { id: 'galón 8LB', label: 'Galón 8 Lbs' },
    { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
    { id: 'litro 2LB', label: 'Litro 2 Lbs' },
    { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
];

/**
 * Obtiene la presentación estándar por defecto según el tipo de producto
 * y la configuración del sistema (egg_product_config).
 *
 * Reglas de negocio:
 * - Clara / Clara PPG -> galón 8LB
 * - Yema Azucarada / Salada -> medio galón 4LB
 * - Huevo Rápido -> cubeta 32LB
 * - Huevo Entero / Fórmulas Especiales / Otros -> cubeta 30LB (o peso configurado)
 */
export const getDefaultPresentationForProduct = (productType, productConfig = []) => {
    const p = (productType || '').toLowerCase().trim();

    // 1. Si existe configuración en BD con peso unitario específico
    if (Array.isArray(productConfig) && productConfig.length > 0) {
        const cfg = productConfig.find(c => (c.product_type || '').toLowerCase().trim() === p);
        if (cfg && cfg.weight_per_unit_lbs) {
            const w = parseFloat(cfg.weight_per_unit_lbs);
            if (w === 30) return 'cubeta 30LB';
            if (w === 32) return 'cubeta 32LB';
            if (w === 8) return 'galón 8LB';
            if (w === 4) return 'medio galón 4LB';
            if (w === 2) return 'litro 2LB';
            if (w === 5) return 'bolsa 5LB';
        }
    }

    // 2. Mapeo estándar según perfil comercial
    if (p.includes('clara')) {
        return 'galón 8LB';
    }
    if (p.includes('azucar') || p.includes('azúcar') || p.includes('sal')) {
        return 'medio galón 4LB';
    }
    if (p.includes('rapido') || p.includes('rápido')) {
        return 'cubeta 32LB';
    }
    if (p.includes('leche')) {
        return 'cubeta 30LB';
    }
    if (p.includes('plus') || p.includes('formulado') || p.includes('especial')) {
        return 'cubeta 30LB';
    }

    // Por defecto estándar
    return 'cubeta 30LB';
};

/**
 * Resuelve y normaliza cadenas de presentación (individuales o múltiples separadas por coma)
 * al catálogo oficial del sistema.
 */
export const resolvePresentations = (presString, defaultPres = 'cubeta 30LB') => {
    if (!presString) {
        return [defaultPres];
    }

    if (Array.isArray(presString)) {
        if (presString.length === 0) return [defaultPres];
        const flat = presString.map(item => resolvePresentations(item, defaultPres)[0]);
        const unique = Array.from(new Set(flat));
        return unique.length > 0 ? unique : [defaultPres];
    }

    if (typeof presString !== 'string') {
        return [defaultPres];
    }

    const parts = presString
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    if (parts.length === 0) return [defaultPres];

    const resolved = parts.map(raw => {
        if (raw.includes('30')) return 'cubeta 30LB';
        if (raw.includes('32')) return 'cubeta 32LB';
        if (raw.includes('medio') || raw.includes('4lb') || raw.includes('4 lb')) return 'medio galón 4LB';
        if (raw.includes('gal') || raw.includes('8lb') || raw.includes('8 lb')) return 'galón 8LB';
        if (raw.includes('litro') || raw.includes('2lb') || raw.includes('2 lb')) return 'litro 2LB';
        if (raw.includes('bolsa 5') || raw.includes('5lb')) return 'bolsa 5LB';
        return defaultPres;
    });

    const unique = Array.from(new Set(resolved));
    return unique.length > 0 ? unique : [defaultPres];
};
