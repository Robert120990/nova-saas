const pool = require('../../config/db');

const n = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

const cleanStr = (val) => {
    if (!val) return '';
    return String(val).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Anexo Percepciones 1% (Art. 163 CT) Soportadas en Compras y Gastos
 */
async function getPercepcionesData({ companyId, branchId, year, month, search, limit, offset }) {
    let pWhere = [
        'ph.company_id = ?',
        'ph.period_year = ?',
        'ph.period_month = ?',
        'ph.percepcion > 0',
        '(ph.status IS NULL OR ph.status != "ANULADO")'
    ];
    let pParams = [companyId, year, month];

    let eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        'eh.percepcion > 0',
        '(eh.status IS NULL OR eh.status != "ANULADO")'
    ];
    let eParams = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        pWhere.push('ph.branch_id = ?');
        pParams.push(branchId);
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        pWhere.push('(p.nombre LIKE ? OR ph.numero_documento LIKE ? OR ph.numero_control LIKE ? OR p.nit LIKE ?)');
        pParams.push(s, s, s, s);
        eWhere.push('(p.nombre LIKE ? OR eh.numero_documento LIKE ? OR eh.num_control LIKE ? OR p.nit LIKE ?)');
        eParams.push(s, s, s, s);
    }

    // Configuración tributaria: compras afectan libro/declaraciones solo si está habilitado
    const [taxConfigRows] = await pool.query(
        'SELECT compras_afectan_libro_compras FROM tax_configurations WHERE company_id = ?',
        [companyId]
    );
    const comprasAfectanLibro = Boolean(taxConfigRows[0]?.compras_afectan_libro_compras);

    let pRows = [];
    if (comprasAfectanLibro) {
        const [rows] = await pool.query(`
            SELECT 
                'compra' AS origen,
                ph.id, ph.fecha, ph.numero_documento, ph.codigo_generacion, ph.numero_control, ph.tipo_documento_id,
                cat.description AS tipo_doc_nombre,
                ph.total_gravada AS monto_sujeto,
                ph.iva,
                ph.percepcion AS monto_percepcion,
                ph.monto_total, ph.status,
                p.nombre AS proveedor_nombre, p.nit AS proveedor_nit, p.nrc AS proveedor_nrc,
                b.nombre AS branch_name
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN branches b ON ph.branch_id = b.id
            LEFT JOIN cat_002_tipo_dte cat ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code
            WHERE ${pWhere.join(' AND ')}
        `, pParams);
        pRows = rows;
    }

    const [eRows] = await pool.query(`
        SELECT 
            'gasto' AS origen,
            eh.id,
            eh.fecha,
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.tipo_documento_id,
            cat.description AS tipo_doc_nombre,
            eh.total_gravada AS monto_sujeto,
            eh.iva,
            eh.percepcion AS monto_percepcion,
            eh.monto_total,
            eh.status,
            p.nombre AS proveedor_nombre,
            p.nit AS proveedor_nit,
            p.nrc AS proveedor_nrc,
            b.nombre AS branch_name
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        LEFT JOIN branches b ON eh.branch_id = b.id
        LEFT JOIN cat_002_tipo_dte cat ON eh.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    const allRecords = [...pRows, ...eRows].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let totalMontoSujeto = 0;
    let totalIva = 0;
    let totalPercepcion = 0;
    let totalMontoTotal = 0;

    allRecords.forEach(r => {
        totalMontoSujeto += n(r.monto_sujeto);
        totalIva += n(r.iva);
        totalPercepcion += n(r.monto_percepcion);
        totalMontoTotal += n(r.monto_total);
    });

    const summary = {
        total_records: allRecords.length,
        total_monto_sujeto: Math.round(totalMontoSujeto * 100) / 100,
        total_iva: Math.round(totalIva * 100) / 100,
        total_percepcion: Math.round(totalPercepcion * 100) / 100,
        total_monto: Math.round(totalMontoTotal * 100) / 100
    };

    let paged = allRecords;
    if (limit !== undefined && offset !== undefined) {
        const start = parseInt(offset, 10);
        const end = start + parseInt(limit, 10);
        paged = allRecords.slice(start, end);
    }

    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim());

    const items = paged.map((r, idx) => {
        let codGen = cleanStr(r.codigo_generacion);
        let numDoc = cleanStr(r.numero_documento);
        const numCtrl = cleanStr(r.numero_control);

        if (!codGen && isUuid(numDoc)) {
            codGen = numDoc;
            numDoc = numCtrl && !isUuid(numCtrl) ? numCtrl : 'S/N';
        } else if (!codGen && isUuid(numCtrl)) {
            codGen = numCtrl;
        }

        const isDocPlaceholder = !numDoc || ['S/N', 'SN', 'SIN NUMERO', 'S-N'].includes(numDoc.toUpperCase());
        const isCtrlPlaceholder = !numCtrl || ['S/N', 'SN', 'SIN NUMERO', 'S-N'].includes(numCtrl.toUpperCase());

        if (isDocPlaceholder && !isCtrlPlaceholder && !isUuid(numCtrl)) {
            numDoc = numCtrl;
        }

        return {
            corr: (offset || 0) + idx + 1,
            id: r.id,
            origen: r.origen,
            fecha: r.fecha,
            numero_documento: numDoc || 'S/N',
            codigo_generacion: codGen,
            numero_control: numCtrl,
            tipo_documento_id: cleanStr(r.tipo_documento_id),
            tipo_doc_nombre: cleanStr(r.tipo_doc_nombre || 'Crédito Fiscal'),
            proveedor_nombre: cleanStr(r.proveedor_nombre).toUpperCase(),
            proveedor_nit: cleanStr(r.proveedor_nit),
            proveedor_nrc: cleanStr(r.proveedor_nrc),
            branch_name: cleanStr(r.branch_name || 'CENTRAL'),
            monto_sujeto: n(r.monto_sujeto),
            iva: n(r.iva),
            monto_percepcion: n(r.monto_percepcion),
            monto_total: n(r.monto_total),
            status: cleanStr(r.status || 'ACTIVO')
        };
    });

    return { items, summary };
}

module.exports = {
    getPercepcionesData
};
