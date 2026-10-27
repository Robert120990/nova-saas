const pool = require('../../config/db');

const n = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

const cleanStr = (val) => {
    if (!val) return '';
    return String(val).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim());

/**
 * Anexo Retenciones de IVA 1% Emitidas (Art. 162 CT / DTE-07)
 */
async function getRetencionesEmitidasData({ companyId, branchId, year, month, search, limit, offset }) {
    let pWhere = [
        'ph.company_id = ?',
        'ph.period_year = ?',
        'ph.period_month = ?',
        'ph.retencion > 0',
        '(ph.status IS NULL OR ph.status != "ANULADO")'
    ];
    let pParams = [companyId, year, month];

    let eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        'eh.retencion > 0',
        '(eh.tipo_documento_id IS NULL OR eh.tipo_documento_id != "06")',
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
                ph.id, ph.fecha,
                CASE 
                    WHEN ph.tipo_documento_id = '07' THEN 
                        CASE 
                            WHEN ph.numero_documento IS NOT NULL AND TRIM(ph.numero_documento) NOT IN ('S/N', 'SN', 'SIN NUMERO', 'S-N', '') THEN ph.numero_documento
                            WHEN ph.numero_control IS NOT NULL AND TRIM(ph.numero_control) NOT IN ('S/N', 'SN', 'SIN NUMERO', 'S-N', '') THEN ph.numero_control
                            ELSE 'S/N'
                        END
                    WHEN ph.numero_control IS NOT NULL AND ph.numero_control != ph.numero_documento THEN ph.numero_control
                    ELSE '---'
                END AS doc_retencion,
                CASE 
                    WHEN ph.tipo_documento_id = '07' THEN COALESCE(ph.documento_afectado, '---')
                    ELSE ph.numero_documento
                END AS doc_origen,
                ph.codigo_generacion,
                ph.numero_control,
                ph.sello_recepcion,
                ph.numero_documento,
                ph.tipo_documento_id,
                cat.description AS tipo_doc_origen_nombre,
                ph.total_gravada AS monto_sujeto,
                ph.retencion AS monto_retencion,
                ph.iva, ph.monto_total, ph.status,
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
            CASE 
                WHEN eh.tipo_documento_id = '07' THEN 
                    CASE 
                        WHEN eh.numero_documento IS NOT NULL AND TRIM(eh.numero_documento) NOT IN ('S/N', 'SN', 'SIN NUMERO', 'S-N', '') THEN eh.numero_documento
                        WHEN eh.num_control IS NOT NULL AND TRIM(eh.num_control) NOT IN ('S/N', 'SN', 'SIN NUMERO', 'S-N', '') THEN eh.num_control
                        ELSE 'S/N'
                    END
                WHEN eh.num_control IS NOT NULL AND eh.num_control != eh.numero_documento THEN eh.num_control
                ELSE '---'
            END AS doc_retencion,
            CASE 
                WHEN eh.tipo_documento_id = '07' THEN COALESCE(eh.documento_afectado, '---')
                ELSE eh.numero_documento
            END AS doc_origen,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            eh.numero_documento,
            eh.tipo_documento_id,
            CASE eh.tipo_documento_id
                WHEN '01' THEN 'Factura'
                WHEN '02' THEN 'Crédito Fiscal'
                WHEN '03' THEN 'Factura de Exportación'
                WHEN '04' THEN 'Importación'
                WHEN '05' THEN 'Internación'
                WHEN '06' THEN 'Comprobante de Retención'
                WHEN '07' THEN 'Doc. Contable de Liquidación'
                WHEN '08' THEN 'Nota de Débito'
                WHEN '09' THEN 'Nota de Crédito'
                WHEN '14' THEN 'Factura Sujeto Excluido'
                ELSE COALESCE(cat.description, 'Gasto')
            END AS tipo_doc_origen_nombre,
            eh.total_gravada AS monto_sujeto,
            eh.retencion AS monto_retencion,
            eh.iva,
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

    const mappedPRows = pRows.map(r => {
        const isDocNumUuid = isUuid(r.numero_documento);
        const resolucion = cleanStr(r.codigo_generacion) || (isDocNumUuid ? cleanStr(r.numero_documento) : '---');
        const serie = cleanStr(r.sello_recepcion) || '---';
        const numDoc = cleanStr(r.numero_control) || (!isDocNumUuid ? cleanStr(r.numero_documento) : '---');
        return {
            ...r,
            numero_resolucion: resolucion,
            serie_documento: serie,
            numero_documento: numDoc
        };
    });

    const mappedERows = eRows.map(r => {
        const isDocNumUuid = isUuid(r.numero_documento);
        const resolucion = cleanStr(r.codigo_generacion) || (isDocNumUuid ? cleanStr(r.numero_documento) : '---');
        const serie = cleanStr(r.sello_recepcion) || '---';
        const numDoc = cleanStr(r.numero_control) || (!isDocNumUuid ? cleanStr(r.numero_documento) : '---');
        return {
            ...r,
            numero_resolucion: resolucion,
            serie_documento: serie,
            numero_documento: numDoc
        };
    });

    let dWhere = [
        'd.tipo_dte = "07"',
        'd.company_id = ?',
        'YEAR(COALESCE(sh.fecha_emision, d.created_at)) = ?',
        'MONTH(COALESCE(sh.fecha_emision, d.created_at)) = ?',
        '(d.status IS NULL OR UPPER(d.status) NOT IN ("REJECTED", "ERROR", "INVALIDADO"))'
    ];
    let dParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        dWhere.push('d.branch_id = ?');
        dParams.push(branchId);
    }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        dWhere.push('(d.codigo_generacion LIKE ? OR d.numero_control LIKE ? OR d.sello_recepcion LIKE ? OR d.json_original LIKE ?)');
        dParams.push(s, s, s, s);
    }

    const [dRows] = await pool.query(`
        SELECT 
            'dte-07' AS origen,
            d.id,
            COALESCE(sh.fecha_emision, d.created_at) AS fecha,
            COALESCE(d.numero_control, sh.numero_control) AS numero_control,
            COALESCE(d.codigo_generacion, sh.codigo_generacion) AS codigo_generacion,
            COALESCE(d.sello_recepcion, sh.sello_recepcion) AS sello_recepcion,
            d.status,
            d.json_original,
            b.nombre AS branch_name
        FROM dtes d
        LEFT JOIN sales_headers sh ON d.venta_id = sh.id
        LEFT JOIN branches b ON d.branch_id = b.id
        WHERE ${dWhere.join(' AND ')}
    `, dParams);

    const existingDocRet = new Set(
        [...mappedPRows, ...mappedERows]
            .map(r => cleanStr(r.doc_retencion || r.numero_documento))
            .filter(doc => doc && doc !== '---')
    );
    const standaloneDtes = [];

    for (const d of dRows) {
        const numCtrl = cleanStr(d.numero_control);
        if (existingDocRet.has(numCtrl)) continue;
        let json = {};
        try { json = typeof d.json_original === 'string' ? JSON.parse(d.json_original) : (d.json_original || {}); } catch (e) {}
        const rec = json.receptor || {};
        const res = json.resumen || {};
        const cuerpo = Array.isArray(json.cuerpoDocumento) ? json.cuerpoDocumento : [];
        const relatedDocs = cuerpo.map(item => cleanStr(item.numeroDocumento || item.numDocumento)).filter(Boolean);
        const docOrigen = relatedDocs.length > 0 ? relatedDocs.join(', ') : cleanStr(d.codigo_generacion || '---');

        standaloneDtes.push({
            origen: 'dte-07',
            id: d.id,
            fecha: d.fecha,
            numero_resolucion: cleanStr(d.codigo_generacion || '---'),
            serie_documento: cleanStr(d.sello_recepcion || '---'),
            numero_documento: numCtrl,
            doc_retencion: numCtrl,
            doc_origen: docOrigen,
            codigo_generacion: cleanStr(d.codigo_generacion),
            sello_recepcion: cleanStr(d.sello_recepcion),
            numero_control: numCtrl,
            tipo_documento_id: '07',
            tipo_doc_origen_nombre: 'Comprobante de Retención Electrónico',
            monto_sujeto: n(res.totalSujetoRetencion),
            monto_retencion: n(res.totalIvaRetenido),
            iva: 0,
            monto_total: n(res.totalIvaRetenido),
            status: d.status,
            proveedor_nombre: cleanStr(rec.nombre || 'PROVEEDOR DTE'),
            proveedor_nit: cleanStr(rec.nit || rec.numDocumento),
            proveedor_nrc: cleanStr(rec.nrc),
            branch_name: d.branch_name
        });
    }

    const allRecords = [...mappedPRows, ...mappedERows, ...standaloneDtes].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let totalMontoSujeto = 0;
    let totalRetencion = 0;
    let totalMontoTotal = 0;

    allRecords.forEach(r => {
        totalMontoSujeto += n(r.monto_sujeto);
        totalRetencion += n(r.monto_retencion);
        totalMontoTotal += n(r.monto_total);
    });

    const summary = {
        total_records: allRecords.length,
        total_monto_sujeto: Math.round(totalMontoSujeto * 100) / 100,
        total_retencion: Math.round(totalRetencion * 100) / 100,
        total_monto: Math.round(totalMontoTotal * 100) / 100
    };

    let paged = allRecords;
    if (limit !== undefined && offset !== undefined) {
        const start = parseInt(offset, 10);
        const end = start + parseInt(limit, 10);
        paged = allRecords.slice(start, end);
    }

    const items = paged.map((r, idx) => ({
        corr: (offset || 0) + idx + 1,
        id: r.id,
        origen: r.origen,
        fecha: r.fecha,
        numero_resolucion: cleanStr(r.numero_resolucion || r.codigo_generacion || '---'),
        serie_documento: cleanStr(r.serie_documento || r.sello_recepcion || '---'),
        numero_documento: cleanStr(r.numero_documento || r.doc_retencion || '---'),
        doc_retencion: cleanStr(r.doc_retencion || r.numero_documento),
        doc_origen: cleanStr(r.doc_origen),
        codigo_generacion: cleanStr(r.codigo_generacion || r.numero_resolucion),
        tipo_documento_id: cleanStr(r.tipo_documento_id),
        tipo_doc_origen_nombre: cleanStr(r.tipo_doc_origen_nombre),
        proveedor_nombre: cleanStr(r.proveedor_nombre).toUpperCase(),
        proveedor_nit: cleanStr(r.proveedor_nit),
        proveedor_nrc: cleanStr(r.proveedor_nrc),
        branch_name: cleanStr(r.branch_name || 'CENTRAL'),
        monto_sujeto: n(r.monto_sujeto),
        monto_retencion: n(r.monto_retencion),
        iva: n(r.iva),
        monto_total: n(r.monto_total),
        status: cleanStr(r.status || 'ACTIVO')
    }));

    return { items, summary };
}

/**
 * Anexo Retenciones de IVA 1% Recibidas / Sufridas en Ventas (Art. 162 CT)
 */
async function getRetencionesRecibidasData({ companyId, branchId, year, month, search, limit, offset }) {
    // 1. Retenciones en Ventas (cuando el cliente retuvo directamente en la factura/DTE)
    let whereClauses = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        'sh.iva_retenido > 0',
        'sh.estado != "ANULADO"',
        'sh.estado != "invalidado"'
    ];
    let params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        params.push(branchId);
    }

    if (search && search.trim()) {
        whereClauses.push('(c.nombre LIKE ? OR sh.numero_control LIKE ? OR sh.codigo_generacion LIKE ? OR c.nit LIKE ? OR c.nrc LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    const [salesRows] = await pool.query(`
        SELECT 
            'venta' AS origen,
            sh.id,
            sh.fecha_emision AS fecha,
            COALESCE(sh.numero_control, '---') AS numero_control,
            COALESCE(sh.codigo_generacion, '---') AS codigo_generacion,
            sh.tipo_documento,
            cat.description AS tipo_doc_nombre,
            sh.total_gravado AS monto_sujeto,
            sh.total_iva,
            sh.iva_retenido AS monto_retencion,
            sh.total_pagar,
            sh.estado,
            c.nombre AS cliente_nombre,
            c.nit AS cliente_nit,
            c.nrc AS cliente_nrc,
            b.nombre AS branch_name
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        LEFT JOIN branches b ON sh.branch_id = b.id
        LEFT JOIN cat_002_tipo_dte cat ON sh.tipo_documento COLLATE utf8mb4_unicode_ci = cat.code
        WHERE ${whereSql}
    `, params);

    // 2. Comprobantes de Retención emitidos por clientes e ingresados en Gastos (tipo_documento_id = '06')
    let eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        'eh.tipo_documento_id = "06"',
        '(eh.retencion > 0 OR eh.monto_sujeto > 0)',
        '(eh.status IS NULL OR eh.status != "ANULADO")'
    ];
    let eParams = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        eWhere.push('(p.nombre LIKE ? OR eh.numero_documento LIKE ? OR eh.num_control LIKE ? OR eh.codigo_generacion LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ?)');
        eParams.push(s, s, s, s, s, s);
    }

    const [expenseRows] = await pool.query(`
        SELECT 
            'gasto' AS origen,
            eh.id,
            eh.fecha,
            COALESCE(eh.num_control, eh.numero_documento, '---') AS numero_control,
            COALESCE(eh.codigo_generacion, '---') AS codigo_generacion,
            '06' AS tipo_documento,
            'Comprobante de Retención' AS tipo_doc_nombre,
            COALESCE(eh.monto_sujeto, eh.total_gravada, 0) AS monto_sujeto,
            COALESCE(eh.iva, 0) AS total_iva,
            eh.retencion AS monto_retencion,
            COALESCE(eh.monto_total, eh.retencion) AS total_pagar,
            COALESCE(eh.status, 'ACTIVO') AS estado,
            p.nombre AS cliente_nombre,
            p.nit AS cliente_nit,
            p.nrc AS cliente_nrc,
            b.nombre AS branch_name
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        LEFT JOIN branches b ON eh.branch_id = b.id
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    const allRecords = [...salesRows, ...expenseRows].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let totalMontoSujeto = 0;
    let totalIva = 0;
    let totalRetencion = 0;
    let totalMonto = 0;

    allRecords.forEach(r => {
        totalMontoSujeto += n(r.monto_sujeto);
        totalIva += n(r.total_iva);
        totalRetencion += n(r.monto_retencion);
        totalMonto += n(r.total_pagar);
    });

    const summary = {
        total_records: allRecords.length,
        total_monto_sujeto: Math.round(totalMontoSujeto * 100) / 100,
        total_iva: Math.round(totalIva * 100) / 100,
        total_retencion: Math.round(totalRetencion * 100) / 100,
        total_monto: Math.round(totalMonto * 100) / 100
    };

    let paged = allRecords;
    if (limit !== undefined && offset !== undefined) {
        const start = parseInt(offset, 10);
        const end = start + parseInt(limit, 10);
        paged = allRecords.slice(start, end);
    }

    const items = paged.map((r, idx) => ({
        corr: (offset || 0) + idx + 1,
        id: r.id,
        origen: r.origen,
        fecha: r.fecha,
        numero_control: cleanStr(r.numero_control),
        codigo_generacion: cleanStr(r.codigo_generacion),
        tipo_documento: cleanStr(r.tipo_documento),
        tipo_doc_nombre: cleanStr(r.tipo_doc_nombre || 'Comprobante de Retención'),
        cliente_nombre: cleanStr(r.cliente_nombre || 'AGENTE DE RETENCIÓN').toUpperCase(),
        cliente_nit: cleanStr(r.cliente_nit),
        cliente_nrc: cleanStr(r.cliente_nrc),
        branch_name: cleanStr(r.branch_name || 'CENTRAL'),
        monto_sujeto: n(r.monto_sujeto),
        total_iva: n(r.total_iva),
        monto_retencion: n(r.monto_retencion),
        total_pagar: n(r.total_pagar),
        estado: cleanStr(r.estado || 'ACTIVO')
    }));

    return { items, summary };
}

module.exports = {
    getRetencionesEmitidasData,
    getRetencionesRecibidasData
};
