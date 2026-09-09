const pool = require('../config/db');
const nodemailer = require('nodemailer');
const { generateQuotationPdf } = require('../services/crmQuotationPdf.service');
const { generateQuotationDocx } = require('../services/crmQuotationDocx.service');

/**
 * Genera el correlativo anual de cotización para la empresa: COT-YYYY-0001
 */
async function generateNextQuoteNumber(companyId) {
    const year = new Date().getFullYear();
    const prefix = `COT-${year}-`;

    const [[row]] = await pool.query(
        `SELECT quote_number FROM crm_quotations 
         WHERE company_id = ? AND quote_number LIKE ? 
         ORDER BY id DESC LIMIT 1`,
        [companyId, `${prefix}%`]
    );

    let nextSeq = 1;
    if (row && row.quote_number) {
        const parts = row.quote_number.split('-');
        if (parts.length >= 3) {
            const seqNum = parseInt(parts[2], 10);
            if (!isNaN(seqNum)) nextSeq = seqNum + 1;
        }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// 1. Listar cotizaciones con filtros y KPIs
const getQuotations = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }

        const { search = '', status = '', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let whereClause = 'WHERE q.company_id = ?';
        const params = [companyId];

        if (status && status !== 'todos') {
            if (status === 'delicada') {
                whereClause += ' AND q.is_delicate = 1';
            } else {
                whereClause += ' AND q.status = ?';
                params.push(status);
            }
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause += ` AND (
                q.quote_number LIKE ? OR 
                q.customer_name LIKE ? OR 
                q.customer_contact LIKE ? OR 
                q.notes LIKE ?
            )`;
            params.push(term, term, term, term);
        }

        const countQuery = `SELECT COUNT(*) as total FROM crm_quotations q ${whereClause}`;
        const [[countResult]] = await pool.query(countQuery, params);
        const total = countResult?.total || 0;

        const dataQuery = `
            SELECT 
                q.*,
                (SELECT COUNT(*) FROM crm_quotation_items qi WHERE qi.quotation_id = q.id) as items_count,
                (SELECT GROUP_CONCAT(DISTINCT qi.product_name SEPARATOR ', ') FROM crm_quotation_items qi WHERE qi.quotation_id = q.id) as products_summary
            FROM crm_quotations q
            ${whereClause}
            ORDER BY q.date DESC, q.id DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.query(dataQuery, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

        // KPIs en vivo del mes
        const [[kpis]] = await pool.query(`
            SELECT 
                COUNT(*) as total_quotes,
                COALESCE(SUM(CASE WHEN status = 'aprobada' THEN 1 ELSE 0 END), 0) as approved_quotes,
                COALESCE(SUM(CASE WHEN is_delicate = 1 THEN 1 ELSE 0 END), 0) as delicate_quotes,
                COALESCE(SUM(total), 0) as total_quoted_amount,
                COALESCE(AVG(overall_margin_pct), 0) as avg_margin_pct
            FROM crm_quotations
            WHERE company_id = ? AND MONTH(date) = MONTH(CURRENT_DATE()) AND YEAR(date) = YEAR(CURRENT_DATE())
        `, [companyId]);

        res.json({
            data: rows,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / parseInt(limit, 10)),
            kpis: kpis || {
                total_quotes: 0,
                approved_quotes: 0,
                delicate_quotes: 0,
                total_quoted_amount: 0,
                avg_margin_pct: 0
            }
        });
    } catch (err) {
        console.error('Error al listar cotizaciones:', err);
        res.status(500).json({ message: 'Error interno al consultar cotizaciones.' });
    }
};

// 2. Obtener detalle de una cotización
const getQuotationById = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [[quotation]] = await pool.query(
            `SELECT q.*, c.nit as customer_nit_cat, c.nrc as customer_nrc_cat, c.telefono as customer_phone_cat
             FROM crm_quotations q
             LEFT JOIN customers c ON q.customer_id = c.id
             WHERE q.id = ? AND q.company_id = ?`,
            [id, companyId]
        );

        if (!quotation) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const [items] = await pool.query(
            `SELECT * FROM crm_quotation_items WHERE quotation_id = ? ORDER BY id ASC`,
            [id]
        );

        res.json({
            ...quotation,
            items
        });
    } catch (err) {
        console.error('Error al obtener cotización:', err);
        res.status(500).json({ message: 'Error interno al obtener detalle de la cotización.' });
    }
};

// 3. Crear nueva cotización con validación de márgenes y detección de "delicada"
const createQuotation = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }

        const {
            customer_id,
            customer_name,
            customer_contact,
            customer_email,
            customer_phone,
            customer_address,
            customer_nrc,
            customer_nit,
            date,
            validity_days = 30,
            payment_terms = 'Contado',
            delivery_time = 'Entrega inmediata / según programación',
            our_commitments,
            notes,
            signature_data,
            signature_author_name,
            signature_author_title,
            signature_author_phone,
            delicate_reason,
            items = []
        } = req.body;

        if (!customer_name || !items || items.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Nombre de cliente e ítems son requeridos.' });
        }

        const quote_number = await generateNextQuoteNumber(companyId);

        // Calcular fecha de caducidad automática
        const issueDate = date ? new Date(date) : new Date();
        const expDate = new Date(issueDate);
        expDate.setDate(expDate.getDate() + parseInt(validity_days, 10));
        const expiration_date = expDate.toISOString().split('T')[0];

        // Procesar ítems y calcular costos/márgenes
        let subtotal = 0;
        let totalCost = 0;
        let hasDelicateItem = false;

        const processedItems = items.map(it => {
            const qty = parseFloat(it.quantity) || 1;
            const price = parseFloat(it.unit_price) || 0;
            const cost = parseFloat(it.current_cost) || 0;
            const discount = parseFloat(it.discount_amount) || 0;

            const itemSubtotal = (qty * price) - discount;
            const itemTotalCost = qty * cost;

            // Margen comercial: ((Precio - Costo) / Precio) * 100
            let marginPct = 0;
            if (price > 0) {
                marginPct = ((price - cost) / price) * 100;
            }

            // Alerta delicada: si el precio es menor o igual al costo, o margen < 15%
            const isDelicate = price <= cost || marginPct < 15;
            if (isDelicate) hasDelicateItem = true;

            subtotal += itemSubtotal;
            totalCost += itemTotalCost;

            return {
                product_id: it.product_id || null,
                product_code: it.product_code || null,
                product_name: it.product_name || 'Producto',
                presentation: it.presentation || 'Estándar',
                quantity: qty,
                unit_measure: it.unit_measure || 'LB',
                current_cost: cost,
                unit_price: price,
                suggested_price: it.suggested_price ? parseFloat(it.suggested_price) : null,
                margin_pct: marginPct,
                is_delicate: isDelicate ? 1 : 0,
                discount_amount: discount,
                notes: it.notes || null,
                subtotal: itemSubtotal,
                total: itemSubtotal
            };
        });

        const taxAmount = subtotal * 0.13; // 13% IVA
        const total = subtotal + taxAmount;

        let overallMarginPct = 0;
        if (subtotal > 0) {
            overallMarginPct = ((subtotal - totalCost) / subtotal) * 100;
        }

        const is_delicate = hasDelicateItem || overallMarginPct < 15 ? 1 : 0;

        // Compromisos predeterminados si no se ingresaron
        const defaultCommitments = our_commitments || 
            '1. POLÍTICA DE ENVASES: Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son RETORNABLES (deben devolverse limpias y completas en cada entrega). Los demás envases (galones, medios galones, litros, bolsas) son descartables de un solo uso y no aplican para retorno.\n' +
            '2. CALIDAD CERTIFICADA: Se entrega Certificado de Calidad e Inocuidad con cada despacho bajo estándar HACCP.\n' +
            `3. VIGENCIA: Oferta válida por ${validity_days} días a partir de su emisión.\n` +
            `4. CONDICIONES: Precios más IVA. Pago: ${payment_terms}. Entrega: ${delivery_time}.`;

        const [insertHeaderResult] = await conn.query(
            `INSERT INTO crm_quotations (
                company_id, quote_number, customer_id, customer_name, customer_contact,
                customer_email, customer_phone, customer_address, customer_nrc, customer_nit,
                date, validity_days, expiration_date, payment_terms, delivery_time,
                currency, subtotal, tax_amount, total, total_cost, overall_margin_pct,
                is_delicate, delicate_reason, status, our_commitments, notes,
                signature_data, signature_author_name, signature_author_title, signature_author_phone,
                signature_date, created_by, created_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId, quote_number, customer_id || null, customer_name, customer_contact || null,
                customer_email || null, customer_phone || null, customer_address || null, customer_nrc || null, customer_nit || null,
                date || new Date().toISOString().split('T')[0], validity_days, expiration_date, payment_terms, delivery_time,
                'USD', subtotal, taxAmount, total, totalCost, overallMarginPct,
                is_delicate, delicate_reason || null, 'borrador', defaultCommitments, notes || null,
                signature_data || null, signature_author_name || req.user?.nombre || null, signature_author_title || null, signature_author_phone || null,
                signature_data ? new Date() : null, req.user?.id || null, req.user?.nombre || null
            ]
        );

        const quotationId = insertHeaderResult.insertId;

        for (const item of processedItems) {
            await conn.query(
                `INSERT INTO crm_quotation_items (
                    quotation_id, product_id, product_code, product_name, presentation,
                    quantity, unit_measure, current_cost, unit_price, suggested_price,
                    margin_pct, is_delicate, discount_amount, notes, subtotal, total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    quotationId, item.product_id, item.product_code, item.product_name, item.presentation,
                    item.quantity, item.unit_measure, item.current_cost, item.unit_price, item.suggested_price,
                    item.margin_pct, item.is_delicate, item.discount_amount, item.notes, item.subtotal, item.total
                ]
            );
        }

        await conn.commit();
        res.status(201).json({
            id: quotationId,
            quote_number,
            is_delicate,
            message: 'Cotización creada exitosamente.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error al crear cotización:', err);
        res.status(500).json({ message: 'Error interno al guardar la cotización: ' + err.message });
    } finally {
        conn.release();
    }
};

// 4. Actualizar cotización existente
const updateQuotation = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const {
            customer_id,
            customer_name,
            customer_contact,
            customer_email,
            customer_phone,
            customer_address,
            customer_nrc,
            customer_nit,
            date,
            validity_days = 30,
            payment_terms = 'Contado',
            delivery_time = 'Entrega inmediata / según programación',
            status,
            our_commitments,
            notes,
            signature_data,
            signature_author_name,
            signature_author_title,
            signature_author_phone,
            delicate_reason,
            items = []
        } = req.body;

        const issueDate = date ? new Date(date) : new Date();
        const expDate = new Date(issueDate);
        expDate.setDate(expDate.getDate() + parseInt(validity_days, 10));
        const expiration_date = expDate.toISOString().split('T')[0];

        let subtotal = 0;
        let totalCost = 0;
        let hasDelicateItem = false;

        const processedItems = items.map(it => {
            const qty = parseFloat(it.quantity) || 1;
            const price = parseFloat(it.unit_price) || 0;
            const cost = parseFloat(it.current_cost) || 0;
            const discount = parseFloat(it.discount_amount) || 0;

            const itemSubtotal = (qty * price) - discount;
            const itemTotalCost = qty * cost;

            let marginPct = 0;
            if (price > 0) marginPct = ((price - cost) / price) * 100;

            const isDelicate = price <= cost || marginPct < 15;
            if (isDelicate) hasDelicateItem = true;

            subtotal += itemSubtotal;
            totalCost += itemTotalCost;

            return {
                product_id: it.product_id || null,
                product_code: it.product_code || null,
                product_name: it.product_name || 'Producto',
                presentation: it.presentation || 'Estándar',
                quantity: qty,
                unit_measure: it.unit_measure || 'LB',
                current_cost: cost,
                unit_price: price,
                suggested_price: it.suggested_price ? parseFloat(it.suggested_price) : null,
                margin_pct: marginPct,
                is_delicate: isDelicate ? 1 : 0,
                discount_amount: discount,
                notes: it.notes || null,
                subtotal: itemSubtotal,
                total: itemSubtotal
            };
        });

        const taxAmount = subtotal * 0.13;
        const total = subtotal + taxAmount;
        let overallMarginPct = 0;
        if (subtotal > 0) overallMarginPct = ((subtotal - totalCost) / subtotal) * 100;
        const is_delicate = hasDelicateItem || overallMarginPct < 15 ? 1 : 0;

        await conn.query(
            `UPDATE crm_quotations SET
                customer_id = ?, customer_name = ?, customer_contact = ?, customer_email = ?,
                customer_phone = ?, customer_address = ?, customer_nrc = ?, customer_nit = ?,
                date = ?, validity_days = ?, expiration_date = ?, payment_terms = ?, delivery_time = ?,
                subtotal = ?, tax_amount = ?, total = ?, total_cost = ?, overall_margin_pct = ?,
                is_delicate = ?, delicate_reason = ?, status = COALESCE(?, status), our_commitments = ?, notes = ?,
                signature_data = COALESCE(?, signature_data),
                signature_author_name = COALESCE(?, signature_author_name),
                signature_author_title = COALESCE(?, signature_author_title),
                signature_author_phone = COALESCE(?, signature_author_phone),
                signature_date = CASE WHEN ? IS NOT NULL THEN NOW() ELSE signature_date END
            WHERE id = ? AND company_id = ?`,
            [
                customer_id || null, customer_name, customer_contact || null, customer_email || null,
                customer_phone || null, customer_address || null, customer_nrc || null, customer_nit || null,
                date, validity_days, expiration_date, payment_terms, delivery_time,
                subtotal, taxAmount, total, totalCost, overallMarginPct,
                is_delicate, delicate_reason || null, status || null, our_commitments, notes || null,
                signature_data || null, signature_author_name || null, signature_author_title || null, signature_author_phone || null,
                signature_data || null,
                id, companyId
            ]
        );

        // Reemplazar ítems
        await conn.query('DELETE FROM crm_quotation_items WHERE quotation_id = ?', [id]);

        for (const item of processedItems) {
            await conn.query(
                `INSERT INTO crm_quotation_items (
                    quotation_id, product_id, product_code, product_name, presentation,
                    quantity, unit_measure, current_cost, unit_price, suggested_price,
                    margin_pct, is_delicate, discount_amount, notes, subtotal, total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, item.product_id, item.product_code, item.product_name, item.presentation,
                    item.quantity, item.unit_measure, item.current_cost, item.unit_price, item.suggested_price,
                    item.margin_pct, item.is_delicate, item.discount_amount, item.notes, item.subtotal, item.total
                ]
            );
        }

        await conn.commit();
        res.json({ message: 'Cotización actualizada exitosamente.', is_delicate });
    } catch (err) {
        await conn.rollback();
        console.error('Error al actualizar cotización:', err);
        res.status(500).json({ message: 'Error interno al actualizar la cotización.' });
    } finally {
        conn.release();
    }
};

// 5. Eliminar cotización
const deleteQuotation = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        res.json({ message: 'Cotización eliminada exitosamente.' });
    } catch (err) {
        console.error('Error al eliminar cotización:', err);
        res.status(500).json({ message: 'Error interno al eliminar la cotización.' });
    }
};

// 6. Cambiar estado de la cotización
const updateStatus = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Estado inválido.' });
        }

        await pool.query(
            'UPDATE crm_quotations SET status = ? WHERE id = ? AND company_id = ?',
            [status, id, companyId]
        );

        res.json({ message: `Estado actualizado a "${status}".` });
    } catch (err) {
        console.error('Error al cambiar estado de cotización:', err);
        res.status(500).json({ message: 'Error interno al actualizar estado.' });
    }
};

// 7. Convertir cotización a Acuerdo Comercial de Precios CRM (Feature extra proactivo)
const convertToAgreement = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [[quotation]] = await conn.query(
            'SELECT * FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (!quotation) {
            await conn.rollback();
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }

        if (!quotation.customer_id) {
            await conn.rollback();
            return res.status(400).json({ message: 'La cotización debe estar asignada a un cliente del catálogo para crear el acuerdo.' });
        }

        const [items] = await conn.query(
            'SELECT * FROM crm_quotation_items WHERE quotation_id = ?',
            [id]
        );

        if (items.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'La cotización no posee ítems para convertir.' });
        }

        let firstAgreementId = null;

        for (const item of items) {
            const [insRes] = await conn.query(
                `INSERT INTO egg_costing_customer_agreements (
                    company_id, customer_id, customer_name, product_id, product_type,
                    presentation, agreed_price_per_lb, agreed_unit_price, monthly_volume_lbs,
                    target_margin_pct, freight_cost_per_lb, payment_terms_days, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?)`,
                [
                    companyId,
                    quotation.customer_id,
                    quotation.customer_name,
                    item.product_id || null,
                    item.product_name,
                    item.presentation,
                    item.unit_price,
                    item.total,
                    (parseFloat(item.quantity) || 1) * 30, // Estimado mensual base
                    item.margin_pct || 20.0,
                    0.0000,
                    parseInt(quotation.validity_days, 10) || 30,
                    `Generado automáticamente desde Cotización N° ${quotation.quote_number}`
                ]
            );
            if (!firstAgreementId) firstAgreementId = insRes.insertId;
        }

        await conn.query(
            `UPDATE crm_quotations SET status = 'aprobada', converted_agreement_id = ? WHERE id = ?`,
            [firstAgreementId, id]
        );

        await conn.commit();
        res.json({
            message: 'Cotización convertida exitosamente a Acuerdo Comercial de CRM.',
            agreement_id: firstAgreementId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error al convertir cotización en acuerdo:', err);
        res.status(500).json({ message: 'Error interno al generar acuerdo comercial.' });
    } finally {
        conn.release();
    }
};

// 8. Duplicar cotización
const duplicateQuotation = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [[orig]] = await conn.query(
            'SELECT * FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (!orig) {
            await conn.rollback();
            return res.status(404).json({ message: 'Cotización original no encontrada.' });
        }

        const [items] = await conn.query(
            'SELECT * FROM crm_quotation_items WHERE quotation_id = ?',
            [id]
        );

        const newQuoteNumber = await generateNextQuoteNumber(companyId);
        const today = new Date().toISOString().split('T')[0];

        const [insertRes] = await conn.query(
            `INSERT INTO crm_quotations (
                company_id, quote_number, customer_id, customer_name, customer_contact,
                customer_email, customer_phone, customer_address, customer_nrc, customer_nit,
                date, validity_days, expiration_date, payment_terms, delivery_time,
                currency, subtotal, tax_amount, total, total_cost, overall_margin_pct,
                is_delicate, delicate_reason, status, our_commitments, notes,
                signature_data, signature_author_name, signature_author_title, signature_author_phone,
                created_by, created_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId, newQuoteNumber, orig.customer_id, orig.customer_name, orig.customer_contact,
                orig.customer_email, orig.customer_phone, orig.customer_address, orig.customer_nrc, orig.customer_nit,
                today, orig.validity_days, orig.expiration_date, orig.payment_terms, orig.delivery_time,
                orig.currency, orig.subtotal, orig.tax_amount, orig.total, orig.total_cost, orig.overall_margin_pct,
                orig.is_delicate, orig.delicate_reason, orig.our_commitments, `Copia de ${orig.quote_number}. ${orig.notes || ''}`,
                orig.signature_data, orig.signature_author_name, orig.signature_author_title, orig.signature_author_phone,
                req.user?.id || null, req.user?.nombre || null
            ]
        );

        const newId = insertRes.insertId;

        for (const it of items) {
            await conn.query(
                `INSERT INTO crm_quotation_items (
                    quotation_id, product_id, product_code, product_name, presentation,
                    quantity, unit_measure, current_cost, unit_price, suggested_price,
                    margin_pct, is_delicate, discount_amount, notes, subtotal, total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newId, it.product_id, it.product_code, it.product_name, it.presentation,
                    it.quantity, it.unit_measure, it.current_cost, it.unit_price, it.suggested_price,
                    it.margin_pct, it.is_delicate, it.discount_amount, it.notes, it.subtotal, it.total
                ]
            );
        }

        await conn.commit();
        res.status(201).json({
            id: newId,
            quote_number: newQuoteNumber,
            message: 'Cotización duplicada con éxito.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error al duplicar cotización:', err);
        res.status(500).json({ message: 'Error interno al duplicar la cotización.' });
    } finally {
        conn.release();
    }
};

// 9. Guardar firma del usuario logueado
const saveUserSignature = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const { signature_data, signature_title, phone } = req.body;

        await pool.query(
            `UPDATE users SET
                signature_data = COALESCE(?, signature_data),
                signature_title = COALESCE(?, signature_title),
                phone = COALESCE(?, phone)
             WHERE id = ?`,
            [signature_data || null, signature_title || null, phone || null, userId]
        );

        res.json({ message: 'Firma y perfil comercial guardados exitosamente.' });
    } catch (err) {
        console.error('Error al guardar firma de usuario:', err);
        res.status(500).json({ message: 'Error interno al guardar firma.' });
    }
};

// 10. Obtener firma del usuario logueado
const getUserSignature = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const [[user]] = await pool.query(
            'SELECT id, nombre, signature_data, signature_title, phone FROM users WHERE id = ?',
            [userId]
        );

        res.json(user || {});
    } catch (err) {
        console.error('Error al obtener firma de usuario:', err);
        res.status(500).json({ message: 'Error interno al recuperar firma.' });
    }
};

// 11. Descargar / Visualizar PDF oficial de la cotización
const getQuotationPdf = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [[quotation]] = await pool.query(
            'SELECT * FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (!quotation) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const [items] = await pool.query(
            'SELECT * FROM crm_quotation_items WHERE quotation_id = ? ORDER BY id ASC',
            [id]
        );

        const pdfBuffer = await generateQuotationPdf(quotation, items);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Cotizacion_${quotation.quote_number || id}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Error al generar PDF de cotización:', err);
        res.status(500).json({ message: 'Error interno al generar documento PDF.' });
    }
};

// 12. Descargar Word (.docx) editable de la cotización
const getQuotationDocx = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;

        const [[quotation]] = await pool.query(
            'SELECT * FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (!quotation) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const [items] = await pool.query(
            'SELECT * FROM crm_quotation_items WHERE quotation_id = ? ORDER BY id ASC',
            [id]
        );

        quotation.items = items;
        const docxBuffer = await generateQuotationDocx(quotation);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Cotizacion_${quotation.quote_number || id}.docx"`);
        res.send(docxBuffer);
    } catch (err) {
        console.error('Error al generar DOCX de cotización:', err);
        res.status(500).json({ message: 'Error interno al generar documento Word editable.' });
    }
};

// 13. Enviar cotización por correo electrónico
const sendQuotationEmail = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { id } = req.params;
        const { to, cc, subject, message, include_pdf = true, include_docx = false } = req.body;

        if (!to) {
            return res.status(400).json({ message: 'El correo del destinatario es obligatorio.' });
        }

        const [[quotation]] = await pool.query(
            'SELECT * FROM crm_quotations WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (!quotation) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const [items] = await pool.query(
            'SELECT * FROM crm_quotation_items WHERE quotation_id = ? ORDER BY id ASC',
            [id]
        );
        quotation.items = items;

        // Obtener configuración SMTP (usando sucursal o fallback de empresa)
        const [branchRows] = await pool.query('SELECT id, nombre FROM branches WHERE company_id = ? LIMIT 1', [companyId]);
        const branchId = branchRows[0]?.id || 1;

        let smtp;
        try {
            const [bSmtp] = await pool.query('SELECT * FROM smtp_settings WHERE branch_id = ? LIMIT 1', [branchId]);
            if (bSmtp.length > 0) {
                smtp = bSmtp[0];
            } else {
                const [cSmtp] = await pool.query(`
                    SELECT s.* FROM smtp_settings s
                    JOIN branches b ON s.branch_id = b.id
                    WHERE b.company_id = ? LIMIT 1
                `, [companyId]);
                if (cSmtp.length > 0) smtp = cSmtp[0];
            }
        } catch (e) {
            console.warn('Error buscando configuración SMTP:', e.message);
        }

        if (!smtp) {
            return res.status(400).json({
                message: 'No se encontró una configuración SMTP activa para enviar correos. Por favor configure los parámetros SMTP en Configuración > SMTP.'
            });
        }

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port, 10),
            secure: smtp.encryption === 'ssl' || parseInt(smtp.port, 10) === 465,
            auth: {
                user: smtp.user,
                pass: smtp.password
            },
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1'
            }
        });

        const attachments = [];

        if (include_pdf) {
            const pdfBuffer = await generateQuotationPdf(quotation, items);
            attachments.push({
                filename: `Cotizacion_${quotation.quote_number || id}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            });
        }

        if (include_docx) {
            const docxBuffer = await generateQuotationDocx(quotation);
            attachments.push({
                filename: `Cotizacion_${quotation.quote_number || id}.docx`,
                content: docxBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
        }

        const [[company]] = await pool.query('SELECT razon_social, nombre_comercial FROM companies WHERE id = ?', [companyId]);
        const companyName = company?.nombre_comercial || company?.razon_social || 'ANDELSA / Eggcelent';

        const formatDateShort = (dStr) => {
            if (!dStr) return '';
            const d = new Date(dStr);
            return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
        };

        const defaultHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #ea991c;">
                    <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px; font-weight: 800;">ANDELSA / Eggcelent</h2>
                    <p style="color: #64748b; margin: 0; font-size: 13px;">Ovoproductos Pasteurizados de Alta Calidad e Inocuidad (HACCP)</p>
                </div>

                <p style="font-size: 15px; color: #1e293b; line-height: 1.6;">
                    Estimado(a) <b>${quotation.customer_name}</b>,
                </p>

                <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                    ${message ? message.replace(/\n/g, '<br>') : 'Es un placer saludarle. Por este medio le hacemos llegar nuestra oferta comercial formal para su amable revisión y consideración.'}
                </p>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                    <table style="width: 100%; font-size: 13px; color: #334155;">
                        <tr>
                            <td style="padding: 4px 0; font-weight: bold; color: #64748b; width: 42%;">Número de Cotización:</td>
                            <td style="padding: 4px 0; font-weight: 800; color: #ea991c;">${quotation.quote_number}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">Fecha de Emisión:</td>
                            <td style="padding: 4px 0;">${formatDateShort(quotation.date)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">Válida Hasta:</td>
                            <td style="padding: 4px 0; color: #b91c1c; font-weight: bold;">${formatDateShort(quotation.expiration_date)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">Condición de Pago:</td>
                            <td style="padding: 4px 0;">${quotation.payment_terms || 'Contado'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">Monto Total:</td>
                            <td style="padding: 4px 0; font-size: 16px; font-weight: 800; color: #0f172a;">$${parseFloat(quotation.total || 0).toFixed(2)} USD</td>
                        </tr>
                    </table>
                </div>

                <div style="background: #fffbeb; border-left: 4px solid #ea991c; padding: 12px 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                        <b>Compromiso de Envases:</b> Las cubetas plásticas (30 y 32 LBS) son de uso <b>estrictamente retornable</b>. Los demás envases (galones, medios galones, litros y bolsas liner) son descartables de un solo uso.
                    </p>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                    Adjunto a este correo encontrará la cotización formal para su debida gestión comercial.
                </p>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">

                <div style="font-size: 13px; color: #0f172a;">
                    <b>${quotation.signature_author_name || quotation.created_by_name || 'Raul Rafael Sosa M.'}</b><br>
                    <span style="color: #64748b; font-size: 12px;">${quotation.signature_author_title || 'Ejecutivo Comercial'}</span><br>
                    <span style="color: #ea991c; font-weight: bold; font-size: 12px;">${quotation.signature_author_phone || '(503) 7069-5335'}</span>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"${companyName}" <${smtp.user}>`,
            to,
            ...(cc ? { cc } : {}),
            subject: subject || `Cotización Comercial ${quotation.quote_number} - ${companyName}`,
            html: defaultHtml,
            attachments
        });

        // Actualizar estado a 'enviada' si estaba en borrador
        if (quotation.status === 'borrador') {
            await pool.query("UPDATE crm_quotations SET status = 'enviada' WHERE id = ?", [id]);
        }

        res.json({ message: `Cotización enviada exitosamente por correo a ${to}.` });
    } catch (err) {
        console.error('Error al enviar cotización por correo:', err);
        res.status(500).json({ message: err.message || 'Error al enviar el correo electrónico.' });
    }
};

module.exports = {
    getQuotations,
    getQuotationById,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    updateStatus,
    convertToAgreement,
    duplicateQuotation,
    saveUserSignature,
    getUserSignature,
    getQuotationPdf,
    getQuotationDocx,
    sendQuotationEmail
};

