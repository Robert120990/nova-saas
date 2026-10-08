/**
 * Validador de unicidad y no duplicidad de documentos tributarios (DTE y físicos)
 * entre los módulos de Compras (purchase_headers) y Gastos Operativos (expense_headers).
 */
const pool = require('../config/db');

/**
 * Normaliza tipos de documentos equivalentes entre DTE (cat_002) y F-07 (Libro de Compras)
 */
function getEquivalentDocTypes(typeId, isExpense = false) {
    if (!typeId) return [];
    const t = String(typeId).trim().padStart(2, '0');
    // Crédito Fiscal (02 en F-07, 03 en DTE)
    if (t === '02' || t === '03') return ['02', '03'];
    // Factura (01 en F-07 y DTE)
    if (t === '01') return ['01'];
    // Nota de Crédito (09 en F-07, 05 en DTE)
    if (t === '09' || t === '05') return ['09', '05'];
    // Nota de Débito (08 en F-07, 06 en DTE)
    if (t === '08') return ['08', '06'];
    // Comprobante de Retención (06 en F-07, 07 en DTE)
    if (t === '07') return ['07', '06'];
    if (t === '06') {
        return isExpense ? ['06', '07'] : ['06', '08'];
    }
    return [t];
}

/**
 * Formatea ubicación (sucursal) y período contable del documento en conflicto
 */
function formatLocationInfo(row) {
    const branchPart = row.branch_name ? `en la sucursal "${row.branch_name}"` : 'en sucursal no especificada';

    let monthNum = row.period_month;
    let yearNum = row.period_year;
    if ((!monthNum || !yearNum) && row.fecha) {
        const d = new Date(row.fecha);
        if (!isNaN(d.getTime())) {
            monthNum = monthNum || (d.getUTCMonth() + 1);
            yearNum = yearNum || d.getUTCFullYear();
        }
    }

    const periodPart = (monthNum && yearNum)
        ? `período ${String(monthNum).padStart(2, '0')}/${yearNum}`
        : 'período no especificado';

    return `${branchPart}, ${periodPart}`;
}

async function queryTableDuplicate({
    connection,
    table, // 'purchase_headers' | 'expense_headers'
    companyId,
    provId,
    tipoDocTypes,
    cleanDoc,
    cleanCtrl,
    isDocPlaceholder,
    isCtrlPlaceholder,
    excludeId
}) {
    const ctrlCol = table === 'purchase_headers' ? 'numero_control' : 'num_control';

    const isDocUuid = Boolean(cleanDoc && (cleanDoc.length === 36 || /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(cleanDoc)));
    const isCtrlUuid = Boolean(cleanCtrl && (cleanCtrl.length === 36 || /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(cleanCtrl)));

    const uuidValues = [];
    if (isDocUuid) uuidValues.push(cleanDoc);
    if (isCtrlUuid && cleanCtrl !== cleanDoc) uuidValues.push(cleanCtrl);

    const regularNumbers = [];
    if (!isDocPlaceholder && !isDocUuid && cleanDoc) regularNumbers.push(cleanDoc);
    if (!isCtrlPlaceholder && !isCtrlUuid && cleanCtrl && !regularNumbers.includes(cleanCtrl)) {
        regularNumbers.push(cleanCtrl);
    }

    if (uuidValues.length === 0 && regularNumbers.length === 0) {
        return null;
    }

    let sql = `
        SELECT 
            t.id, 
            t.numero_documento, 
            t.${ctrlCol} AS ctrl_num,
            t.tipo_documento_id, 
            t.provider_id, 
            t.branch_id, 
            t.fecha, 
            t.period_year, 
            t.period_month, 
            t.status,
            br.nombre AS branch_name
        FROM ${table} t
        LEFT JOIN branches br ON t.branch_id = br.id
        WHERE t.company_id = ? AND t.status != 'ANULADO'
    `;
    const params = [companyId];

    if (excludeId) {
        sql += ` AND t.id != ?`;
        params.push(excludeId);
    }

    const matchClauses = [];

    // 1. Coincidencia por UUID DTE (código universal a nivel de empresa)
    for (const uuid of uuidValues) {
        matchClauses.push(`(t.numero_documento = ? OR (t.${ctrlCol} IS NOT NULL AND t.${ctrlCol} = ?))`);
        params.push(uuid, uuid);
    }

    // 2. Coincidencia por documento físico o número de control:
    // Obligatoriamente condicionado por PROVEEDOR (y tipo de documento)
    if (regularNumbers.length > 0 && provId) {
        let provClause = `(t.provider_id = ?`;
        params.push(provId);

        if (tipoDocTypes && tipoDocTypes.length > 0) {
            provClause += ` AND (t.tipo_documento_id IN (?) OR t.tipo_documento_id IS NULL)`;
            params.push(tipoDocTypes);
        }

        const numConditions = [];
        for (const num of regularNumbers) {
            numConditions.push(`(t.numero_documento = ? OR (t.${ctrlCol} IS NOT NULL AND t.${ctrlCol} = ?))`);
            params.push(num, num);
        }

        provClause += ` AND (${numConditions.join(' OR ')}))`;
        matchClauses.push(provClause);
    }

    if (matchClauses.length === 0) {
        return null;
    }

    sql += ` AND (${matchClauses.join(' OR ')}) LIMIT 1`;

    const [rows] = await connection.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

async function validateDocumentDuplicate({
    connection,
    companyId,
    providerId,
    tipoDocumentoId,
    numeroDocumento,
    numeroControl,
    excludeId = null,
    targetType // 'purchase' | 'expense'
}) {
    const cleanDoc = (numeroDocumento || '').trim().toUpperCase();
    const cleanCtrl = (numeroControl || '').trim().toUpperCase();

    const isDocPlaceholder = !cleanDoc || cleanDoc === 'S/N' || cleanDoc === 'SN' || cleanDoc === 'SIN NUMERO' || cleanDoc === 'S-N';
    const isCtrlPlaceholder = !cleanCtrl || cleanCtrl === 'S/N' || cleanCtrl === 'SN' || cleanCtrl === 'SIN NUMERO' || cleanCtrl === 'S-N';

    if (isDocPlaceholder && isCtrlPlaceholder) {
        return { isDuplicate: false };
    }

    const provId = providerId ? parseInt(providerId, 10) : null;
    const tipoDocTypes = getEquivalentDocTypes(tipoDocumentoId, targetType === 'expense');

    // 1. Si el objetivo es Registrar/Actualizar una COMPRA:
    if (targetType === 'purchase') {
        // A) Validar contra Gastos Operativos (expense_headers)
        const expMatch = await queryTableDuplicate({
            connection,
            table: 'expense_headers',
            companyId,
            provId,
            tipoDocTypes,
            cleanDoc,
            cleanCtrl,
            isDocPlaceholder,
            isCtrlPlaceholder,
            excludeId: null
        });

        if (expMatch) {
            const ctrlInfo = expMatch.ctrl_num ? `, Control: ${expMatch.ctrl_num}` : '';
            const locInfo = formatLocationInfo(expMatch);
            const msg = `El documento ya fue registrado como Gasto Operativo (Gasto #${expMatch.id}, Documento: ${expMatch.numero_documento}${ctrlInfo}) ${locInfo}. No se puede duplicar como Compra.`;
            return {
                isDuplicate: true,
                conflictType: 'expense',
                existingId: expMatch.id,
                branchName: expMatch.branch_name,
                periodYear: expMatch.period_year,
                periodMonth: expMatch.period_month,
                message: msg
            };
        }

        // B) Validar contra Compras previas (purchase_headers)
        const purMatch = await queryTableDuplicate({
            connection,
            table: 'purchase_headers',
            companyId,
            provId,
            tipoDocTypes,
            cleanDoc,
            cleanCtrl,
            isDocPlaceholder,
            isCtrlPlaceholder,
            excludeId
        });

        if (purMatch) {
            const ctrlInfo = purMatch.ctrl_num ? `, Control: ${purMatch.ctrl_num}` : '';
            const locInfo = formatLocationInfo(purMatch);
            const msg = `El documento ya fue registrado previamente en Compras (Compra #${purMatch.id}, Documento: ${purMatch.numero_documento}${ctrlInfo}) ${locInfo}.`;
            return {
                isDuplicate: true,
                conflictType: 'purchase',
                existingId: purMatch.id,
                branchName: purMatch.branch_name,
                periodYear: purMatch.period_year,
                periodMonth: purMatch.period_month,
                message: msg
            };
        }
    }

    // 2. Si el objetivo es Registrar/Actualizar un GASTO OPERATIVO:
    if (targetType === 'expense') {
        /* =========================================================================
         * [TEMPORAL - VALIDACIÓN DE DUPLICADOS EN GASTOS]
         * De momento, la validación en gastos solo verifica contra gastos (expense_headers)
         * y NO contra compras de inventario (purchase_headers).
         * Para reactivar la validación cruzada contra compras posteriormente:
         * 1) Descomenta el bloque "A) Validar contra Compras de Inventario" a continuación.
         * ========================================================================= */
        /*
        // A) Validar contra Compras de Inventario (purchase_headers)
        const purMatch = await queryTableDuplicate({
            connection,
            table: 'purchase_headers',
            companyId,
            provId,
            tipoDocTypes,
            cleanDoc,
            cleanCtrl,
            isDocPlaceholder,
            isCtrlPlaceholder,
            excludeId: null
        });

        if (purMatch) {
            const ctrlInfo = purMatch.ctrl_num ? `, Control: ${purMatch.ctrl_num}` : '';
            const locInfo = formatLocationInfo(purMatch);
            const msg = `El documento ya fue registrado como Compra de Inventario (Compra #${purMatch.id}, Documento: ${purMatch.numero_documento}${ctrlInfo}) ${locInfo}. No se puede registrar como Gasto.`;
            return {
                isDuplicate: true,
                conflictType: 'purchase',
                existingId: purMatch.id,
                branchName: purMatch.branch_name,
                periodYear: purMatch.period_year,
                periodMonth: purMatch.period_month,
                message: msg
            };
        }
        */

        // B) Validar contra Gastos previos (expense_headers)
        const expMatch = await queryTableDuplicate({
            connection,
            table: 'expense_headers',
            companyId,
            provId,
            tipoDocTypes,
            cleanDoc,
            cleanCtrl,
            isDocPlaceholder,
            isCtrlPlaceholder,
            excludeId
        });

        if (expMatch) {
            const ctrlInfo = expMatch.ctrl_num ? `, Control: ${expMatch.ctrl_num}` : '';
            const locInfo = formatLocationInfo(expMatch);
            const msg = `El documento ya fue registrado previamente en Gastos Operativos (Gasto #${expMatch.id}, Documento: ${expMatch.numero_documento}${ctrlInfo}) ${locInfo}.`;
            return {
                isDuplicate: true,
                conflictType: 'expense',
                existingId: expMatch.id,
                branchName: expMatch.branch_name,
                periodYear: expMatch.period_year,
                periodMonth: expMatch.period_month,
                message: msg
            };
        }
    }

    return { isDuplicate: false };
}

async function checkDocumentDuplicate(req, res) {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { provider_id, tipo_documento_id, numero_documento, numero_control, exclude_id, target_type } = req.query;

        if (!companyId) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        const result = await validateDocumentDuplicate({
            connection: pool,
            companyId,
            providerId: provider_id,
            tipoDocumentoId: tipo_documento_id,
            numeroDocumento: numero_documento,
            numeroControl: numero_control,
            excludeId: exclude_id,
            targetType: target_type || 'purchase'
        });

        return res.json(result);
    } catch (e) {
        console.error('[Document Validator] Error checking duplicate:', e);
        return res.status(500).json({ message: 'Error al verificar duplicado: ' + e.message });
    }
}

module.exports = {
    validateDocumentDuplicate,
    checkDocumentDuplicate
};
