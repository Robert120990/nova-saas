/**
 * Helper de cálculo de peso y clasificación de productos para el reporte de ventas de huevo.
 */

function calculateLbs(item) {
    const desc = String(item.descripcion || '');
    const code = String(item.codigo || '').toUpperCase();
    const qty = parseFloat(item.cantidad) || 0;

    // 1. Regex de libras explícitas: "(120.00 Lbs)" o "(4.00 Lbs)"
    const matchPounds = desc.match(/\((\d+(?:\.\d+)?)\s*Lbs?\)/i);
    if (matchPounds) return parseFloat(matchPounds[1]);

    // 2. Huevo en Cáscara (Unidades y Cajas) -> NO SUMA A LIBRAS (se comercializa por unidades/cajas)
    if (code === 'HCU' || code === 'H1' || desc.toUpperCase().includes('CASCARA') || desc.toUpperCase().includes('CÁSCARA') || desc.toUpperCase().includes('CAJA')) {
        return 0;
    }

    // 3. Comidas Especializadas / Comidas e Industrias (cantidades > 100 en Kg)
    const custUpper = (item.customer_name || item.cliente_nombre || '').toUpperCase();
    const isComidasEsp = custUpper.includes('COMIDAS ESPECIALIZADAS') || custUpper.includes('COMIDAS E INDUSTRIAS');
    if (isComidasEsp && qty > 100 && (qty % 1 !== 0 || code.startsWith('HERG') || code.startsWith('CLGL'))) {
        return Math.round(qty * 2.20462262 * 100) / 100;
    }

    // 4. Códigos específicos de ovoproductos
    if (code === 'HEC32' || desc.toUpperCase().includes('CUBETA 32')) return qty * 32;
    if (code.includes('CUBETA 30') || desc.toUpperCase().includes('CUBETA 30')) return qty * 30;
    if (code.includes('CPPGC') || code.includes('CLPPG')) return qty * 32;
    if (code === 'HEG8' || code === 'HER7' || code === 'HERG7' || code === 'HLGL8' || code === 'HECL75' || code === 'CLGL-8' || desc.toUpperCase().includes('GALON') || desc.toUpperCase().includes('GALÓN')) {
        if (desc.toUpperCase().includes('1/2') || desc.toUpperCase().includes('MEDIO') || desc.toUpperCase().includes('4.')) return qty * 4;
        return qty * 8;
    }
    if (code === 'CNG3' || desc.toUpperCase().includes('1/2 GALON') || desc.toUpperCase().includes('4.')) return qty * 4;
    if (code === 'SL01' || code === 'HEL2' || code === 'HEL2.LB' || code === 'HR LTR0.' || code === 'YS5-2' || desc.toUpperCase().includes('LITRO') || desc.toUpperCase().includes('2.')) {
        return qty * 2;
    }
    if (code === 'YAC30') return qty * 30;
    if (code === 'YAG3') return qty * 4;

    return qty;
}

function classifyProduct(code, desc) {
    const c = (code || '').toUpperCase();
    const d = (desc || '').toUpperCase();

    if (c === 'HCU' || c === 'H1' || d.includes('CASCARA') || d.includes('CÁSCARA') || d.includes('HUEVO BLANCO')) return 'HUEVO EN CASCARA';
    if (c.includes('CLPPG') || c.includes('CPPGC') || d.includes('CLARA PPG')) return 'CLARA PPG';
    if (c === 'SL01' || c.startsWith('CLGL') || c.startsWith('CNG') || d.includes('CLARA')) return 'CLARA PASTEURIZADA';
    if (c.startsWith('HERG') || c.startsWith('HER') || c.startsWith('HR') || d.includes('RAPIDO') || d.includes('RÁPIDO')) return 'HUEVO RAPIDO';
    if (c.includes('HEL2.LB') || c.includes('HLGL') || c.includes('HECL') || d.includes('CON LECHE')) return 'HUEVO CON LECHE';
    if (d.includes('ENTERO PPG')) return 'HUEVO ENTERO PPG';
    if (c.startsWith('YAC') || c.startsWith('YAG') || c.startsWith('YS') || d.includes('YEMA AZUCARADA')) return 'YEMA AZUCARADA';
    if (d.includes('YEMA SALADA')) return 'YEMA SALADA';
    if (d.includes('YEMA')) return 'YEMA';
    if (c.startsWith('HEC') || c.startsWith('HEG') || c.startsWith('HEL') || c.startsWith('HEP') || d.includes('HUEVO ENTERO')) return 'HUEVO ENTERO';
    if (c.includes('TORTITA') || d.includes('TORTITA')) return 'TORTITAS DE HUEVO';
    return 'OTROS OVOPRODUCTOS';
}

function isEggProduct(code, desc) {
    const c = (code || '').toUpperCase();
    const d = (desc || '').toUpperCase();
    if (c === 'CONTENEDOR' || c === 'CARTON' || c === 'CARTONH') return false;
    if (d.includes('RETENCION') || d.includes('ALMACENAMIENTO') || d.includes('CORRUGADO') || d.includes('FLETE') || d.includes('DETALLE CON PRECIO')) return false;
    return true;
}

function formatQtyAndPrice(isShell, boxes, units, lbs, amount) {
    if (isShell) {
        const displayQty = (boxes > 0 && units > 0)
            ? `${units.toLocaleString()} Unid / ${boxes.toLocaleString()} Cajas`
            : (boxes > 0 ? `${boxes.toLocaleString()} Cajas` : `${units.toLocaleString()} Unid`);
        const avgPrice = (boxes > 0 && units === 0)
            ? (amount / boxes)
            : (units > 0 && boxes === 0 ? (amount / units) : 0);
        const avgPriceDisplay = (boxes > 0 && units === 0)
            ? `$${(amount / boxes).toFixed(2)} /Caja`
            : (units > 0 && boxes === 0 ? `$${(amount / units).toFixed(2)} /Unid` : '—');
        return { displayQty, avgPrice: Math.round(avgPrice * 100) / 100, avgPriceDisplay };
    }
    const displayQty = `${Number(lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`;
    const avgPrice = lbs > 0 ? (amount / lbs) : 0;
    const avgPriceDisplay = `$${avgPrice.toFixed(2)} /Lb`;
    return { displayQty, avgPrice: Math.round(avgPrice * 100) / 100, avgPriceDisplay };
}

module.exports = {
    calculateLbs,
    classifyProduct,
    isEggProduct,
    formatQtyAndPrice
};
