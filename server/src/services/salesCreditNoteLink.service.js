const pool = require('../config/db');

const normalizeDocKey = (val) => String(val || '').trim().toUpperCase();

function parseDocRelacionado(raw) {
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((doc) => ({
            doc_type: String(doc?.tipoDocumento || doc?.doc_type || '').trim() || null,
            doc_number: normalizeDocKey(doc?.numeroDocumento || doc?.doc_number),
            emission_date: doc?.fechaEmision || doc?.emission_date || null,
            generation_type: doc?.tipoGeneracion ?? doc?.generation_type ?? null
        }))
        .filter(d => Boolean(d.doc_number));
}

function addToBucket(map, key, item) {
    const k = normalizeDocKey(key);
    if (!k) return;
    const list = map.get(k);
    if (!list) {
        map.set(k, [item]);
        return;
    }
    if (!list.some(x => x.id === item.id)) {
        list.push(item);
    }
}

/**
 * Construye un mapa docKey -> Notas de Crédito válidas (activas y no anuladas/rechazadas)
 * leyendo tanto `sales_linked_documents` como `dtes.json_original -> $.documentoRelacionado`.
 */
async function getActiveCreditNotesMap(companyId) {
    const docMap = new Map();
    if (!companyId) return docMap;

    const [ncRows] = await pool.query(
        `SELECT h.id,
                h.numero_control,
                h.codigo_generacion,
                h.fecha_emision,
                h.hora_emision,
                h.total_pagar,
                h.estado,
                COALESCE(d_c.status, d_v.status) AS dte_status,
                COALESCE(
                    JSON_EXTRACT(d_c.json_original, '$.documentoRelacionado'),
                    JSON_EXTRACT(d_v.json_original, '$.documentoRelacionado')
                ) AS doc_rel_json
         FROM sales_headers h
         LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
         LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
         WHERE h.company_id = ?
           AND (h.tipo_documento = '05' OR h.dte_type = '05')
           AND COALESCE(h.estado, '') NOT IN ('anulado', 'anulada', 'invalidado')
           AND COALESCE(d_c.status, d_v.status, 'ACCEPTED') NOT IN ('INVALIDADO', 'REJECTED', 'RECHAZADO')`,
        [companyId]
    );

    if (ncRows.length === 0) return docMap;

    const ncIds = ncRows.map(r => r.id);
    const [linkedRows] = await pool.query(
        'SELECT sale_id, doc_number FROM sales_linked_documents WHERE sale_id IN (?)',
        [ncIds]
    );

    const linkedBySaleId = new Map();
    for (const lr of linkedRows) {
        if (!linkedBySaleId.has(lr.sale_id)) linkedBySaleId.set(lr.sale_id, []);
        linkedBySaleId.get(lr.sale_id).push(lr.doc_number);
    }

    for (const nc of ncRows) {
        const ncSummary = {
            id: nc.id,
            numero_control: nc.numero_control || null,
            codigo_generacion: nc.codigo_generacion || null,
            fecha_emision: nc.fecha_emision,
            hora_emision: nc.hora_emision || null,
            total_pagar: parseFloat(nc.total_pagar) || 0,
            estado: nc.estado,
            dte_status: nc.dte_status || null
        };

        const tableKeys = linkedBySaleId.get(nc.id) || [];
        for (const k of tableKeys) {
            addToBucket(docMap, k, ncSummary);
        }

        const jsonDocs = parseDocRelacionado(nc.doc_rel_json);
        for (const jd of jsonDocs) {
            addToBucket(docMap, jd.doc_number, ncSummary);
        }
    }

    return docMap;
}

/**
 * Devuelve los IDs de `sales_headers` de la empresa que ya poseen al menos
 * una Nota de Crédito válida vinculada.
 */
async function getOriginalSaleIdsWithActiveNC(companyId) {
    const docMap = await getActiveCreditNotesMap(companyId);
    if (docMap.size === 0) return [];

    const allKeys = Array.from(docMap.keys());
    const numericIds = allKeys
        .filter(k => /^\d+$/.test(k))
        .map(k => parseInt(k, 10))
        .filter(n => Number.isFinite(n) && n > 0);

    const conditions = [
        'h.codigo_generacion IN (?)',
        'h.numero_control IN (?)',
        'd_c.numero_control IN (?)',
        'd_v.numero_control IN (?)'
    ];
    const params = [companyId, allKeys, allKeys, allKeys, allKeys];
    if (numericIds.length > 0) {
        conditions.push('h.id IN (?)');
        params.push(numericIds);
    }

    const [matched] = await pool.query(
        `SELECT DISTINCT h.id
         FROM sales_headers h
         LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
         LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
         WHERE h.company_id = ?
           AND (${conditions.join(' OR ')})`,
        params
    );

    return matched.map(m => m.id);
}

/**
 * Resuelve en lote los documentos originales referenciados por filas NC/ND/Retención ('05','06','07').
 */
async function resolveReferencedDocumentsBySale(rows, companyId) {
    const result = new Map();
    const targetRows = (Array.isArray(rows) ? rows : []).filter(
        r => ['05', '06', '07'].includes(String(r.tipo_documento || r.dte_type || ''))
    );
    if (targetRows.length === 0 || !companyId) return result;

    const saleIds = targetRows.map(r => r.id);
    const [linkedRows] = await pool.query(
        'SELECT sale_id, doc_type, doc_number, emission_date, generation_type FROM sales_linked_documents WHERE sale_id IN (?) ORDER BY id ASC',
        [saleIds]
    );
    const [dteRows] = await pool.query(
        `SELECT h.id AS sale_id,
                COALESCE(
                    JSON_EXTRACT(d_c.json_original, '$.documentoRelacionado'),
                    JSON_EXTRACT(d_v.json_original, '$.documentoRelacionado')
                ) AS doc_rel_json
         FROM sales_headers h
         LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
         LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
         WHERE h.id IN (?) AND h.company_id = ?`,
        [saleIds, companyId]
    );

    const docsBySaleId = new Map();
    const allLookupKeys = new Set();

    for (const lr of linkedRows) {
        const key = normalizeDocKey(lr.doc_number);
        if (!key) continue;
        if (!docsBySaleId.has(lr.sale_id)) docsBySaleId.set(lr.sale_id, []);
        const list = docsBySaleId.get(lr.sale_id);
        if (!list.some(x => x.doc_number === key)) {
            list.push({
                doc_type: lr.doc_type || null,
                doc_number: key,
                emission_date: lr.emission_date || null,
                generation_type: lr.generation_type || null
            });
            allLookupKeys.add(key);
        }
    }

    for (const dr of dteRows) {
        const parsed = parseDocRelacionado(dr.doc_rel_json);
        if (parsed.length === 0) continue;
        if (!docsBySaleId.has(dr.sale_id)) docsBySaleId.set(dr.sale_id, []);
        const list = docsBySaleId.get(dr.sale_id);
        for (const jd of parsed) {
            if (!list.some(x => x.doc_number === jd.doc_number)) {
                list.push(jd);
                allLookupKeys.add(jd.doc_number);
            }
        }
    }

    const origByKey = new Map();
    if (allLookupKeys.size > 0) {
        const keysArr = Array.from(allLookupKeys);
        const [origRows] = await pool.query(
            `SELECT h.id, h.tipo_documento, h.numero_control, h.codigo_generacion, h.fecha_emision, h.total_pagar, h.estado,
                    COALESCE(d_c.status, d_v.status) AS dte_status
             FROM sales_headers h
             LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
             LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
             WHERE h.company_id = ?
               AND (h.codigo_generacion IN (?) OR h.numero_control IN (?))`,
            [companyId, keysArr, keysArr]
        );
        for (const orig of origRows) {
            if (orig.codigo_generacion) origByKey.set(normalizeDocKey(orig.codigo_generacion), orig);
            if (orig.numero_control) origByKey.set(normalizeDocKey(orig.numero_control), orig);
        }
    }

    for (const row of targetRows) {
        const refs = docsBySaleId.get(row.id) || [];
        result.set(
            row.id,
            refs.map((ref) => {
                const orig = origByKey.get(ref.doc_number) || null;
                return {
                    doc_type: ref.doc_type,
                    doc_number: ref.doc_number,
                    emission_date: ref.emission_date,
                    original_sale_id: orig?.id || null,
                    original_tipo_documento: orig?.tipo_documento || ref.doc_type || null,
                    original_numero_control: orig?.numero_control || null,
                    original_codigo_generacion: orig?.codigo_generacion || null,
                    original_fecha_emision: orig?.fecha_emision || ref.emission_date || null,
                    original_total_pagar: orig ? (parseFloat(orig.total_pagar) || 0) : null,
                    original_estado: orig?.estado || null,
                    original_dte_status: orig?.dte_status || null
                };
            })
        );
    }

    return result;
}

/**
 * Enriquece un arreglo de ventas con:
 * - credit_notes, has_credit_note, credit_note_count, credit_note_total, is_fully_credited
 * - referenced_documents (para Notas de Crédito / Retención)
 */
async function enrichSalesWithCreditNoteInfo(rows, companyId) {
    if (!Array.isArray(rows) || rows.length === 0 || !companyId) return rows;

    const [activeNcMap, refsBySaleId] = await Promise.all([
        getActiveCreditNotesMap(companyId),
        resolveReferencedDocumentsBySale(rows, companyId)
    ]);

    for (const row of rows) {
        const isNC = String(row.tipo_documento || row.dte_type || '') === '05';
        let creditNotes = [];

        if (!isNC && activeNcMap.size > 0) {
            const seenIds = new Set();
            const keys = [
                row.codigo_generacion,
                row.numero_control,
                row.dte_control,
                row.id != null ? String(row.id) : null
            ];
            for (const key of keys) {
                const bucket = activeNcMap.get(normalizeDocKey(key));
                if (!bucket) continue;
                for (const nc of bucket) {
                    if (!seenIds.has(nc.id)) {
                        seenIds.add(nc.id);
                        creditNotes.push(nc);
                    }
                }
            }
            creditNotes.sort((a, b) => {
                const da = `${String(a.fecha_emision || '').slice(0, 10)}T${a.hora_emision || '00:00:00'}`;
                const db = `${String(b.fecha_emision || '').slice(0, 10)}T${b.hora_emision || '00:00:00'}`;
                return db.localeCompare(da) || (b.id - a.id);
            });
        }

        const creditNoteTotal = Math.round(
            creditNotes.reduce((sum, nc) => sum + (parseFloat(nc.total_pagar) || 0), 0) * 100
        ) / 100;
        const saleTotal = parseFloat(row.total_pagar) || 0;

        row.credit_notes = creditNotes;
        row.has_credit_note = creditNotes.length > 0;
        row.credit_note_count = creditNotes.length;
        row.credit_note_total = creditNoteTotal;
        row.is_fully_credited = creditNotes.length > 0 && creditNoteTotal >= (saleTotal - 0.01);
        row.referenced_documents = refsBySaleId.get(row.id) || [];
    }

    return rows;
}

module.exports = {
    getActiveCreditNotesMap,
    getOriginalSaleIdsWithActiveNC,
    enrichSalesWithCreditNoteInfo
};
