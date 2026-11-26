const pool = require('../../config/db');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const {
    EXPENSE_TO_MH_DOC_MAP,
    PURCHASE_ALLOWED_MH_DOCS,
    toNum,
    round2,
    fmtAmount,
    stripHyphens,
    cleanDocId,
    cleanCsvText,
    formatMhDate,
    extractUuid32,
    isDateAfterPeriodEnd,
    getLastDayOfPeriodFormatted,
    isComprasEnabled,
    safeJsonParse,
    resolveIdentityDoc,
    resolveNonPlaceholderDoc
} = require('./anexosHelpers');

/**
 * Fetch purchase and expense documents valid for MH Anexo 3 (Compras).
 */
async function fetchPurchasesRows({ companyId, branchId, year, month }) {
    const comprasAfectanLibro = await isComprasEnabled(companyId);

    let purchaseRows = [];
    if (comprasAfectanLibro) {
        const pWhere = [
            'ph.company_id = ?',
            'ph.period_year = ?',
            'ph.period_month = ?',
            "ph.status != 'ANULADO'"
        ];
        const pParams = [companyId, year, month];
        if (branchId && branchId !== 'all') {
            pWhere.push('ph.branch_id = ?');
            pParams.push(branchId);
        }

        const [pRows] = await pool.query(`
            SELECT
                ph.id,
                ph.fecha,
                ph.tipo_documento_id,
                ph.numero_documento,
                ph.codigo_generacion,
                ph.numero_control,
                ph.sello_recepcion,
                ph.total_nosujeta,
                ph.total_exenta,
                ph.total_gravada,
                0.00 AS gravadas_importaciones,
                0.00 AS gravadas_internaciones,
                ph.iva,
                0.00 AS iva_importaciones,
                ph.fovial,
                ph.cotrans,
                p.nombre AS provider_nombre,
                p.nit AS provider_nit,
                p.nrc AS provider_nrc,
                '1' AS tipo_operacion,
                '1' AS tipo_clasificacion,
                '2' AS tipo_sector,
                '5' AS tipo_costo,
                'compra' AS source_type
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            WHERE ${pWhere.join(' AND ')}
        `, pParams);

        purchaseRows = pRows
            .map((row) => ({
                ...row,
                mh_tipo_doc: String(row.tipo_documento_id || '').trim().padStart(2, '0')
            }))
            .filter((row) => PURCHASE_ALLOWED_MH_DOCS.has(row.mh_tipo_doc));
    }

    const eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
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
            eh.total_nosujeta,
            eh.total_exenta,
            eh.total_gravada,
            COALESCE(eh.gravadas_importaciones, 0) AS gravadas_importaciones,
            COALESCE(eh.gravadas_internaciones, 0) AS gravadas_internaciones,
            eh.iva,
            COALESCE(eh.iva_importaciones, 0) AS iva_importaciones,
            eh.fovial,
            eh.cotrans,
            p.nombre AS provider_nombre,
            p.nit AS provider_nit,
            p.nrc AS provider_nrc,
            eh.tipo_operacion,
            eh.tipo_clasificacion,
            eh.tipo_sector,
            eh.tipo_costo,
            'gasto' AS source_type
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    const expenseRows = eRows
        .map((row) => {
            const rawDoc = String(row.tipo_documento_id || '').trim().padStart(2, '0');
            return {
                ...row,
                mh_tipo_doc: EXPENSE_TO_MH_DOC_MAP[rawDoc] || null
            };
        })
        .filter((row) => Boolean(row.mh_tipo_doc));

    return [...purchaseRows, ...expenseRows].sort((a, b) => {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        if (da !== db) return da - db;
        return a.id - b.id;
    });
}

/**
 * Generate MH Anexo 3 (Compras) CSV content (21 columns, semicolon-delimited, no header, no BOM, CRLF).
 */
async function generatePurchasesAnnexCsv({
    companyId,
    branchId,
    year,
    month,
    clampFutureDates = false,
    overrideF07 = false,
    tipoOperacion,
    tipoClasificacion,
    tipoSector,
    tipoCosto
}) {
    const rows = await fetchPurchasesRows({ companyId, branchId, year, month });
    const periodLastDay = getLastDayOfPeriodFormatted(year, month);

    const lines = rows.map((row) => {
        const shouldClamp = Boolean(clampFutureDates) && isDateAfterPeriodEnd(row.fecha, year, month);
        const dateStr = shouldClamp ? periodLastDay : formatMhDate(row.fecha);

        const uuid32 = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control);
        const isDte = Boolean(uuid32)
            || /^DTE-/i.test(String(row.numero_control || '').trim())
            || Boolean(String(row.sello_recepcion || '').trim());

        let docClass = '1';
        if (isDte) {
            docClass = '4';
        } else if (row.mh_tipo_doc === '12' || row.mh_tipo_doc === '13') {
            docClass = '3';
        }

        const docNumber = uuid32 || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);
        const providerId = cleanDocId(row.provider_nit) || cleanDocId(row.provider_nrc);

        const exentasNoSujetasInternas = Math.abs(toNum(row.total_exenta))
            + Math.abs(toNum(row.total_nosujeta))
            + Math.abs(toNum(row.fovial))
            + Math.abs(toNum(row.cotrans));
        const comprasInternasGravadas = Math.abs(toNum(row.total_gravada));
        const internacionesGravadas = Math.abs(toNum(row.gravadas_internaciones));
        const importacionesGravadasBienes = Math.abs(toNum(row.gravadas_importaciones));
        const creditoFiscal = Math.abs(toNum(row.iva)) + Math.abs(toNum(row.iva_importaciones));

        const totalCompras = exentasNoSujetasInternas
            + comprasInternasGravadas
            + internacionesGravadas
            + importacionesGravadasBienes
            + creditoFiscal;

        const opCode = (overrideF07 && tipoOperacion)
            ? String(tipoOperacion)
            : String(reportPdfHelper.extractF07Code(row.tipo_operacion, '1'));
        const clasifCode = (overrideF07 && tipoClasificacion)
            ? String(tipoClasificacion)
            : String(reportPdfHelper.extractF07Code(row.tipo_clasificacion, row.source_type === 'gasto' ? '2' : '1'));
        const sectorCode = (overrideF07 && tipoSector)
            ? String(tipoSector)
            : String(reportPdfHelper.extractF07Code(row.tipo_sector, '2'));
        const costoCode = (overrideF07 && tipoCosto)
            ? String(tipoCosto)
            : String(reportPdfHelper.extractF07Code(row.tipo_costo, '5'));

        return [
            dateStr,
            docClass,
            row.mh_tipo_doc,
            docNumber,
            providerId,
            cleanCsvText(row.provider_nombre || 'PROVEEDOR VARIOS'),
            exentasNoSujetasInternas.toFixed(2),
            fmtAmount(0),
            fmtAmount(0),
            comprasInternasGravadas.toFixed(2),
            internacionesGravadas.toFixed(2),
            importacionesGravadasBienes.toFixed(2),
            fmtAmount(0),
            creditoFiscal.toFixed(2),
            totalCompras.toFixed(2),
            '',
            opCode,
            clasifCode,
            sectorCode,
            costoCode,
            '3'
        ].join(';');
    });

    const paddedMonth = String(month).padStart(2, '0');
    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_COMPRAS_${year}_${paddedMonth}.csv`
    };
}

function summarizePurchases(rows, year, month) {
    const totals = rows.reduce((acc, row) => {
        const sign = row.mh_tipo_doc === '05' ? -1 : 1;
        const grav = sign * (
            Math.abs(toNum(row.total_gravada))
            + Math.abs(toNum(row.gravadas_internaciones))
            + Math.abs(toNum(row.gravadas_importaciones))
        );
        const exeNs = sign * (
            Math.abs(toNum(row.total_exenta))
            + Math.abs(toNum(row.total_nosujeta))
            + Math.abs(toNum(row.fovial))
            + Math.abs(toNum(row.cotrans))
        );
        const iva = sign * (Math.abs(toNum(row.iva)) + Math.abs(toNum(row.iva_importaciones)));

        acc.count += 1;
        acc.gravadas += grav;
        acc.exentas_no_sujetas += exeNs;
        acc.credito_fiscal += iva;
        acc.total += grav + exeNs + iva;
        if (isDateAfterPeriodEnd(row.fecha, year, month)) {
            acc.out_of_period_count += 1;
        }
        return acc;
    }, { count: 0, gravadas: 0, exentas_no_sujetas: 0, credito_fiscal: 0, total: 0, out_of_period_count: 0 });

    return {
        count: totals.count,
        gravadas: round2(totals.gravadas),
        exentas_no_sujetas: round2(totals.exentas_no_sujetas),
        credito_fiscal: round2(totals.credito_fiscal),
        total: round2(totals.total),
        out_of_period_count: totals.out_of_period_count
    };
}

/**
 * Fetch excluded subject purchases (Anexo 5: tipo_documento_id = '14' and standalone DTE-14).
 */
async function fetchExcludedSubjectsRows({ companyId, branchId, year, month }) {
    const comprasAfectanLibro = await isComprasEnabled(companyId);

    const eWhere = [
        'eh.company_id = ?',
        'eh.period_year = ?',
        'eh.period_month = ?',
        "eh.tipo_documento_id = '14'",
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
            eh.numero_documento,
            eh.codigo_generacion,
            eh.num_control AS numero_control,
            eh.sello_recepcion,
            eh.total_nosujeta,
            eh.total_exenta,
            eh.total_gravada,
            eh.retencion,
            eh.monto_total,
            eh.tipo_operacion,
            eh.tipo_clasificacion,
            eh.tipo_sector,
            eh.tipo_costo,
            p.nombre AS provider_nombre,
            p.nit AS provider_nit,
            p.tipo_documento AS provider_tipo_documento,
            p.numero_documento AS provider_numero_documento,
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
            "ph.tipo_documento_id = '14'",
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
                ph.numero_documento,
                ph.codigo_generacion,
                ph.numero_control,
                ph.sello_recepcion,
                ph.total_nosujeta,
                ph.total_exenta,
                ph.total_gravada,
                ph.retencion,
                ph.monto_total,
                '2' AS tipo_operacion,
                '1' AS tipo_clasificacion,
                '2' AS tipo_sector,
                '5' AS tipo_costo,
                p.nombre AS provider_nombre,
                p.nit AS provider_nit,
                p.tipo_documento AS provider_tipo_documento,
                p.numero_documento AS provider_numero_documento,
                'compra' AS source_type
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            WHERE ${pWhere.join(' AND ')}
        `, pParams);
        pRows = rows;
    }

    const seenUuids = new Set();
    const mappedBase = [...eRows, ...pRows].map((row) => {
        const uuid32 = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control);
        if (uuid32) seenUuids.add(uuid32);

        const componentSum = Math.abs(toNum(row.total_gravada))
            + Math.abs(toNum(row.total_exenta))
            + Math.abs(toNum(row.total_nosujeta));
        const montoOperacion = componentSum > 0 ? componentSum : Math.abs(toNum(row.monto_total));

        return {
            id: row.id,
            fecha: row.fecha,
            codigo_generacion: row.codigo_generacion,
            numero_documento: row.numero_documento,
            numero_control: row.numero_control,
            sello_recepcion: row.sello_recepcion,
            provider_nombre: row.provider_nombre,
            provider_nit: row.provider_nit,
            provider_tipo_documento: row.provider_tipo_documento,
            provider_numero_documento: row.provider_numero_documento,
            monto_operacion: montoOperacion,
            retencion_iva: Math.abs(toNum(row.retencion)),
            tipo_operacion: row.tipo_operacion || '2',
            tipo_clasificacion: row.tipo_clasificacion || (row.source_type === 'gasto' ? '2' : '1'),
            tipo_sector: row.tipo_sector || '2',
            tipo_costo: row.tipo_costo || '5'
        };
    });

    // Include standalone DTE-14 records not already captured in expense/purchase headers
    const dWhere = [
        "d.tipo_dte = '14'",
        'd.company_id = ?',
        "d.status NOT IN ('REJECTED', 'ERROR', 'INVALIDADO')",
        "(d.ambiente IS NULL OR d.ambiente = '01')",
        "YEAR(COALESCE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.identificacion.fecEmi')), '%Y-%m-%d'), DATE(d.created_at))) = ?",
        "MONTH(COALESCE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.identificacion.fecEmi')), '%Y-%m-%d'), DATE(d.created_at))) = ?"
    ];
    const dParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        dWhere.push('d.branch_id = ?');
        dParams.push(branchId);
    }

    const [dteRows] = await pool.query(`
        SELECT
            d.id,
            COALESCE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.identificacion.fecEmi')), '%Y-%m-%d'), DATE(d.created_at)) AS fecha,
            d.codigo_generacion,
            d.numero_control,
            d.sello_recepcion,
            d.json_original
        FROM dtes d
        WHERE ${dWhere.join(' AND ')}
    `, dParams);

    const standaloneDteRows = [];
    for (const d of dteRows) {
        const uuid32 = extractUuid32(d.codigo_generacion);
        if (uuid32 && seenUuids.has(uuid32)) continue;
        if (uuid32) seenUuids.add(uuid32);

        const json = safeJsonParse(d.json_original);
        const subject = json.sujetoExcluido || json.receptor || {};
        const summary = json.resumen || {};
        const montoOp = Math.abs(toNum(summary.totalCompra || summary.subTotal || summary.totalPagar));

        standaloneDteRows.push({
            id: d.id,
            fecha: d.fecha,
            codigo_generacion: d.codigo_generacion,
            numero_documento: d.codigo_generacion,
            numero_control: d.numero_control,
            sello_recepcion: d.sello_recepcion || json.selloRecibido,
            provider_nombre: subject.nombre,
            provider_nit: subject.tipoDocumento === '36' ? subject.numDocumento : '',
            provider_tipo_documento: subject.tipoDocumento,
            provider_numero_documento: subject.numDocumento,
            monto_operacion: montoOp,
            retencion_iva: Math.abs(toNum(summary.ivaRete1)),
            tipo_operacion: '2',
            tipo_clasificacion: '2',
            tipo_sector: '2',
            tipo_costo: '5'
        });
    }

    return [...mappedBase, ...standaloneDteRows].sort((a, b) => {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        if (da !== db) return da - db;
        return a.id - b.id;
    });
}

/**
 * Generate MH Anexo 5 (Compras a Sujetos Excluidos) CSV content (13 columns, semicolon-delimited, no header, no BOM, CRLF).
 */
async function generateExcludedSubjectsAnnexCsv({
    companyId,
    branchId,
    year,
    month,
    overrideF07 = false,
    tipoOperacion,
    tipoClasificacion,
    tipoSector,
    tipoCosto
}) {
    const rows = await fetchExcludedSubjectsRows({ companyId, branchId, year, month });

    const lines = rows.map((row) => {
        const identity = resolveIdentityDoc(
            row.provider_nit,
            row.provider_numero_documento,
            row.provider_tipo_documento
        );
        const docNumber = extractUuid32(row.codigo_generacion, row.numero_documento, row.numero_control)
            || resolveNonPlaceholderDoc(row.numero_documento, row.numero_control);

        const opCode = (overrideF07 && tipoOperacion)
            ? String(tipoOperacion)
            : String(reportPdfHelper.extractF07Code(row.tipo_operacion, '2'));
        const clasifCode = (overrideF07 && tipoClasificacion)
            ? String(tipoClasificacion)
            : String(reportPdfHelper.extractF07Code(row.tipo_clasificacion, '2'));
        const sectorCode = (overrideF07 && tipoSector)
            ? String(tipoSector)
            : String(reportPdfHelper.extractF07Code(row.tipo_sector, '2'));
        const costoCode = (overrideF07 && tipoCosto)
            ? String(tipoCosto)
            : String(reportPdfHelper.extractF07Code(row.tipo_costo, '5'));

        return [
            identity.docType,                                          // 1. Tipo de documento (1=NIT, 2=DUI, 3=Otro)
            identity.docNumber,                                        // 2. Número de identificación sin guiones
            cleanCsvText(row.provider_nombre || 'SUJETO EXCLUIDO'),    // 3. Nombre o razón social
            formatMhDate(row.fecha),                                   // 4. Fecha de emisión
            stripHyphens(row.sello_recepcion),                         // 5. Serie / Sello de recepción
            docNumber,                                                 // 6. Número de documento / Código generación
            Math.abs(toNum(row.monto_operacion)).toFixed(2),           // 7. Monto de la operación
            Math.abs(toNum(row.retencion_iva)).toFixed(2),             // 8. Retención IVA 13%
            opCode,                                                    // 9. Tipo de operación (Renta)
            clasifCode,                                                // 10. Clasificación (Renta)
            sectorCode,                                                // 11. Sector (Renta)
            costoCode,                                                 // 12. Tipo de costo / gasto (Renta)
            '5'                                                        // 13. Número de anexo
        ].join(';');
    });

    const paddedMonth = String(month).padStart(2, '0');
    return {
        csv: lines.join('\r\n'),
        count: rows.length,
        filename: `ANEXO_SUJETOS_EXCLUIDOS_${year}_${paddedMonth}.csv`
    };
}

function summarizeExcludedSubjects(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.count += 1;
        acc.monto_operacion += Math.abs(toNum(row.monto_operacion));
        acc.retencion_iva += Math.abs(toNum(row.retencion_iva));
        return acc;
    }, { count: 0, monto_operacion: 0, retencion_iva: 0 });

    return {
        count: totals.count,
        monto_operacion: round2(totals.monto_operacion),
        retencion_iva: round2(totals.retencion_iva)
    };
}

module.exports = {
    fetchPurchasesRows,
    generatePurchasesAnnexCsv,
    summarizePurchases,
    fetchExcludedSubjectsRows,
    generateExcludedSubjectsAnnexCsv,
    summarizeExcludedSubjects
};
