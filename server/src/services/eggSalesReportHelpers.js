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

    // 2. Huevo en Cáscara (Unidades, Cartones y Cajas) -> NO SUMA A LIBRAS (se comercializa por unidades/cartones/cajas)
    if (code === 'HCU' || code === 'H1' || code === 'HC' || code === 'CARTONH' || desc.toUpperCase().includes('CASCARA') || desc.toUpperCase().includes('CÁSCARA') || desc.toUpperCase().includes('CAJA') || desc.toUpperCase().includes('CARTON DE HUEVO')) {
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

    if (c === 'HCU' || c === 'H1' || c === 'HC' || c === 'CARTONH' || d.includes('CASCARA') || d.includes('CÁSCARA') || d.includes('HUEVO BLANCO') || d.includes('CARTON DE HUEVO')) return 'HUEVO EN CASCARA';
    if (c.includes('CLPPG') || c.includes('CPPGC') || d.includes('CLARA PPG')) return 'CLARA PPG';
    if (c === 'SL01' || c.startsWith('CLGL') || c.startsWith('CNG') || d.includes('CLARA')) return 'CLARA PASTEURIZADA';
    if (c.startsWith('HERG') || c.startsWith('HER') || c.startsWith('HR') || d.includes('RAPIDO') || d.includes('RÁPIDO')) return 'HUEVO RAPIDO';
    if (c.includes('HEL2.LB') || c.includes('HLGL') || c.includes('HECL') || d.includes('CON LECHE')) return 'HUEVO CON LECHE';
    if (d.includes('ENTERO PPG')) return 'HUEVO ENTERO PPG';
    if (c.startsWith('YAC') || c.startsWith('YAG') || c.startsWith('YS') || d.includes('YEMA AZUCARADA')) return 'YEMA AZUCARADA';
    if (d.includes('YEMA SALADA')) return 'YEMA SALADA';
    if (d.includes('YEMA')) return 'YEMA';
    if (c.startsWith('HEC') || c.startsWith('HEG') || c.startsWith('HEL') || c.startsWith('HEP') || d.includes('HUEVO ENTERO')) return 'HUEVO ENTERO';
    if (d.includes('TORTITA')) return 'TORTITAS DE HUEVO';
    // Ovoproductos explícitos o derivados de huevo
    if (d.includes('HUEVO') || d.includes('OVOPRODUCTO') || d.includes('ALBUMINA') || d.includes('ALBÚMINA') || c.startsWith('OVO') || d.includes('LOTE:')) {
        return 'OTROS OVOPRODUCTOS';
    }
    return null;
}

function isEggProduct(code, desc) {
    if (!code && !desc) return false;
    const c = (code || '').toUpperCase();
    const d = (desc || '').toUpperCase();
    if (c === 'CONTENEDOR' || c === 'CARTON' || d.includes('CARTON VACIO') || d.includes('CARTÓN VACÍO')) return false;
    if (d.includes('RETENCION') || d.includes('ALMACENAMIENTO') || d.includes('CORRUGADO') || d.includes('FLETE') || d.includes('DETALLE CON PRECIO')) return false;
    if (c === 'AZUCAR' || d.includes('AZUCAR') || d.includes('AZÚCAR')) return false;
    return classifyProduct(code, desc) !== null;
}

function formatQtyAndPrice(isShell, boxes, units, lbs, amount, cartons = 0) {
    if (isShell) {
        const parts = [];
        if (units > 0) parts.push(`${units.toLocaleString()} Unid`);
        if (cartons > 0) parts.push(`${cartons.toLocaleString()} Cartón${cartons > 1 ? 'es' : ''}`);
        if (boxes > 0) parts.push(`${boxes.toLocaleString()} Caja${boxes > 1 ? 's' : ''}`);
        const displayQty = parts.length > 0 ? parts.join(' / ') : '0 Unid';

        let avgPrice = 0;
        let avgPriceDisplay = '—';
        if (boxes > 0 && units === 0 && cartons === 0) {
            avgPrice = amount / boxes;
            avgPriceDisplay = `$${avgPrice.toFixed(2)} /Caja`;
        } else if (cartons > 0 && units === 0 && boxes === 0) {
            avgPrice = amount / cartons;
            avgPriceDisplay = `$${avgPrice.toFixed(2)} /Cartón`;
        } else if (units > 0 && boxes === 0 && cartons === 0) {
            avgPrice = amount / units;
            avgPriceDisplay = `$${avgPrice.toFixed(2)} /Unid`;
        } else if (amount > 0) {
            avgPriceDisplay = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return { displayQty, avgPrice: Math.round(avgPrice * 100) / 100, avgPriceDisplay };
    }
    const displayQty = `${Number(lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`;
    const avgPrice = lbs > 0 ? (amount / lbs) : 0;
    const avgPriceDisplay = `$${avgPrice.toFixed(2)} /Lb`;
    return { displayQty, avgPrice: Math.round(avgPrice * 100) / 100, avgPriceDisplay };
}

function buildEggSalesReportQuery(companyId, filters = {}) {
    const { startDate, endDate, customerId, from, to, month, remissionMode = 'facturado_pendiente' } = filters;
    let startFilter = startDate || from;
    let endFilter = endDate || to;

    if (month && !startFilter && !endFilter) {
        const [y, m] = month.split('-').map(Number);
        if (y && m) {
            startFilter = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            endFilter = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }

    let query = `
        SELECT si.id as item_id, si.sale_id, si.codigo, si.descripcion, si.cantidad, si.precio_unitario,
               si.venta_gravada, si.venta_exenta,
               sh.fecha_emision,
               COALESCE(sh.tipo_documento, sh.dte_type) as tipo_documento,
               COALESCE(sh.numero_control, d_c.numero_control, d_v.numero_control) as numero_control,
               COALESCE(sh.codigo_generacion, d_c.codigo_generacion, d_v.codigo_generacion) as codigo_generacion,
               sh.cliente_nombre, sh.customer_id,
               c.nombre as customer_name, c.nit as customer_nit, c.nrc as customer_nrc,
               (
                   SELECT GROUP_CONCAT(DISTINCT ld.doc_number SEPARATOR ', ')
                   FROM sales_linked_documents ld
                   WHERE ld.sale_id = sh.id AND ld.doc_type = '04'
               ) AS linked_remisiones
        FROM sales_items si
        JOIN sales_headers sh ON si.sale_id = sh.id
        LEFT JOIN dtes d_c ON (sh.codigo_generacion IS NOT NULL AND sh.codigo_generacion != '' AND d_c.codigo_generacion = sh.codigo_generacion AND d_c.company_id = sh.company_id)
        LEFT JOIN dtes d_v ON (sh.codigo_generacion IS NULL OR sh.codigo_generacion = '') AND d_v.venta_id = sh.id AND d_v.company_id = sh.company_id
        JOIN companies comp ON comp.id = sh.company_id
        LEFT JOIN customers c ON sh.customer_id = c.id
        WHERE sh.company_id = ?
          AND UPPER(COALESCE(sh.estado, '')) NOT IN ('ANULADO', 'ANULADA', 'INVALIDADO', 'RECHAZADO')
          AND (COALESCE(d_c.status, d_v.status) IS NULL OR UPPER(COALESCE(d_c.status, d_v.status)) NOT IN ('INVALIDADO', 'REJECTED', 'RECHAZADO', 'ANULADO', 'ERROR'))
          AND (comp.ambiente = '1' OR (COALESCE(d_c.ambiente, d_v.ambiente, '01') != '00' AND UPPER(COALESCE(sh.observaciones, '')) NOT LIKE '%PRUEBA%'))
          AND NOT EXISTS (
              SELECT 1 FROM dte_invalidations di 
              WHERE di.codigo_generacion_dte = COALESCE(sh.codigo_generacion, d_c.codigo_generacion, d_v.codigo_generacion) 
                AND di.estado IN ('ACCEPTED', 'SENT')
          )
    `;

    const includeCreditNotes = filters.includeCreditNotes === true || filters.includeCreditNotes === 'true' || filters.includeCreditNotes === '1' || filters.includeCreditNotes === 1;
    const fiscalDocTypes = includeCreditNotes ? "'01', '03', '11', '05'" : "'01', '03', '11'";

    if (remissionMode === 'solo_fiscal') {
        query += ` AND COALESCE(sh.tipo_documento, sh.dte_type) IN (${fiscalDocTypes})
                   AND (si.venta_gravada > 0 OR si.venta_exenta > 0 OR (COALESCE(sh.tipo_documento, sh.dte_type) = '05' AND si.cantidad > 0))`;
    } else if (remissionMode === 'despachos_fisicos') {
        query += ` AND (
                       COALESCE(sh.tipo_documento, sh.dte_type) = '04'
                       OR (
                           COALESCE(sh.tipo_documento, sh.dte_type) IN (${fiscalDocTypes})
                           AND NOT EXISTS (
                               SELECT 1 FROM sales_linked_documents ld
                               WHERE ld.sale_id = sh.id AND ld.doc_type = '04'
                           )
                       )
                   )
                   AND (si.venta_gravada > 0 OR si.venta_exenta > 0 OR (COALESCE(sh.tipo_documento, sh.dte_type) IN ('04', '05') AND si.cantidad > 0))`;
    } else {
        // 'facturado_pendiente' (por defecto): Suman facturas fiscales y remisiones solo si NO han sido facturadas
        query += ` AND (
                       COALESCE(sh.tipo_documento, sh.dte_type) IN (${fiscalDocTypes})
                       OR (
                           COALESCE(sh.tipo_documento, sh.dte_type) = '04'
                           AND NOT EXISTS (
                               SELECT 1 FROM sales_linked_documents ld
                               JOIN sales_headers fact ON ld.sale_id = fact.id
                               WHERE ld.doc_type = '04'
                                 AND (ld.doc_number = COALESCE(sh.codigo_generacion, '') 
                                      OR ld.doc_number = COALESCE(sh.numero_control, '') 
                                      OR ld.doc_number = CONVERT(sh.id, CHAR) COLLATE utf8mb4_0900_ai_ci)
                                 AND UPPER(COALESCE(fact.estado, '')) NOT IN ('ANULADO', 'ANULADA', 'INVALIDADO', 'RECHAZADO')
                           )
                       )
                   )
                   AND (si.venta_gravada > 0 OR si.venta_exenta > 0 OR (COALESCE(sh.tipo_documento, sh.dte_type) IN ('04', '05') AND si.cantidad > 0))`;
    }

    const params = [companyId];
    if (startFilter) {
        query += ' AND sh.fecha_emision >= ?';
        params.push(startFilter);
    }
    if (endFilter) {
        query += ' AND sh.fecha_emision <= ?';
        params.push(endFilter);
    }
    if (customerId) {
        query += ' AND sh.customer_id = ?';
        params.push(customerId);
    }

    query += ' ORDER BY sh.fecha_emision ASC, sh.id ASC, si.id ASC';

    return { query, params };
}

module.exports = {
    calculateLbs,
    classifyProduct,
    isEggProduct,
    formatQtyAndPrice,
    buildEggSalesReportQuery
};
