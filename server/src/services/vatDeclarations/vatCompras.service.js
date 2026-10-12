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
 * Consulta de Libro de Compras para el Anexo de Declaraciones
 */
async function getComprasData({ companyId, branchId, year, month, search, limit, offset }) {
    // Configuración tributaria: compras afectan libro solo si está activo
    const [taxConfigRows] = await pool.query(
        'SELECT compras_afectan_libro_compras FROM tax_configurations WHERE company_id = ?',
        [companyId]
    );
    const comprasAfectanLibro = Boolean(taxConfigRows[0]?.compras_afectan_libro_compras);

    let pWhere = ['ph.company_id = ?', 'ph.period_year = ?', 'ph.period_month = ?', "ph.status != 'ANULADO'"];
    let pParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        pWhere.push('ph.branch_id = ?');
        pParams.push(branchId);
    }

    let eWhere = ['eh.company_id = ?', 'eh.period_year = ?', 'eh.period_month = ?', "(eh.status IS NULL OR eh.status != 'ANULADO')"];
    let eParams = [companyId, year, month];
    if (branchId && branchId !== 'all') {
        eWhere.push('eh.branch_id = ?');
        eParams.push(branchId);
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        pWhere.push('(p.nombre LIKE ? OR ph.numero_documento LIKE ? OR ph.codigo_generacion LIKE ? OR ph.numero_control LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ?)');
        pParams.push(s, s, s, s, s, s);

        eWhere.push('(p.nombre LIKE ? OR eh.numero_documento LIKE ? OR eh.codigo_generacion LIKE ? OR eh.num_control LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ?)');
        eParams.push(s, s, s, s, s, s);
    }

    let pRows = [];
    if (comprasAfectanLibro) {
        const [rows] = await pool.query(`
            SELECT 
                ph.id, ph.fecha, ph.branch_id, ph.tipo_documento_id,
                ph.numero_documento, ph.codigo_generacion, ph.numero_control, ph.documento_afectado,
                ph.total_nosujeta, ph.total_exenta, ph.total_gravada,
                0.00 AS gravadas_importaciones, 0.00 AS gravadas_internaciones,
                ph.iva, 0.00 AS iva_importaciones,
                ph.retencion, ph.percepcion, ph.fovial, ph.cotrans,
                0.00 AS anticipo_cuenta, ph.monto_total,
                p.nombre AS provider_nombre, p.nit AS provider_nit, p.nrc AS provider_nrc,
                b.nombre AS branch_name, cat.description AS tipo_doc_nombre,
                'compra' AS source_type
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
            eh.id, eh.fecha, eh.branch_id, eh.tipo_documento_id,
            eh.numero_documento, eh.codigo_generacion, eh.num_control AS numero_control, eh.documento_afectado,
            eh.total_nosujeta, eh.total_exenta, eh.total_gravada,
            COALESCE(eh.gravadas_importaciones, 0) AS gravadas_importaciones,
            COALESCE(eh.gravadas_internaciones, 0) AS gravadas_internaciones,
            eh.iva, COALESCE(eh.iva_importaciones, 0) AS iva_importaciones,
            eh.retencion, eh.percepcion, eh.fovial, eh.cotrans,
            COALESCE(eh.anticipo_cuenta, 0) AS anticipo_cuenta, eh.monto_total,
            p.nombre AS provider_nombre, p.nit AS provider_nit, p.nrc AS provider_nrc,
            b.nombre AS branch_name, cat.description AS tipo_doc_nombre,
            'gasto' AS source_type
        FROM expense_headers eh
        LEFT JOIN providers p ON eh.provider_id = p.id
        LEFT JOIN branches b ON eh.branch_id = b.id
        LEFT JOIN cat_002_tipo_dte cat ON eh.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code
        WHERE ${eWhere.join(' AND ')}
    `, eParams);

    const allRecords = [...pRows, ...eRows].sort((a, b) => {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        if (da !== db) return da - db;
        return a.id - b.id;
    });

    let totalGravada = 0;
    let totalExenta = 0;
    let totalNosujeta = 0;
    let totalIva = 0;
    let totalRetencion = 0;
    let totalPercepcion = 0;
    let totalAnticipo = 0;
    let totalCompras = 0;

    const formattedRecords = allRecords.map((r, idx) => {
        const isExpense = r.source_type === 'gasto';
        let esNC = false;
        let tipoNombre = '';
        const tId = String(r.tipo_documento_id || '').trim();

        if (isExpense) {
            switch (tId) {
                case '01': tipoNombre = 'Factura'; break;
                case '02': tipoNombre = 'Créd. Fiscal'; break;
                case '03': tipoNombre = 'Fact. Export.'; break;
                case '04': tipoNombre = 'Importación'; break;
                case '05': tipoNombre = 'Internación'; break;
                case '06': tipoNombre = 'Retención'; break;
                case '07': tipoNombre = 'Liquidación'; break;
                case '08': tipoNombre = 'Nota Débito'; break;
                case '09': tipoNombre = 'Nota Crédito'; esNC = true; break;
                case '14': tipoNombre = 'Suj. Excl.'; break;
                default: tipoNombre = tId ? `Doc. ${tId}` : 'Créd. Fiscal';
            }
        } else {
            const desc = String(r.tipo_doc_nombre || '').toLowerCase();
            esNC = tId === '05' || tId === '06' || desc.includes('nota de crédito') || desc.includes('nota de credito');
            if (esNC) tipoNombre = 'Nota Crédito';
            else if (tId === '01') tipoNombre = 'Factura';
            else if (tId === '04' || desc.includes('remisión') || desc.includes('remision')) tipoNombre = 'Nota Remisión';
            else if (tId === '06' || desc.includes('débito') || desc.includes('debito')) tipoNombre = 'Nota Débito';
            else if (tId === '07' || tId === '08' || desc.includes('retención') || desc.includes('retencion')) tipoNombre = 'Retención';
            else if (tId === '11' || tId === '14' || desc.includes('excluido')) tipoNombre = 'Suj. Excl.';
            else tipoNombre = 'Créd. Fiscal';
        }

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

        const sign = esNC ? -1 : 1;
        const gLoc = Math.abs(n(r.total_gravada));
        const gImp = Math.abs(n(r.gravadas_importaciones));
        const gInt = Math.abs(n(r.gravadas_internaciones));
        const g = gLoc + gImp + gInt;
        const e = Math.abs(n(r.total_exenta));
        const i = Math.abs(n(r.iva)) + Math.abs(n(r.iva_importaciones));
        const f = Math.abs(n(r.fovial));
        const c = Math.abs(n(r.cotrans));
        const ns = Math.abs(n(r.total_nosujeta)) + f + c;
        const ac = Math.abs(n(r.anticipo_cuenta));
        const ret = Math.abs(n(r.retencion));
        const per = Math.abs(n(r.percepcion));
        const to = g + e + i + ns;

        const valGravada = Math.round(sign * g * 100) / 100;
        const valExenta = Math.round(sign * e * 100) / 100;
        const valNosujeta = Math.round(sign * ns * 100) / 100;
        const valIva = Math.round(sign * i * 100) / 100;
        const valTotal = Math.round(sign * to * 100) / 100;

        totalGravada += valGravada;
        totalExenta += valExenta;
        totalNosujeta += valNosujeta;
        totalIva += valIva;
        totalRetencion += ret;
        totalPercepcion += per;
        totalAnticipo += ac;
        totalCompras += valTotal;

        return {
            corr: (offset || 0) + idx + 1,
            id: r.id,
            fecha: r.fecha,
            tipo_documento_id: tId,
            tipo_doc_nombre: tipoNombre,
            numero_documento: numDoc || 'S/N',
            codigo_generacion: codGen,
            numero_control: numCtrl,
            documento_afectado: cleanStr(r.documento_afectado),
            proveedor_nombre: cleanStr(r.provider_nombre || 'PROVEEDOR VARIOS').toUpperCase(),
            proveedor_nit: cleanStr(r.provider_nit),
            proveedor_nrc: cleanStr(r.provider_nrc),
            branch_name: cleanStr(r.branch_name || 'CENTRAL'),
            total_exenta: valExenta,
            total_nosujeta: valNosujeta,
            total_gravada: valGravada,
            iva: valIva,
            retencion: ret,
            percepcion: per,
            anticipo_cuenta: ac,
            monto_total: valTotal,
            source_type: r.source_type
        };
    });

    const summary = {
        total_records: allRecords.length,
        total_gravada: Math.round(totalGravada * 100) / 100,
        total_exenta: Math.round(totalExenta * 100) / 100,
        total_nosujeta: Math.round(totalNosujeta * 100) / 100,
        total_iva: Math.round(totalIva * 100) / 100,
        total_retencion: Math.round(totalRetencion * 100) / 100,
        total_percepcion: Math.round(totalPercepcion * 100) / 100,
        total_anticipo: Math.round(totalAnticipo * 100) / 100,
        total_compras: Math.round(totalCompras * 100) / 100
    };

    let paged = formattedRecords;
    if (limit !== undefined && offset !== undefined) {
        const start = parseInt(offset, 10);
        const end = start + parseInt(limit, 10);
        paged = formattedRecords.slice(start, end);
    }

    return { items: paged, summary };
}

module.exports = {
    getComprasData
};
