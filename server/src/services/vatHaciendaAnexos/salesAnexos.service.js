const pool = require('../../config/db');
const {
    ALLOWED_TAXPAYER_INCOME_TYPES,
    CA_COUNTRY_CODES,
    DTE_JOIN_SQL,
    DTE_VALID_SQL,
    toNum,
    round2,
    stripHyphens,
    cleanDocId,
    cleanCsvText,
    formatMhDate,
    extractUuid32,
    extractDuiIfNoNit
} = require('./anexosHelpers');

/**
 * Fetch taxpayer sales rows (Anexo 1) for a given company, period, and optional branch.
 */
async function fetchTaxpayersSalesRows({ companyId, branchId, year, month }) {
    const ccfFilterSql = `(
        sh.tipo_documento IN ('03', '06')
        OR (
            sh.tipo_documento = '05'
            AND (
                (c.nrc IS NOT NULL AND TRIM(c.nrc) != '')
                OR JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.documentoRelacionado[0].tipoDocumento')) = '03'
            )
        )
    )`;

    const whereClauses = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        ccfFilterSql,
        "sh.estado NOT IN ('ANULADO', 'invalidado')",
        DTE_VALID_SQL
    ];
    const params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        params.push(branchId);
    }

    const query = `
        SELECT
            sh.id,
            sh.fecha_emision,
            sh.tipo_documento,
            sh.codigo_generacion,
            sh.numero_control,
            sh.sello_recepcion,
            d.codigo_generacion AS dte_codigo_generacion,
            d.numero_control AS dte_numero_control,
            d.sello_recepcion AS dte_sello_recepcion,
            sh.total_exento,
            sh.total_nosujetas,
            sh.total_gravado,
            sh.total_iva,
            sh.total_pagar,
            c.nombre AS customer_nombre,
            c.nrc AS customer_nrc,
            c.nit AS customer_nit,
            c.tipo_documento AS customer_tipo_documento,
            c.numero_documento AS customer_numero_documento
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY sh.fecha_emision ASC, COALESCE(d.numero_control, sh.numero_control) ASC, sh.id ASC
    `;

    const [rows] = await pool.query(query, params);
    return rows;
}

/**
 * Generate MH Anexo 1 (Ventas a Contribuyentes) CSV content (20 columns, semicolon-delimited, no header, no BOM, CRLF).
 */
async function generateTaxpayersAnnexCsv({ companyId, branchId, year, month, tipoIngreso = '3' }) {
    const safeIncomeType = ALLOWED_TAXPAYER_INCOME_TYPES.includes(String(tipoIngreso))
        ? String(tipoIngreso)
        : '3';

    const rows = await fetchTaxpayersSalesRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const codGen = extractUuid32(row.dte_codigo_generacion, row.codigo_generacion);
        const sello = stripHyphens(row.dte_sello_recepcion || row.sello_recepcion);
        const numCtrl = stripHyphens(row.dte_numero_control || row.numero_control);
        const docClass = codGen ? '4' : '1';
        const docType = String(row.tipo_documento || '03').trim().padStart(2, '0');

        const nrcOrNit = cleanDocId(row.customer_nrc) || cleanDocId(row.customer_nit);
        const dui = nrcOrNit
            ? ''
            : extractDuiIfNoNit(nrcOrNit, row.customer_tipo_documento, row.customer_numero_documento);

        const exentas = Math.abs(toNum(row.total_exento));
        const noSujetas = Math.abs(toNum(row.total_nosujetas));
        const gravadas = Math.abs(toNum(row.total_gravado));
        const debitoFiscal = Math.abs(toNum(row.total_iva));
        const totalVentas = exentas + noSujetas + gravadas + debitoFiscal;

        let tipoOperacion = '1';
        if (gravadas > 0 && (exentas > 0 || noSujetas > 0)) {
            tipoOperacion = '4';
        } else if (gravadas > 0) {
            tipoOperacion = '1';
        } else if (exentas > 0 || noSujetas > 0) {
            tipoOperacion = '2';
        }

        return [
            formatMhDate(row.fecha_emision),
            docClass,
            docType,
            codGen,
            sello,
            numCtrl,
            numCtrl,
            nrcOrNit,
            cleanCsvText(row.customer_nombre || 'CLIENTE VARIOS'),
            exentas.toFixed(2),
            noSujetas.toFixed(2),
            gravadas.toFixed(2),
            debitoFiscal.toFixed(2),
            '0.00',
            '0.00',
            totalVentas.toFixed(2),
            dui,
            tipoOperacion,
            safeIncomeType,
            '1'
        ].join(';');
    });

    const paddedMonth = String(month).padStart(2, '0');
    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_CONTRIBUYENTES_${year}_${paddedMonth}.csv`
    };
}

function summarizeTaxpayers(rows) {
    const totals = rows.reduce((acc, row) => {
        const sign = String(row.tipo_documento || '').trim() === '05' ? -1 : 1;
        const grav = sign * Math.abs(toNum(row.total_gravado));
        const exe = sign * Math.abs(toNum(row.total_exento));
        const ns = sign * Math.abs(toNum(row.total_nosujetas));
        const iva = sign * Math.abs(toNum(row.total_iva));
        acc.count += 1;
        acc.gravadas += grav;
        acc.exentas += exe;
        acc.no_sujetas += ns;
        acc.debito_fiscal += iva;
        acc.total += grav + exe + ns + iva;
        return acc;
    }, { count: 0, gravadas: 0, exentas: 0, no_sujetas: 0, debito_fiscal: 0, total: 0 });

    return {
        count: totals.count,
        gravadas: round2(totals.gravadas),
        exentas: round2(totals.exentas),
        no_sujetas: round2(totals.no_sujetas),
        debito_fiscal: round2(totals.debito_fiscal),
        total: round2(totals.total)
    };
}

/**
 * Fetch consumer sales rows (Anexo 2: DTE-01, DTE-11, and consumer-linked NC DTE-05).
 */
async function fetchConsumersSalesRows({ companyId, branchId, year, month }) {
    const facFilterSql = `(
        sh.tipo_documento IN ('01', '11')
        OR (
            sh.tipo_documento = '05'
            AND (c.nrc IS NULL OR TRIM(c.nrc) = '')
            AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.documentoRelacionado[0].tipoDocumento')), '01') = '01'
        )
    )`;

    const whereClauses = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        facFilterSql,
        "sh.estado NOT IN ('ANULADO', 'invalidado')",
        DTE_VALID_SQL
    ];
    const params = [companyId, year, month];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        params.push(branchId);
    }

    const query = `
        SELECT
            sh.id,
            sh.fecha_emision,
            sh.tipo_documento,
            sh.codigo_generacion,
            sh.numero_control,
            d.codigo_generacion AS dte_codigo_generacion,
            d.numero_control AS dte_numero_control,
            sh.total_exento,
            sh.total_nosujetas,
            sh.total_gravado,
            sh.total_iva,
            sh.fovial,
            sh.cotrans,
            sh.total_pagar,
            sh.export_item_type,
            sh.dest_country_code
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY DATE(sh.fecha_emision) ASC, COALESCE(d.numero_control, sh.numero_control) ASC, sh.id ASC
    `;

    const [rows] = await pool.query(query, params);
    return rows;
}

/**
 * Group consumer sales rows by emission date and document type (01 or 11) per DGII Anexo 2 rules.
 */
function groupConsumerRowsByDay(rows) {
    const groupMap = new Map();

    for (const row of rows) {
        const dateStr = formatMhDate(row.fecha_emision);
        if (!dateStr) continue;

        const rawDoc = String(row.tipo_documento || '01').trim().padStart(2, '0');
        const groupDocType = rawDoc === '11' ? '11' : '01';
        const key = `${dateStr}|${groupDocType}`;

        if (!groupMap.has(key)) {
            groupMap.set(key, {
                dateStr,
                groupDocType,
                firstPrimaryUuid: '',
                lastPrimaryUuid: '',
                firstAnyUuid: '',
                lastAnyUuid: '',
                exentas: 0,
                noSujetas: 0,
                gravadasLocales: 0,
                expCA: 0,
                expFueraCA: 0,
                expServicios: 0
            });
        }

        const bucket = groupMap.get(key);
        const uuid32 = extractUuid32(row.dte_codigo_generacion, row.codigo_generacion);
        if (uuid32) {
            if (!bucket.firstAnyUuid) bucket.firstAnyUuid = uuid32;
            bucket.lastAnyUuid = uuid32;
            if (rawDoc !== '05') {
                if (!bucket.firstPrimaryUuid) bucket.firstPrimaryUuid = uuid32;
                bucket.lastPrimaryUuid = uuid32;
            }
        }

        const sign = rawDoc === '05' ? -1 : 1;

        if (groupDocType === '11') {
            const fexAmount = Math.abs(toNum(row.total_gravado))
                + Math.abs(toNum(row.total_exento))
                + Math.abs(toNum(row.total_nosujetas));

            if (Number(row.export_item_type) === 2) {
                bucket.expServicios += fexAmount;
            } else if (CA_COUNTRY_CODES.has(String(row.dest_country_code || '').trim().toUpperCase())) {
                bucket.expCA += fexAmount;
            } else {
                bucket.expFueraCA += fexAmount;
            }
        } else {
            bucket.exentas += sign * Math.abs(toNum(row.total_exento));
            bucket.noSujetas += sign * (
                Math.abs(toNum(row.total_nosujetas))
                + Math.abs(toNum(row.fovial))
                + Math.abs(toNum(row.cotrans))
            );
            // DGII Anexo 2 requires local taxed consumer sales to include 13% VAT
            bucket.gravadasLocales += sign * (
                Math.abs(toNum(row.total_gravado)) + Math.abs(toNum(row.total_iva))
            );
        }
    }

    return Array.from(groupMap.values()).map((g) => {
        const exentas = Math.max(0, round2(g.exentas));
        const noSujetas = Math.max(0, round2(g.noSujetas));
        const gravadasLocales = Math.max(0, round2(g.gravadasLocales));
        const expCA = Math.max(0, round2(g.expCA));
        const expFueraCA = Math.max(0, round2(g.expFueraCA));
        const expServicios = Math.max(0, round2(g.expServicios));
        const totalVentas = round2(
            exentas + noSujetas + gravadasLocales + expCA + expFueraCA + expServicios
        );

        return {
            dateStr: g.dateStr,
            groupDocType: g.groupDocType,
            firstUuid: g.firstPrimaryUuid || g.firstAnyUuid,
            lastUuid: g.lastPrimaryUuid || g.lastAnyUuid,
            exentas,
            noSujetas,
            gravadasLocales,
            expCA,
            expFueraCA,
            expServicios,
            totalVentas
        };
    });
}

/**
 * Generate MH Anexo 2 (Ventas a Consumidor Final) CSV content (23 columns, semicolon-delimited, no header, no BOM, CRLF).
 */
async function generateConsumersAnnexCsv({ companyId, branchId, year, month, tipoIngreso = '3' }) {
    const safeIncomeType = ALLOWED_TAXPAYER_INCOME_TYPES.includes(String(tipoIngreso))
        ? String(tipoIngreso)
        : '3';

    const rows = await fetchConsumersSalesRows({ companyId, branchId, year, month });
    const groups = groupConsumerRowsByDay(rows);

    const lines = groups.map((g) => {
        const hasTaxedOrExport = (g.gravadasLocales + g.expCA + g.expFueraCA + g.expServicios) > 0;
        const hasExemptOrNonSubject = (g.exentas + g.noSujetas) > 0;

        let tipoOperacion = '1';
        if (hasTaxedOrExport && hasExemptOrNonSubject) {
            tipoOperacion = '4';
        } else if (hasTaxedOrExport) {
            tipoOperacion = '1';
        } else if (hasExemptOrNonSubject) {
            tipoOperacion = '2';
        }

        return [
            g.dateStr,                       // 1. Fecha de emisión
            '4',                             // 2. Clase de documento (DTE)
            g.groupDocType,                  // 3. Tipo de documento (01 o 11)
            'N/A',                           // 4. Número de resolución
            'N/A',                           // 5. Serie de documento
            'N/A',                           // 6. Control interno (Del)
            'N/A',                           // 7. Control interno (Al)
            g.firstUuid,                     // 8. Número de documento (Del - UUID sin guiones)
            g.lastUuid,                      // 9. Número de documento (Al - UUID sin guiones)
            '',                              // 10. N° de máquina registradora
            g.exentas.toFixed(2),            // 11. Ventas exentas
            '0.00',                          // 12. Ventas internas exentas no sujetas a proporcionalidad
            g.noSujetas.toFixed(2),          // 13. Ventas no sujetas
            g.gravadasLocales.toFixed(2),    // 14. Ventas gravadas locales (IVA incluido)
            g.expCA.toFixed(2),              // 15. Exportaciones dentro de Centroamérica
            g.expFueraCA.toFixed(2),         // 16. Exportaciones fuera de Centroamérica
            g.expServicios.toFixed(2),       // 17. Exportaciones de servicios
            '0.00',                          // 18. Ventas a Zonas Francas y DPA
            '0.00',                          // 19. Ventas a cuenta de terceros no domiciliados
            g.totalVentas.toFixed(2),        // 20. Total ventas
            tipoOperacion,                   // 21. Tipo de operación (Renta)
            safeIncomeType,                  // 22. Tipo de ingreso (Renta)
            '2'                              // 23. Número de anexo
        ].join(';');
    });

    const paddedMonth = String(month).padStart(2, '0');
    return {
        csv: lines.join('\r\n'),
        count: groups.length,
        docs_count: rows.length,
        filename: `ANEXO_CONSUMIDOR_FINAL_${year}_${paddedMonth}.csv`
    };
}

function summarizeConsumers(rows) {
    const groups = groupConsumerRowsByDay(rows);
    const totals = groups.reduce((acc, g) => {
        acc.gravadas += g.gravadasLocales;
        acc.exentas_no_sujetas += g.exentas + g.noSujetas;
        acc.exportaciones += g.expCA + g.expFueraCA + g.expServicios;
        acc.total += g.totalVentas;
        return acc;
    }, { gravadas: 0, exentas_no_sujetas: 0, exportaciones: 0, total: 0 });

    return {
        count: groups.length,
        docs_count: rows.length,
        gravadas: round2(totals.gravadas),
        exentas_no_sujetas: round2(totals.exentas_no_sujetas),
        exportaciones: round2(totals.exportaciones),
        total: round2(totals.total)
    };
}

module.exports = {
    fetchTaxpayersSalesRows,
    generateTaxpayersAnnexCsv,
    summarizeTaxpayers,
    fetchConsumersSalesRows,
    generateConsumersAnnexCsv,
    summarizeConsumers
};
