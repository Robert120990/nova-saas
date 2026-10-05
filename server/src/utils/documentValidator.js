/**
 * Validador de unicidad y no duplicidad de documentos tributarios (DTE y físicos)
 * entre los módulos de Compras (purchase_headers) y Gastos Operativos (expense_headers).
 */
const pool = require('../config/db');

async function validateDocumentDuplicate({
    connection,
    companyId,
    providerId,
    numeroDocumento,
    numeroControl,
    excludeId = null,
    targetType // 'purchase' | 'expense'
}) {
    const cleanDoc = (numeroDocumento || '').trim().toUpperCase();
    const cleanCtrl = (numeroControl || '').trim().toUpperCase();

    // Comprobantes sin número o con comodín genérico (S/N, SN, etc.) no deben validar duplicidad por número
    const isDocPlaceholder = !cleanDoc || cleanDoc === 'S/N' || cleanDoc === 'SN' || cleanDoc === 'SIN NUMERO' || cleanDoc === 'S-N';

    if (isDocPlaceholder && !cleanCtrl) {
        return { isDuplicate: false };
    }

    const checkDoc = isDocPlaceholder ? '' : cleanDoc;
    const isDocDte = checkDoc.length === 36 || checkDoc.startsWith('DTE');
    const provId = providerId ? parseInt(providerId, 10) : null;

    // 1. Si el objetivo es Registrar/Actualizar una COMPRA:
    if (targetType === 'purchase') {
        // A) Validar contra Gastos Operativos (expense_headers)
        let expSql = `
            SELECT id, numero_documento, num_control, provider_id, fecha, status
            FROM expense_headers
            WHERE company_id = ? AND status != 'ANULADO'
              AND (
                (? != '' AND numero_documento = ? AND (? = 1 OR provider_id = ?))
                OR (? != '' AND num_control IS NOT NULL AND num_control != '' AND num_control = ?)
                OR (? != '' AND num_control IS NOT NULL AND num_control != '' AND num_control = ?)
                OR (? != '' AND numero_documento = ?)
              )
            LIMIT 1
        `;
        const expParams = [
            companyId,
            checkDoc, checkDoc, isDocDte ? 1 : 0, provId,
            cleanCtrl, cleanCtrl,
            checkDoc, checkDoc,
            cleanCtrl, cleanCtrl
        ];
        const [expRows] = await connection.query(expSql, expParams);

        if (expRows.length > 0) {
            const exp = expRows[0];
            const ctrlInfo = exp.num_control ? `, Control: ${exp.num_control}` : '';
            const msg = `El documento ya fue registrado como Gasto Operativo (Gasto #${exp.id}, Documento: ${exp.numero_documento}${ctrlInfo}). No se puede duplicar como Compra.`;
            return {
                isDuplicate: true,
                conflictType: 'expense',
                existingId: exp.id,
                message: msg
            };
        }

        // B) Validar contra Compras previas (purchase_headers)
        let purSql = `
            SELECT id, numero_documento, numero_control, provider_id, fecha, status
            FROM purchase_headers
            WHERE company_id = ? AND status != 'ANULADO'
        `;
        const purParams = [companyId];

        if (excludeId) {
            purSql += ` AND id != ?`;
            purParams.push(excludeId);
        }

        purSql += `
              AND (
                (? != '' AND numero_documento = ? AND (? = 1 OR provider_id = ?))
                OR (? != '' AND numero_control IS NOT NULL AND numero_control != '' AND numero_control = ?)
                OR (? != '' AND numero_control IS NOT NULL AND numero_control != '' AND numero_control = ?)
                OR (? != '' AND numero_documento = ?)
              )
            LIMIT 1
        `;
        purParams.push(
            checkDoc, checkDoc, isDocDte ? 1 : 0, provId,
            cleanCtrl, cleanCtrl,
            checkDoc, checkDoc,
            cleanCtrl, cleanCtrl
        );

        const [purRows] = await connection.query(purSql, purParams);
        if (purRows.length > 0) {
            const pur = purRows[0];
            const ctrlInfo = pur.numero_control ? `, Control: ${pur.numero_control}` : '';
            const msg = `El documento ya fue registrado previamente en Compras (Compra #${pur.id}, Documento: ${pur.numero_documento}${ctrlInfo}).`;
            return {
                isDuplicate: true,
                conflictType: 'purchase',
                existingId: pur.id,
                message: msg
            };
        }
    }

    // 2. Si el objetivo es Registrar/Actualizar un GASTO OPERATIVO:
    if (targetType === 'expense') {
        // A) Validar contra Compras de Inventario (purchase_headers)
        let purSql = `
            SELECT id, numero_documento, numero_control, provider_id, fecha, status
            FROM purchase_headers
            WHERE company_id = ? AND status != 'ANULADO'
              AND (
                (? != '' AND numero_documento = ? AND (? = 1 OR provider_id = ?))
                OR (? != '' AND numero_control IS NOT NULL AND numero_control != '' AND numero_control = ?)
                OR (? != '' AND numero_control IS NOT NULL AND numero_control != '' AND numero_control = ?)
                OR (? != '' AND numero_documento = ?)
              )
            LIMIT 1
        `;
        const purParams = [
            companyId,
            checkDoc, checkDoc, isDocDte ? 1 : 0, provId,
            cleanCtrl, cleanCtrl,
            checkDoc, checkDoc,
            cleanCtrl, cleanCtrl
        ];
        const [purRows] = await connection.query(purSql, purParams);

        if (purRows.length > 0) {
            const pur = purRows[0];
            const ctrlInfo = pur.numero_control ? `, Control: ${pur.numero_control}` : '';
            const msg = `El documento ya fue registrado como Compra de Inventario (Compra #${pur.id}, Documento: ${pur.numero_documento}${ctrlInfo}). No se puede registrar como Gasto.`;
            return {
                isDuplicate: true,
                conflictType: 'purchase',
                existingId: pur.id,
                message: msg
            };
        }

        // B) Validar contra Gastos previas (expense_headers)
        let expSql = `
            SELECT id, numero_documento, num_control, provider_id, fecha, status
            FROM expense_headers
            WHERE company_id = ? AND status != 'ANULADO'
        `;
        const expParams = [companyId];

        if (excludeId) {
            expSql += ` AND id != ?`;
            expParams.push(excludeId);
        }

        expSql += `
              AND (
                (? != '' AND numero_documento = ? AND (? = 1 OR provider_id = ?))
                OR (? != '' AND num_control IS NOT NULL AND num_control != '' AND num_control = ?)
                OR (? != '' AND num_control IS NOT NULL AND num_control != '' AND num_control = ?)
                OR (? != '' AND numero_documento = ?)
              )
            LIMIT 1
        `;
        expParams.push(
            checkDoc, checkDoc, isDocDte ? 1 : 0, provId,
            cleanCtrl, cleanCtrl,
            checkDoc, checkDoc,
            cleanCtrl, cleanCtrl
        );

        const [expRows] = await connection.query(expSql, expParams);
        if (expRows.length > 0) {
            const exp = expRows[0];
            const ctrlInfo = exp.num_control ? `, Control: ${exp.num_control}` : '';
            const msg = `El documento ya fue registrado previamente en Gastos Operativos (Gasto #${exp.id}, Documento: ${exp.numero_documento}${ctrlInfo}).`;
            return {
                isDuplicate: true,
                conflictType: 'expense',
                existingId: exp.id,
                message: msg
            };
        }
    }

    return { isDuplicate: false };
}

async function checkDocumentDuplicate(req, res) {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { provider_id, numero_documento, numero_control, exclude_id, target_type } = req.query;

        if (!companyId) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        const result = await validateDocumentDuplicate({
            connection: pool,
            companyId,
            providerId: provider_id,
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
