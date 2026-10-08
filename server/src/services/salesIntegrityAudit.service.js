const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const salesIntegrityAuditPdfService = require('./salesIntegrityAuditPdf.service');

/**
 * Servicio de Auditoría Forense de Integridad, Realidad y Duplicidad de Ventas
 * Arquitectura modular de alto rendimiento optimizada para empresas con alto volumen de facturación (>50k DTEs).
 */

/**
 * Ejecuta el análisis forense de ventas para una empresa
 */
async function runSalesIntegrityAudit(companyId) {
    if (!companyId) throw new Error('company_id es requerido para la auditoría de ventas.');

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    // 1. Estadísticas generales agregadas (tiempo de respuesta < 2ms)
    const [[stats]] = await pool.query(`
        SELECT 
            COUNT(*) as total_ventas,
            COALESCE(SUM(CASE WHEN estado = 'emitido' THEN 1 ELSE 0 END), 0) as ventas_emitidas,
            COALESCE(SUM(CASE WHEN estado = 'invalidado' THEN 1 ELSE 0 END), 0) as ventas_invalidadas
        FROM sales_headers
        WHERE company_id = ?
    `, [companyId]);

    // 2. Ventas en 'emitido' sin sello de recepción local
    const [noSelloHeaders] = await pool.query(`
        SELECT 
            sh.id, sh.dte_type, sh.numero_control, sh.codigo_generacion, sh.total_pagar, 
            sh.estado, DATE(sh.fecha_emision) as fecha, sh.hora_emision, 
            COALESCE(sh.cliente_nombre, c.nombre, c.nombre_comercial, 'CLIENTE REGISTRADO') as cliente_nombre, 
            sh.customer_id, sh.observaciones
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        WHERE sh.company_id = ? 
          AND sh.estado = 'emitido' 
          AND (sh.sello_recepcion IS NULL OR TRIM(sh.sello_recepcion) = '')
        ORDER BY sh.id DESC
        LIMIT 100
    `, [companyId]);

    // Verificación en lote contra la tabla 'dtes'
    const codigosGen = noSelloHeaders.map(h => h.codigo_generacion).filter(Boolean);
    const dtesByCode = {};
    if (codigosGen.length > 0) {
        const [dtesRows] = await pool.query(`
            SELECT codigo_generacion, sello_recepcion, status
            FROM dtes
            WHERE company_id = ? AND codigo_generacion IN (?)
        `, [companyId, codigosGen]);
        for (const d of dtesRows) {
            dtesByCode[d.codigo_generacion] = d;
        }
    }

    const unsyncedStamps = [];
    const phantomsToMatch = [];

    for (const ns of noSelloHeaders) {
        const dteMatch = ns.codigo_generacion ? dtesByCode[ns.codigo_generacion] : null;
        const dteSello = dteMatch?.sello_recepcion;

        if (dteSello && String(dteSello).trim() !== '') {
            unsyncedStamps.push({
                id: ns.id,
                sale_id: ns.id,
                dte_type: ns.dte_type,
                numero_control: ns.numero_control,
                codigo_generacion: ns.codigo_generacion,
                cliente_nombre: ns.cliente_nombre,
                total_pagar: Number(ns.total_pagar || 0),
                fecha: ns.fecha instanceof Date ? ns.fecha.toISOString().slice(0, 10) : String(ns.fecha),
                hora: ns.hora_emision,
                hora_emision: ns.hora_emision,
                sello_encontrado: dteSello,
                dte_status: dteMatch?.status || 'RECEIVED'
            });
        } else {
            phantomsToMatch.push(ns);
        }
    }

    // Búsqueda en lote de reemplazos / gemelos para ventas fantasma
    const phantomSales = [];
    const custIds = Array.from(new Set(phantomsToMatch.map(p => p.customer_id).filter(Boolean)));
    const dates = Array.from(new Set(phantomsToMatch.map(p => p.fecha instanceof Date ? p.fecha.toISOString().slice(0, 10) : String(p.fecha))));

    let candidateTwins = [];
    if (custIds.length > 0 && dates.length > 0) {
        const [twins] = await pool.query(`
            SELECT id, customer_id, DATE(fecha_emision) as fecha, total_pagar, numero_control, sello_recepcion, hora_emision
            FROM sales_headers
            WHERE company_id = ?
              AND customer_id IN (?)
              AND DATE(fecha_emision) IN (?)
              AND estado = 'emitido'
              AND sello_recepcion IS NOT NULL 
              AND TRIM(sello_recepcion) != ''
        `, [companyId, custIds, dates]);
        candidateTwins = twins;
    }

    for (const ns of phantomsToMatch) {
        const nsFecha = ns.fecha instanceof Date ? ns.fecha.toISOString().slice(0, 10) : String(ns.fecha);
        const nsTotal = Number(ns.total_pagar || 0);

        const twin = candidateTwins.find(t => {
            if (t.id === ns.id) return false;
            if (t.customer_id !== ns.customer_id) return false;
            const tFecha = t.fecha instanceof Date ? t.fecha.toISOString().slice(0, 10) : String(t.fecha);
            if (tFecha !== nsFecha) return false;
            return Math.abs(Number(t.total_pagar || 0) - nsTotal) < 0.05;
        });

        const hasTwin = !!twin;
        phantomSales.push({
            id: ns.id,
            sale_id: ns.id,
            dte_type: ns.dte_type,
            numero_control: ns.numero_control,
            codigo_generacion: ns.codigo_generacion,
            cliente_nombre: ns.cliente_nombre,
            total_pagar: nsTotal,
            fecha: nsFecha,
            hora: ns.hora_emision,
            hora_emision: ns.hora_emision,
            reemplazo_sale_id: hasTwin ? twin.id : null,
            reemplazo_control: hasTwin ? twin.numero_control : null,
            reemplazo_hora: hasTwin ? twin.hora_emision : null,
            diagnostico: hasTwin
                ? `Re-facturada con timbre en Venta #${twin.id} (${twin.numero_control}) a las ${twin.hora_emision}. Venta local sin sello que debe anularse.`
                : `Venta en estado local 'emitido' sin sello de recepción ante Hacienda ni registro en tabla dtes. Requiere anulación o retransmisión.`,
            observaciones: ns.observaciones
        });
    }

    // 3. Duplicidad sospechosa en Hacienda (GROUP BY indexado de alta velocidad)
    const [duplicateGroups] = await pool.query(`
        SELECT 
            customer_id, DATE(fecha_emision) as fecha, total_pagar, COUNT(*) as cnt,
            GROUP_CONCAT(id ORDER BY id ASC) as sale_ids
        FROM sales_headers
        WHERE company_id = ? 
          AND estado = 'emitido' 
          AND sello_recepcion IS NOT NULL 
          AND TRIM(sello_recepcion) != ''
          AND customer_id IS NOT NULL
        GROUP BY customer_id, DATE(fecha_emision), total_pagar
        HAVING COUNT(*) > 1
        LIMIT 50
    `, [companyId]);

    const dupePairs = [];
    const dupeSaleIds = [];
    for (const g of duplicateGroups) {
        const ids = String(g.sale_ids).split(',').map(Number);
        for (let i = 0; i < ids.length - 1; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                dupePairs.push({ id1: ids[i], id2: ids[j] });
                dupeSaleIds.push(ids[i], ids[j]);
            }
        }
    }

    const uniqueDupeSaleIds = Array.from(new Set(dupeSaleIds));
    const salesById = {};
    const itemsBySale = {};

    if (uniqueDupeSaleIds.length > 0) {
        const [headers] = await pool.query(`
            SELECT 
                sh.id, sh.customer_id, 
                COALESCE(sh.cliente_nombre, c.nombre, c.nombre_comercial, 'CLIENTE REGISTRADO') as cliente_nombre,
                sh.total_pagar, sh.numero_control, sh.sello_recepcion,
                DATE(sh.fecha_emision) as fecha, sh.hora_emision, sh.observaciones
            FROM sales_headers sh
            LEFT JOIN customers c ON sh.customer_id = c.id
            WHERE sh.id IN (?)
        `, [uniqueDupeSaleIds]);
        for (const h of headers) {
            salesById[h.id] = h;
        }

        const [allItems] = await pool.query(
            'SELECT sale_id, descripcion, cantidad, precio_unitario FROM sales_items WHERE sale_id IN (?)',
            [uniqueDupeSaleIds]
        );
        for (const item of allItems) {
            if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
            itemsBySale[item.sale_id].push(item);
        }
    }

    const confirmedDuplicatesHacienda = [];
    const legitimateMultiBranchSales = [];

    for (const pair of dupePairs) {
        const s1 = salesById[pair.id1];
        const s2 = salesById[pair.id2];
        if (!s1 || !s2) continue;

        const it1 = itemsBySale[s1.id] || [];
        const it2 = itemsBySale[s2.id] || [];

        const lines1 = it1.map(i => i.descripcion.trim()).sort().join(' | ');
        const lines2 = it2.map(i => i.descripcion.trim()).sort().join(' | ');

        const sucursal1 = it1.find(i => /SUPER SELECTOS|CONSTITUCION|MASCOTA|ESCALON|SAN LUIS|MERLIOT|SANTA ROSA|RAMBLAS|PALMAS|JOYA|SANTOS|SAN GABRIEL|MEGA|ZACATECOLUCA|PLAZA MUNDO|LA CIMA|SONSONATE|OC:/i.test(i.descripcion))?.descripcion;
        const sucursal2 = it2.find(i => /SUPER SELECTOS|CONSTITUCION|MASCOTA|ESCALON|SAN LUIS|MERLIOT|SANTA ROSA|RAMBLAS|PALMAS|JOYA|SANTOS|SAN GABRIEL|MEGA|ZACATECOLUCA|PLAZA MUNDO|LA CIMA|SONSONATE|OC:/i.test(i.descripcion))?.descripcion;

        let diffMinutes = 0;
        try {
            const f1 = s1.fecha instanceof Date ? s1.fecha.toISOString().slice(0, 10) : String(s1.fecha);
            const f2 = s2.fecha instanceof Date ? s2.fecha.toISOString().slice(0, 10) : String(s2.fecha);
            const d1 = new Date(`${f1}T${s1.hora_emision || '00:00:00'}`);
            const d2 = new Date(`${f2}T${s2.hora_emision || '00:00:00'}`);
            diffMinutes = Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60));
        } catch (e) {
            diffMinutes = 0;
        }

        const info = {
            id1: s1.id,
            control1: s1.numero_control,
            hora1: s1.hora_emision,
            sello1: s1.sello_recepcion,
            id2: s2.id,
            control2: s2.numero_control,
            hora2: s2.hora_emision,
            sello2: s2.sello_recepcion,
            diff_minutos: diffMinutes,
            cliente: s1.cliente_nombre,
            customer_id: s1.customer_id,
            fecha: s1.fecha instanceof Date ? s1.fecha.toISOString().slice(0, 10) : String(s1.fecha),
            monto: Number(s1.total_pagar || 0),
            items1: it1.map(i => `${i.cantidad} x ${i.descripcion}`).join(' ; '),
            items2: it2.map(i => `${i.cantidad} x ${i.descripcion}`).join(' ; '),
            sucursal1: sucursal1 || 'Sin sucursal explícita',
            sucursal2: sucursal2 || 'Sin sucursal explícita'
        };

        if (lines1 !== lines2 && (sucursal1 || sucursal2)) {
            legitimateMultiBranchSales.push(info);
        } else {
            confirmedDuplicatesHacienda.push(info);
        }
    }

    // 4. Facturación automática de pedidos vs POS
    const [autoSales] = await pool.query(`
        SELECT 
            sh.id as sale_id, sh.dte_type, sh.numero_control, sh.codigo_generacion, 
            sh.sello_recepcion, sh.total_pagar, sh.estado, 
            COALESCE(sh.cliente_nombre, c.nombre, c.nombre_comercial, 'CLIENTE REGISTRADO') as cliente_nombre, 
            sh.customer_id, DATE(sh.fecha_emision) as fecha, sh.hora_emision, sh.observaciones,
            eco.id as order_id, eco.order_number, eco.product_type, eco.presentation, 
            eco.quantity_lbs, eco.price_per_lb, eco.status as order_status, eco.delivery_status
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        LEFT JOIN egg_customer_orders eco ON eco.sale_id = sh.id
        WHERE sh.company_id = ? AND sh.observaciones LIKE '%Facturación Automática%'
        ORDER BY sh.id
    `, [companyId]);

    const autoInvoicedAudit = [];
    const invalidatedAutoSales = autoSales.filter(a => a.estado === 'invalidado');
    const autoCustIds = Array.from(new Set(invalidatedAutoSales.map(a => a.customer_id)));

    let candidatePosSales = [];
    if (autoCustIds.length > 0) {
        const [reps] = await pool.query(`
            SELECT id, customer_id, numero_control, total_pagar, estado, DATE(fecha_emision) as fecha_emision, hora_emision
            FROM sales_headers
            WHERE company_id = ?
              AND customer_id IN (?)
              AND observaciones NOT LIKE '%Facturación Automática%'
              AND estado = 'emitido'
            ORDER BY id ASC
        `, [companyId, autoCustIds]);
        candidatePosSales = reps;
    }

    for (const a of autoSales) {
        let replacementSale = null;
        if (a.estado === 'invalidado') {
            const aDate = new Date(a.fecha).getTime();
            const rep = candidatePosSales.find(r => {
                if (r.customer_id !== a.customer_id) return false;
                if (r.id <= a.sale_id) return false;
                const rDate = new Date(r.fecha_emision).getTime();
                const diffDays = Math.abs(rDate - aDate) / (1000 * 60 * 60 * 24);
                return diffDays <= 2;
            });
            if (rep) {
                replacementSale = {
                    id: rep.id,
                    numero_control: rep.numero_control,
                    total: Number(rep.total_pagar || 0),
                    hora: rep.hora_emision
                };
            }
        }

        autoInvoicedAudit.push({
            sale_id: a.sale_id,
            dte_type: a.dte_type,
            numero_control: a.numero_control,
            estado: a.estado,
            total_pagar: Number(a.total_pagar || 0),
            cliente: a.cliente_nombre,
            fecha: a.fecha instanceof Date ? a.fecha.toISOString().slice(0, 10) : String(a.fecha),
            hora: a.hora_emision,
            order_id: a.order_id,
            order_number: a.order_number,
            product_type: a.product_type,
            presentation: a.presentation,
            quantity_lbs: a.quantity_lbs,
            has_replacement: !!replacementSale,
            replacement: replacementSale,
            observaciones: a.observaciones
        });
    }

    return {
        timestamp: new Date().toISOString(),
        company_id: companyId,
        empresa: company,
        resumen: {
            total_ventas: Number(stats?.total_ventas || 0),
            ventas_emitidas: Number(stats?.ventas_emitidas || 0),
            ventas_invalidadas: Number(stats?.ventas_invalidadas || 0),
            ventas_sin_sello_fantasma: phantomSales.length,
            sellos_desincronizados: unsyncedStamps.length,
            duplicados_sospechosos_hacienda: confirmedDuplicatesHacienda.length,
            ventas_multi_sucursal_legitimas: legitimateMultiBranchSales.length,
            ventas_automaticas_pedidos: autoSales.length,
            ventas_automaticas_invalidadas: autoSales.filter(a => a.estado === 'invalidado').length,
            ventas_automaticas_activas: autoSales.filter(a => a.estado === 'emitido').length
        },
        ventas_sin_sello_fantasma: phantomSales,
        sellos_desincronizados: unsyncedStamps,
        duplicados_sospechosos_hacienda: confirmedDuplicatesHacienda,
        auditoria_pedidos_automaticos: autoInvoicedAudit,
        ventas_multi_sucursal_legitimas: legitimateMultiBranchSales,
        hallazgos_criticos: {
            ventas_fantasma_locales: phantomSales,
            sellos_pendientes_sincronizar: unsyncedStamps,
            duplicidad_sospechosa_hacienda: confirmedDuplicatesHacienda,
            facturacion_automatica_pedidos: autoInvoicedAudit
        }
    };
}

/**
 * Sincroniza sellos confirmados desde la tabla `dtes` hacia `sales_headers`
 */
async function syncUnsyncedDteStamps(companyId) {
    if (!companyId) throw new Error('company_id es requerido.');

    const [rows] = await pool.query(`
        SELECT sh.id as sale_id, d.sello_recepcion, d.fh_procesamiento
        FROM sales_headers sh
        JOIN dtes d ON d.codigo_generacion = sh.codigo_generacion AND d.company_id = sh.company_id
        WHERE sh.company_id = ?
          AND (sh.sello_recepcion IS NULL OR TRIM(sh.sello_recepcion) = '')
          AND d.sello_recepcion IS NOT NULL 
          AND TRIM(d.sello_recepcion) != ''
    `, [companyId]);

    let updatedCount = 0;
    for (const r of rows) {
        await pool.query(`
            UPDATE sales_headers 
            SET sello_recepcion = ?, fh_procesamiento = COALESCE(fh_procesamiento, ?)
            WHERE id = ? AND company_id = ?
        `, [r.sello_recepcion, r.fh_procesamiento, r.sale_id, companyId]);
        updatedCount++;
    }

    return { 
        updatedCount, 
        updated_count: updatedCount, 
        synced_sales: rows.map(r => r.sale_id) 
    };
}

/**
 * Genera el Buffer PDF oficial delegando a salesIntegrityAuditPdf.service
 */
async function generateAuditPdfBuffer(companyId) {
    return salesIntegrityAuditPdfService.generateAuditPdfBuffer(companyId, runSalesIntegrityAudit);
}

module.exports = {
    runSalesIntegrityAudit,
    syncUnsyncedDteStamps,
    generateAuditPdfBuffer
};
