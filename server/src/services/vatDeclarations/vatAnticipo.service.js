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
 * Anexo Anticipo a Cuenta 2% (Art. 162-A CT)
 */
async function getAnticipoCuentaData({ companyId, branchId, year, month, search, limit, offset }) {
    let whereClauses = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        '(eh.status IS NULL OR eh.status != "ANULADO")',
        '(eh.anticipo_cuenta > 0 OR (eh.tipo_documento_id = "07" AND eh.monto_sujeto > 0))'
    ];
    let params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('eh.branch_id = ?');
        params.push(branchId);
    }

const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim());

    if (search && search.trim()) {
        whereClauses.push('(p.nombre LIKE ? OR eh.numero_documento LIKE ? OR eh.codigo_generacion LIKE ? OR eh.num_control LIKE ? OR p.nit LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    const [totRows] = await pool.query(`
        SELECT 
            COUNT(*) AS total_records,
            COALESCE(SUM(eh.anticipo_cuenta), 0) AS total_anticipo,
            COALESCE(SUM(eh.monto_sujeto), 0) AS total_monto_sujeto,
            COALESCE(SUM(eh.monto_total), 0) AS total_monto
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${whereSql}
    `, params);

    const summary = {
        total_records: parseInt(totRows[0]?.total_records, 10) || 0,
        total_anticipo: Math.round(n(totRows[0]?.total_anticipo) * 100) / 100,
        total_monto_sujeto: Math.round(n(totRows[0]?.total_monto_sujeto) * 100) / 100,
        total_monto: Math.round(n(totRows[0]?.total_monto) * 100) / 100
    };

    let dataQuery = `
        SELECT 
            eh.id,
            eh.fecha,
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control,
            eh.tipo_documento_id,
            eh.monto_sujeto,
            eh.anticipo_cuenta,
            eh.monto_total,
            eh.status,
            p.nombre AS proveedor_nombre,
            p.nit AS proveedor_nit,
            p.nrc AS proveedor_nrc,
            b.nombre AS branch_name
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        LEFT JOIN branches b ON eh.branch_id = b.id
        WHERE ${whereSql}
        ORDER BY eh.fecha ASC, eh.id ASC
    `;

    const queryParams = [...params];
    if (limit !== undefined && offset !== undefined) {
        dataQuery += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10), parseInt(offset, 10));
    }

    const [rows] = await pool.query(dataQuery, queryParams);

    const items = rows.map((r, idx) => {
        let codGen = cleanStr(r.codigo_generacion);
        let numDoc = cleanStr(r.numero_documento);
        const numCtrl = cleanStr(r.num_control);

        if (!codGen && isUuid(numDoc)) {
            codGen = numDoc;
            numDoc = numCtrl && !isUuid(numCtrl) ? numCtrl : 'S/N';
        } else if (!codGen && isUuid(numCtrl)) {
            codGen = numCtrl;
        }

        return {
            corr: (offset || 0) + idx + 1,
            id: r.id,
            fecha: r.fecha,
            numero_documento: numDoc,
            codigo_generacion: codGen,
            num_control: numCtrl,
            tipo_documento_id: cleanStr(r.tipo_documento_id),
            proveedor_nombre: cleanStr(r.proveedor_nombre || 'PROVEEDOR VARIOS').toUpperCase(),
            proveedor_nit: cleanStr(r.proveedor_nit),
            proveedor_nrc: cleanStr(r.proveedor_nrc),
            branch_name: cleanStr(r.branch_name || 'CENTRAL'),
            monto_sujeto: n(r.monto_sujeto),
            anticipo_cuenta: n(r.anticipo_cuenta),
            monto_total: n(r.monto_total),
            status: cleanStr(r.status || 'ACTIVO')
        };
    });

    return { items, summary };
}

module.exports = {
    getAnticipoCuentaData
};
