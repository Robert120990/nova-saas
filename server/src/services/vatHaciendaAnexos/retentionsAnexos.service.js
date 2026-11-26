const pool = require('../../config/db');
const {
    DTE_JOIN_SQL,
    DTE_VALID_SQL,
    toNum,
    round2,
    stripHyphens,
    cleanDocId,
    formatMhDate,
    extractUuid32,
    isComprasEnabled,
    safeJsonParse,
    extractDuiIfNoNit,
    mapExpenseOrPurchaseDocToMh,
    resolveNonPlaceholderDoc
} = require('./anexosHelpers');

const buildPeriodSuffix = (year, month) => `${year}_${String(month).padStart(2, '0')}`;

/**
 * Summarize subject/tax totals for any retention/perception/anticipo annex.
 */
function summarizeTaxAnnexRows(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.count += 1;
        acc.monto_sujeto += Math.abs(toNum(row.monto_sujeto));
        acc.monto_impuesto += Math.abs(toNum(row.monto_impuesto));
        return acc;
    }, { count: 0, monto_sujeto: 0, monto_impuesto: 0 });

    return {
        count: totals.count,
        monto_sujeto: round2(totals.monto_sujeto),
        monto_impuesto: round2(totals.monto_impuesto)
    };
}

/**
 * Anexo 6: Anticipo a Cuenta IVA 2% Efectuado al Declarante (Casilla 161).
 */
async function fetchAnticipoRecibidoRows({ companyId, branchId, year, month }) {
    const whereClauses = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        "(eh.status IS NULL OR eh.status != 'ANULADO')",
        "(eh.anticipo_cuenta > 0 OR (eh.tipo_documento_id = '07' AND eh.monto_sujeto > 0))"
    ];
    const params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('eh.branch_id = ?');
        params.push(branchId);
    }

    const [rows] = await pool.query(`
        SELECT
            eh.id,
            eh.fecha,
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            eh.monto_sujeto,
            eh.anticipo_cuenta AS monto_impuesto,
            COALESCE(
                NULLIF(TRIM(p.nit), ''),
                (SELECT p2.nit FROM providers p2 WHERE p2.nrc = p.nrc AND p2.nit IS NOT NULL AND TRIM(p2.nit) != '' LIMIT 1),
                CASE
                    WHEN p.numero_documento REGEXP '^[0-9]{4}-?[0-9]{6}-?[0-9]{3}-?[0-9]{1}$' THEN p.numero_documento
                    ELSE NULL
                END
            ) AS agente_nit,
            p.tipo_documento AS agente_tipo_doc,
            p.numero_documento AS agente_num_doc
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY eh.fecha ASC, eh.id ASC
    `, params);

    return rows;
}

async function generateAnticipoRecibidoAnnexCsv({ companyId, branchId, year, month }) {
    const rows = await fetchAnticipoRecibidoRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const nit = cleanDocId(row.agente_nit);
        const dui = extractDuiIfNoNit(nit, row.agente_tipo_doc, row.agente_num_doc);
        const numDoc = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control)
            || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);

        return [
            nit,                                                   // 1. NIT del agente
            formatMhDate(row.fecha),                               // 2. Fecha de emisión
            stripHyphens(row.sello_recepcion),                     // 3. Serie / Sello
            numDoc,                                                // 4. Número de documento
            Math.abs(toNum(row.monto_sujeto)).toFixed(2),          // 5. Monto sujeto
            Math.abs(toNum(row.monto_impuesto)).toFixed(2),        // 6. Monto Anticipo 2%
            dui,                                                   // 7. DUI del agente
            '6'                                                    // 8. Número de anexo
        ].join(';');
    });

    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_ANTICIPO_IVA_2_RECIBIDO_${buildPeriodSuffix(year, month)}.csv`
    };
}

/**
 * Anexo 7: Retención IVA 1% Efectuada al Declarante / Sufrida (Casilla 162).
 */
async function fetchRetencionRecibidaRows({ companyId, branchId, year, month }) {
    const sWhere = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        'sh.iva_retenido > 0',
        "sh.estado NOT IN ('ANULADO', 'invalidado')",
        DTE_VALID_SQL
    ];
    const sParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        sWhere.push('sh.branch_id = ?');
        sParams.push(branchId);
    }

    const [salesRows] = await pool.query(`
        SELECT
            sh.id,
            sh.fecha_emision AS fecha,
            sh.tipo_documento AS tipo_doc,
            COALESCE(d.codigo_generacion, sh.codigo_generacion) AS codigo_generacion,
            COALESCE(d.numero_control, sh.numero_control) AS numero_control,
            COALESCE(d.sello_recepcion, sh.sello_recepcion) AS sello_recepcion,
            NULL AS numero_documento,
            sh.total_gravado AS monto_sujeto,
            sh.iva_retenido AS monto_impuesto,
            c.nit AS agente_nit,
            c.tipo_documento AS agente_tipo_doc,
            c.numero_documento AS agente_num_doc
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        WHERE ${sWhere.join(' AND ')}
    `, sParams);

    const eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        "eh.tipo_documento_id = '06'",
        '(eh.retencion > 0 OR ((eh.monto_sujeto > 0 OR eh.total_gravada > 0) AND COALESCE(eh.percepcion, 0) = 0))',
        "(eh.status IS NULL OR eh.status != 'ANULADO')"
    ];
    const eParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    const [expenseRows] = await pool.query(`
        SELECT
            eh.id,
            eh.fecha,
            '07' AS tipo_doc,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            eh.numero_documento,
            COALESCE(NULLIF(eh.monto_sujeto, 0), NULLIF(eh.total_gravada, 0), ROUND(eh.retencion / 0.01, 2), 0) AS monto_sujeto,
            eh.retencion AS monto_impuesto,
            p.nit AS agente_nit,
            p.tipo_documento AS agente_tipo_doc,
            p.numero_documento AS agente_num_doc
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    return [...salesRows, ...expenseRows].sort((a, b) => {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        if (da !== db) return da - db;
        return a.id - b.id;
    });
}

async function generateRetencionRecibidaAnnexCsv({ companyId, branchId, year, month }) {
    const rows = await fetchRetencionRecibidaRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const nit = cleanDocId(row.agente_nit);
        const dui = extractDuiIfNoNit(nit, row.agente_tipo_doc, row.agente_num_doc);
        const numDoc = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control)
            || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);

        return [
            nit,                                                    // 1. NIT del agente
            formatMhDate(row.fecha),                                // 2. Fecha de emisión
            String(row.tipo_doc || '07').trim().padStart(2, '0'),   // 3. Tipo de documento
            stripHyphens(row.sello_recepcion),                      // 4. Serie / Sello
            numDoc,                                                 // 5. Número de documento
            Math.abs(toNum(row.monto_sujeto)).toFixed(2),           // 6. Monto sujeto
            Math.abs(toNum(row.monto_impuesto)).toFixed(2),         // 7. Monto retención 1%
            dui,                                                    // 8. DUI del agente
            '7'                                                     // 9. Número de anexo
        ].join(';');
    });

    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_RETENCION_1_RECIBIDA_${buildPeriodSuffix(year, month)}.csv`
    };
}

/**
 * Anexo 8: Percepción IVA 1% Efectuada al Declarante / Soportada (Casilla 163).
 */
async function fetchPercepcionRecibidaRows({ companyId, branchId, year, month }) {
    const comprasAfectanLibro = await isComprasEnabled(companyId);

    const eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        'eh.percepcion > 0',
        "(eh.status IS NULL OR eh.status != 'ANULADO')"
    ];
    const eParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    const [eRows] = await pool.query(`
        SELECT
            eh.id,
            eh.fecha,
            eh.tipo_documento_id,
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            CASE
                WHEN eh.tipo_documento_id = '06' THEN COALESCE(NULLIF(eh.monto_sujeto, 0), NULLIF(eh.total_gravada, 0), ROUND(eh.percepcion / 0.01, 2), 0)
                ELSE COALESCE(NULLIF(eh.total_gravada, 0), NULLIF(eh.monto_sujeto, 0), ROUND(eh.percepcion / 0.01, 2), 0)
            END AS monto_sujeto,
            eh.percepcion AS monto_impuesto,
            p.nit AS agente_nit,
            p.tipo_documento AS agente_tipo_doc,
            p.numero_documento AS agente_num_doc,
            'gasto' AS source_type
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    let pRows = [];
    if (comprasAfectanLibro) {
        const pWhere = [
            'ph.company_id = ?',
            'ph.period_year = ?',
            'ph.period_month = ?',
            'ph.percepcion > 0',
            "ph.status != 'ANULADO'"
        ];
        const pParams = [companyId, year, month];
        if (branchId && branchId !== 'all') {
            pWhere.push('ph.branch_id = ?');
            pParams.push(branchId);
        }

        const [rows] = await pool.query(`
            SELECT
                ph.id,
                ph.fecha,
                ph.tipo_documento_id,
                ph.numero_documento,
                ph.codigo_generacion,
                ph.numero_control,
                ph.sello_recepcion,
                COALESCE(NULLIF(ph.total_gravada, 0), ROUND(ph.percepcion / 0.01, 2), 0) AS monto_sujeto,
                ph.percepcion AS monto_impuesto,
                p.nit AS agente_nit,
                p.tipo_documento AS agente_tipo_doc,
                p.numero_documento AS agente_num_doc,
                'compra' AS source_type
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            WHERE ${pWhere.join(' AND ')}
        `, pParams);
        pRows = rows;
    }

    return [...eRows, ...pRows]
        .map((row) => ({
            ...row,
            mh_tipo_doc: mapExpenseOrPurchaseDocToMh(row.tipo_documento_id, row.source_type) || '03'
        }))
        .sort((a, b) => {
            const da = new Date(a.fecha).getTime();
            const db = new Date(b.fecha).getTime();
            if (da !== db) return da - db;
            return a.id - b.id;
        });
}

async function generatePercepcionRecibidaAnnexCsv({ companyId, branchId, year, month }) {
    const rows = await fetchPercepcionRecibidaRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const nit = cleanDocId(row.agente_nit);
        const dui = extractDuiIfNoNit(nit, row.agente_tipo_doc, row.agente_num_doc);
        const numDoc = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control)
            || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);

        return [
            nit,                                            // 1. NIT del agente
            formatMhDate(row.fecha),                        // 2. Fecha de emisión
            row.mh_tipo_doc,                                // 3. Tipo de documento
            stripHyphens(row.sello_recepcion),              // 4. Serie / Sello
            numDoc,                                         // 5. Número de documento
            Math.abs(toNum(row.monto_sujeto)).toFixed(2),   // 6. Monto sujeto
            Math.abs(toNum(row.monto_impuesto)).toFixed(2), // 7. Monto percepción 1%
            dui,                                            // 8. DUI del agente
            '8'                                             // 9. Número de anexo
        ].join(';');
    });

    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_PERCEPCION_1_RECIBIDA_${buildPeriodSuffix(year, month)}.csv`
    };
}

/**
 * Anexo 9: Percepción IVA 1% Efectuada por el Declarante (Casilla 169).
 */
async function fetchPercepcionEfectuadaRows({ companyId, branchId, year, month }) {
    const whereClauses = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        'sh.iva_percibido > 0',
        "sh.estado NOT IN ('ANULADO', 'invalidado')",
        DTE_VALID_SQL
    ];
    const params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        params.push(branchId);
    }

    const [rows] = await pool.query(`
        SELECT
            sh.id,
            sh.fecha_emision AS fecha,
            sh.tipo_documento AS tipo_doc,
            COALESCE(d.codigo_generacion, sh.codigo_generacion) AS codigo_generacion,
            COALESCE(d.numero_control, sh.numero_control) AS numero_control,
            COALESCE(d.sello_recepcion, sh.sello_recepcion) AS sello_recepcion,
            sh.total_gravado AS monto_sujeto,
            sh.iva_percibido AS monto_impuesto,
            c.nit AS sujeto_nit,
            c.tipo_documento AS sujeto_tipo_doc,
            c.numero_documento AS sujeto_num_doc
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY sh.fecha_emision ASC, sh.id ASC
    `, params);

    return rows;
}

async function generatePercepcionEfectuadaAnnexCsv({ companyId, branchId, year, month }) {
    const rows = await fetchPercepcionEfectuadaRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const nit = cleanDocId(row.sujeto_nit);
        const dui = extractDuiIfNoNit(nit, row.sujeto_tipo_doc, row.sujeto_num_doc);
        const codGen = extractUuid32(row.codigo_generacion);
        const numCtrl = stripHyphens(row.numero_control);

        return [
            nit,                                                    // 1. NIT del sujeto
            formatMhDate(row.fecha),                                // 2. Fecha de emisión
            String(row.tipo_doc || '03').trim().padStart(2, '0'),   // 3. Tipo de documento
            numCtrl,                                                // 4. Resolución / Número de control
            stripHyphens(row.sello_recepcion),                      // 5. Serie / Sello
            codGen || numCtrl,                                      // 6. Número de documento / Código generación
            Math.abs(toNum(row.monto_sujeto)).toFixed(2),           // 7. Monto sujeto
            Math.abs(toNum(row.monto_impuesto)).toFixed(2),         // 8. Monto percepción 1%
            dui,                                                    // 9. DUI del sujeto
            '9'                                                     // 10. Número de anexo
        ].join(';');
    });

    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_PERCEPCION_1_EFECTUADA_${buildPeriodSuffix(year, month)}.csv`
    };
}

/**
 * Anexo 10: Retención IVA 1% Efectuada por el Declarante (Casilla 170).
 */
async function fetchRetencionEfectuadaRows({ companyId, branchId, year, month }) {
    const comprasAfectanLibro = await isComprasEnabled(companyId);

    const eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        'eh.retencion > 0',
        "(eh.tipo_documento_id IS NULL OR eh.tipo_documento_id NOT IN ('06', '14'))",
        "(eh.status IS NULL OR eh.status != 'ANULADO')"
    ];
    const eParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    const [eRows] = await pool.query(`
        SELECT
            eh.id,
            eh.fecha,
            eh.tipo_documento_id,
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            COALESCE(NULLIF(eh.total_gravada, 0), NULLIF(eh.monto_sujeto, 0), ROUND(eh.retencion / 0.01, 2), 0) AS monto_sujeto,
            eh.retencion AS monto_impuesto,
            p.nit AS sujeto_nit,
            p.tipo_documento AS sujeto_tipo_doc,
            p.numero_documento AS sujeto_num_doc,
            'gasto' AS source_type
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    let pRows = [];
    if (comprasAfectanLibro) {
        const pWhere = [
            'ph.company_id = ?',
            'ph.period_year = ?',
            'ph.period_month = ?',
            'ph.retencion > 0',
            "(ph.tipo_documento_id IS NULL OR ph.tipo_documento_id != '14')",
            "ph.status != 'ANULADO'"
        ];
        const pParams = [companyId, year, month];
        if (branchId && branchId !== 'all') {
            pWhere.push('ph.branch_id = ?');
            pParams.push(branchId);
        }

        const [rows] = await pool.query(`
            SELECT
                ph.id,
                ph.fecha,
                ph.tipo_documento_id,
                ph.numero_documento,
                ph.codigo_generacion,
                ph.numero_control,
                ph.sello_recepcion,
                COALESCE(NULLIF(ph.total_gravada, 0), ROUND(ph.retencion / 0.01, 2), 0) AS monto_sujeto,
                ph.retencion AS monto_impuesto,
                p.nit AS sujeto_nit,
                p.tipo_documento AS sujeto_tipo_doc,
                p.numero_documento AS sujeto_num_doc,
                'compra' AS source_type
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            WHERE ${pWhere.join(' AND ')}
        `, pParams);
        pRows = rows;
    }

    const baseRows = [...eRows, ...pRows].map((row) => ({
        ...row,
        mh_tipo_doc: mapExpenseOrPurchaseDocToMh(row.tipo_documento_id, row.source_type) || '07'
    }));

    const existingCtrls = new Set(
        baseRows
            .map((r) => stripHyphens(r.numero_control))
            .filter(Boolean)
    );
    const existingUuids = new Set(
        baseRows
            .map((r) => extractUuid32(r.codigo_generacion, r.numero_documento))
            .filter(Boolean)
    );

    const dWhere = [
        "d.tipo_dte = '07'",
        'd.company_id = ?',
        "d.status NOT IN ('REJECTED', 'ERROR', 'INVALIDADO')",
        "(d.ambiente IS NULL OR d.ambiente = '01')",
        'YEAR(COALESCE(sh.fecha_emision, d.created_at)) = ?',
        'MONTH(COALESCE(sh.fecha_emision, d.created_at)) = ?'
    ];
    const dParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        dWhere.push('d.branch_id = ?');
        dParams.push(branchId);
    }

    const [dRows] = await pool.query(`
        SELECT
            d.id,
            COALESCE(sh.fecha_emision, d.created_at) AS fecha,
            COALESCE(d.numero_control, sh.numero_control) AS numero_control,
            COALESCE(d.codigo_generacion, sh.codigo_generacion) AS codigo_generacion,
            COALESCE(d.sello_recepcion, sh.sello_recepcion) AS sello_recepcion,
            d.json_original
        FROM dtes d
        LEFT JOIN sales_headers sh ON d.venta_id = sh.id
        WHERE ${dWhere.join(' AND ')}
    `, dParams);

    const standaloneDtes = [];
    for (const d of dRows) {
        const cleanCtrl = stripHyphens(d.numero_control);
        const cleanUuid = extractUuid32(d.codigo_generacion);
        if ((cleanCtrl && existingCtrls.has(cleanCtrl)) || (cleanUuid && existingUuids.has(cleanUuid))) {
            continue;
        }
        if (cleanCtrl) existingCtrls.add(cleanCtrl);
        if (cleanUuid) existingUuids.add(cleanUuid);

        const json = safeJsonParse(d.json_original);
        const rec = json.receptor || {};
        const res = json.resumen || {};

        standaloneDtes.push({
            id: d.id,
            fecha: d.fecha,
            mh_tipo_doc: '07',
            numero_documento: d.codigo_generacion,
            codigo_generacion: d.codigo_generacion,
            numero_control: d.numero_control,
            sello_recepcion: d.sello_recepcion || json.selloRecibido,
            monto_sujeto: toNum(res.totalSujetoRetencion),
            monto_impuesto: toNum(res.totalIvaRetenido),
            sujeto_nit: rec.nit || (rec.tipoDocumento === '36' ? rec.numDocumento : ''),
            sujeto_tipo_doc: rec.tipoDocumento,
            sujeto_num_doc: rec.numDocumento
        });
    }

    return [...baseRows, ...standaloneDtes].sort((a, b) => {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        if (da !== db) return da - db;
        return a.id - b.id;
    });
}

async function generateRetencionEfectuadaAnnexCsv({ companyId, branchId, year, month }) {
    const rows = await fetchRetencionEfectuadaRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const nit = cleanDocId(row.sujeto_nit);
        const dui = extractDuiIfNoNit(nit, row.sujeto_tipo_doc, row.sujeto_num_doc);
        const codGen = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control);
        const numCtrl = stripHyphens(row.numero_control) || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);

        return [
            nit,                                            // 1. NIT del sujeto
            formatMhDate(row.fecha),                        // 2. Fecha de emisión
            row.mh_tipo_doc,                                // 3. Tipo de documento
            numCtrl,                                        // 4. Resolución / Número de control
            stripHyphens(row.sello_recepcion),              // 5. Serie / Sello
            codGen || numCtrl,                              // 6. Número de documento / Código generación
            Math.abs(toNum(row.monto_sujeto)).toFixed(2),   // 7. Monto sujeto
            Math.abs(toNum(row.monto_impuesto)).toFixed(2), // 8. Monto retención 1%
            dui,                                            // 9. DUI del sujeto
            '10'                                            // 10. Número de anexo
        ].join(';');
    });

    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_RETENCION_1_EFECTUADA_${buildPeriodSuffix(year, month)}.csv`
    };
}

module.exports = {
    summarizeTaxAnnexRows,
    fetchAnticipoRecibidoRows,
    generateAnticipoRecibidoAnnexCsv,
    fetchRetencionRecibidaRows,
    generateRetencionRecibidaAnnexCsv,
    fetchPercepcionRecibidaRows,
    generatePercepcionRecibidaAnnexCsv,
    fetchPercepcionEfectuadaRows,
    generatePercepcionEfectuadaAnnexCsv,
    fetchRetencionEfectuadaRows,
    generateRetencionEfectuadaAnnexCsv
};
