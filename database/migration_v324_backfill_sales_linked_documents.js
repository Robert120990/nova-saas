const pool = require('../server/src/config/db');

function parseDocRelacionado(raw) {
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(parsed) ? parsed : [];
}

function normalizeDate(val) {
    if (!val) return null;
    const str = String(val).trim();
    const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}

async function migrate() {
    console.log('--- Migration v324: Backfill sales_linked_documents & idx_sales_linked_docs_doc_number ---');

    const [indexes] = await pool.query(
        "SHOW INDEX FROM sales_linked_documents WHERE Key_name = 'idx_sales_linked_docs_doc_number'"
    );
    if (indexes.length === 0) {
        await pool.query(
            'CREATE INDEX idx_sales_linked_docs_doc_number ON sales_linked_documents (doc_number)'
        );
        console.log('✅ Índice idx_sales_linked_docs_doc_number creado.');
    } else {
        console.log('ℹ️ Índice idx_sales_linked_docs_doc_number ya existe.');
    }

    const [rows] = await pool.query(`
        SELECT h.id AS sale_id,
               h.tipo_documento,
               COALESCE(
                   JSON_EXTRACT(d_c.json_original, '$.documentoRelacionado'),
                   JSON_EXTRACT(d_v.json_original, '$.documentoRelacionado')
               ) AS doc_rel_json
        FROM sales_headers h
        LEFT JOIN sales_linked_documents ld ON ld.sale_id = h.id
        LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
        LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
        WHERE h.tipo_documento IN ('05', '06', '07')
          AND ld.id IS NULL
    `);

    let inserted = 0;
    for (const row of rows) {
        const docs = parseDocRelacionado(row.doc_rel_json);
        for (const doc of docs) {
            const docNum = String(doc?.numeroDocumento || doc?.doc_number || '').trim().toUpperCase();
            if (!docNum) continue;
            const docType = String(doc?.tipoDocumento || doc?.doc_type || '').trim() || null;
            const emissionDate = normalizeDate(doc?.fechaEmision || doc?.emission_date);
            const genType = parseInt(doc?.tipoGeneracion ?? doc?.generation_type ?? (/^[0-9A-F-]{36}$/.test(docNum) ? 1 : 2), 10) || 1;

            await pool.query('INSERT INTO sales_linked_documents SET ?', [{
                sale_id: row.sale_id,
                doc_type: docType,
                doc_number: docNum,
                emission_date: emissionDate,
                generation_type: genType
            }]);
            inserted++;
        }
    }

    console.log(`✅ Backfill completado: ${inserted} vínculos insertados (revisados ${rows.length} registros sin fila previa).`);
}

module.exports = migrate;
