const { pool, dteService, mailerService } = require('./salesUtils');
const dteCorrectionService = require('../../services/sales/dteCorrection.service');

/**
 * Obtiene el contexto editable completo de una venta cuyo DTE fue rechazado o está pendiente.
 */
const getDteCorrectionContext = async (req, res) => {
    try {
        const context = await dteCorrectionService.getSaleCorrectionContext(pool, req.params.id, req.company_id);
        res.json({ success: true, ...context });
    } catch (error) {
        console.error('[getDteCorrectionContext] Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al cargar contexto de corrección DTE'
        });
    }
};

/**
 * Simula el recálculo de ítems, aproximación, retención/percepción y pagos sin modificar BD.
 */
const previewDteRecalculation = async (req, res) => {
    try {
        const context = await dteCorrectionService.getSaleCorrectionContext(pool, req.params.id, req.company_id);
        const {
            items,
            header,
            payments,
            linkedDocuments,
            customer,
            autoFixApproximation = true,
            recalcRetencionPercepcion = false
        } = req.body || {};

        const result = dteCorrectionService.recalculateSaleDraft({
            dteType: context.sale.dte_type,
            items: Array.isArray(items) ? items : context.items,
            header: header ? { ...context.header, ...header } : context.header,
            payments: Array.isArray(payments) ? payments : context.payments,
            linkedDocs: Array.isArray(linkedDocuments) ? linkedDocuments : context.linkedDocuments,
            taxCfg: context.taxConfig,
            company: context.company,
            customer: customer ? { ...(context.customer || {}), ...customer } : context.customer,
            autoFixApproximation: Boolean(autoFixApproximation),
            recalcRetencionPercepcion: Boolean(recalcRetencionPercepcion)
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[previewDteRecalculation] Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al recalcular montos DTE'
        });
    }
};

/**
 * Guarda las correcciones sobre la venta/cliente/documentos y opcionalmente retransmite a Hacienda.
 */
const applyDteCorrection = async (req, res) => {
    const { id } = req.params;
    const { action = 'save_only', updateDateTime = false } = req.body || {};

    try {
        const saved = await dteCorrectionService.applySaleDteCorrection(
            pool,
            id,
            req.company_id,
            req.body || {},
            req.user || {}
        );

        if (action !== 'retransmit') {
            return res.json({
                success: true,
                saved: true,
                transmitted: false,
                accepted: false,
                ...saved,
                message: 'Correcciones guardadas correctamente en la venta'
            });
        }

        if (!saved.codigoGeneracion) {
            return res.status(400).json({
                success: false,
                saved: true,
                transmitted: false,
                message: 'Cambios guardados, pero la venta aún no tiene Código de Generación para retransmitir. Use "Guardar y Regenerar (Nuevo Control)".'
            });
        }

        const [sales] = await pool.query(
            `SELECT s.*, c.dte_active
             FROM sales_headers s
             JOIN companies c ON s.company_id = c.id
             WHERE s.id = ? AND s.company_id = ?`,
            [id, req.company_id]
        );
        const companySale = sales[0];
        if (!companySale || !companySale.dte_active) {
            return res.status(400).json({
                success: false,
                saved: true,
                transmitted: false,
                message: 'Cambios guardados, pero la empresa no tiene DTE activo.'
            });
        }

        const result = await dteService.retransmitDTE(
            companySale,
            saved.codigoGeneracion,
            null,
            { updateDateTime: Boolean(updateDateTime) }
        );

        if (result.success) {
            await pool.query(
                'UPDATE sales_headers SET sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
                [result.data?.sello_recepcion || null, result.data?.fh_procesamiento || null, id]
            );
            await pool.query(
                'UPDATE dtes SET status = "ACCEPTED", respuesta_hacienda = NULL, sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                [result.data?.sello_recepcion || null, result.data?.fh_procesamiento || null, saved.codigoGeneracion]
            );
            mailerService.queueDTEEmail(id, req.company_id).catch((err) => {
                console.error(`[applyDteCorrection] Error encolando correo para venta ${id}:`, err.message);
            });

            return res.json({
                success: true,
                saved: true,
                transmitted: true,
                accepted: true,
                data: result.data,
                message: 'Correcciones aplicadas y DTE aceptado por Hacienda'
            });
        }

        // Preservar o recuperar la respuesta real de Hacienda (sin sobreescribir con objetos vacíos como { fhProcesamiento: null })
        const rawErr = result.error;
        const hasUsefulDetail = Boolean(
            (typeof rawErr === 'string' && rawErr.trim()) ||
            (rawErr && typeof rawErr === 'object' && (
                rawErr.codigoMsg || rawErr.descripcionMsg || rawErr.observaciones || rawErr.estado || rawErr.message
            ))
        );

        let effectiveError = rawErr;
        if (hasUsefulDetail) {
            await pool.query(
                'UPDATE dtes SET status = "REJECTED", respuesta_hacienda = ? WHERE codigo_generacion = ?',
                [typeof rawErr === 'string' ? JSON.stringify({ message: rawErr }) : JSON.stringify(rawErr), saved.codigoGeneracion]
            ).catch(() => {});
        } else {
            const [dteRows] = await pool.query(
                'SELECT respuesta_hacienda FROM dtes WHERE codigo_generacion = ? LIMIT 1',
                [saved.codigoGeneracion]
            ).catch(() => [[]]);
            if (dteRows[0]?.respuesta_hacienda) {
                effectiveError = typeof dteRows[0].respuesta_hacienda === 'string'
                    ? (() => { try { return JSON.parse(dteRows[0].respuesta_hacienda); } catch { return dteRows[0].respuesta_hacienda; } })()
                    : dteRows[0].respuesta_hacienda;
            }
        }

        // Invalidar diagnóstico cacheado previo para que el siguiente análisis evalúe el rechazo actual
        await pool.query(
            'DELETE FROM dte_diagnoses WHERE sale_id = ? AND company_id = ?',
            [id, req.company_id]
        ).catch(() => {});

        return res.json({
            success: true,
            saved: true,
            transmitted: true,
            accepted: false,
            haciendaError: effectiveError,
            details: result.details || [],
            message: 'Los cambios se guardaron, pero Hacienda devolvió una observación al reintentar'
        });
    } catch (error) {
        console.error('[applyDteCorrection] Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al aplicar correcciones del DTE'
        });
    }
};

/**
 * Busca DTEs existentes para vincular en NC (05), ND (06), CR (07) o NR (04).
 */
const searchRelatedDteDocuments = async (req, res) => {
    try {
        const docs = await dteCorrectionService.searchRelatedDocuments(pool, req.company_id, {
            search: req.query.search || '',
            customerId: req.query.customer_id || null,
            docType: req.query.doc_type || null
        });
        res.json({ success: true, data: docs });
    } catch (error) {
        console.error('[searchRelatedDteDocuments] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar documentos relacionados',
            error: error.message
        });
    }
};

module.exports = {
    getDteCorrectionContext,
    previewDteRecalculation,
    applyDteCorrection,
    searchRelatedDteDocuments
};
