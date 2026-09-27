const pool = require('../config/db');
const dteService = require('./dte.service');
const { fail } = require('./eggRules.service');

// Outbox persistente. Se confirma la venta borrador y su reserva antes de contactar al emisor.
async function emitSavedSale(companyId, saleId) {
    const connection = await pool.getConnection();
    let job;
    try {
        await connection.beginTransaction();
        const [jobs] = await connection.query('SELECT * FROM egg_dispatch_emissions WHERE company_id = ? AND sale_id = ? FOR UPDATE', [companyId, saleId]);
        if (!jobs.length) fail('No existe una emisión industrial guardada.', 404);
        job = jobs[0];
        if (job.status === 'accepted') { await connection.commit(); return JSON.parse(typeof job.result_json === 'string' ? job.result_json : JSON.stringify(job.result_json)); }
        if (job.status !== 'pending') fail('El intento previo requiere conciliación en gestión DTE antes de volver a emitir.', 409);
        await connection.query("UPDATE egg_dispatch_emissions SET status = 'sending', updated_at = NOW() WHERE id = ?", [job.id]);
        await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }

    const [companies] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const payload = typeof job.payload_json === 'string' ? JSON.parse(job.payload_json) : job.payload_json;
    let response;
    try { response = await dteService.emitDTE(companies[0], payload, saleId); }
    catch (error) { response = { success: false, error: error.message }; }
    const accepted = response?.success === true;
    const info = response?.data || {};
    const result = {
        sale_id: saleId, dte_status: accepted ? (response.contingency ? 'CONTINGENCIA' : 'ACEPTADO_HACIENDA') : (response?.codigo_generacion ? 'RECHAZADO_HACIENDA' : 'ERROR_EMISION'),
        codigo_generacion: info.codigo_generacion || response?.codigo_generacion || null,
        numero_control: info.numero_control || response?.numero_control || null,
        sello_recepcion: info.sello_recepcion || null,
        hacienda_msg: accepted ? 'Documento emitido.' : (response?.error || 'Emisión pendiente de conciliación. La reserva está conservada.'),
        hacienda_details: response?.details || null, success: accepted
    };
    const saved = await pool.getConnection();
    try {
        await saved.beginTransaction();
        const [current] = await saved.query('SELECT status, result_json FROM egg_dispatch_emissions WHERE id = ? FOR UPDATE', [job.id]);
        if (current[0]?.status === 'accepted') {
            await saved.commit();
            return typeof current[0].result_json === 'string' ? JSON.parse(current[0].result_json) : current[0].result_json;
        }
        await saved.query(`UPDATE sales_headers SET estado = ?, codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ?
            WHERE id = ? AND company_id = ?`, [accepted ? (response.contingency ? 'contingencia' : 'emitido') : 'borrador', result.codigo_generacion, result.numero_control, result.sello_recepcion, info.fh_procesamiento || null, saleId, companyId]);
        await saved.query('UPDATE egg_dispatch_emissions SET status = ?, result_json = ?, updated_at = NOW() WHERE id = ?', [accepted ? 'accepted' : 'review', JSON.stringify(result), job.id]);
        if (accepted) await savePayment(saved, saleId, payload);
        if (result.codigo_generacion) {
            await saved.query('UPDATE egg_customer_orders SET dte_codigo_generacion = ? WHERE sale_id = ? AND company_id = ?', [result.codigo_generacion, saleId, companyId]);
            await saved.query(`UPDATE egg_dispatch_stops s JOIN egg_dispatch_routes r ON r.id = s.dispatch_route_id
                SET s.dte_codigo_generacion = ? WHERE s.sale_id = ? AND r.company_id = ?`, [result.codigo_generacion, saleId, companyId]);
            await saved.query('UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?', [saleId, result.codigo_generacion, companyId]);
        }
        await saved.commit();
    } catch (error) { await saved.rollback(); throw error; } finally { saved.release(); }
    return result;
}

async function savePayment(connection, saleId, payload) {
    const [existing] = await connection.query('SELECT sale_id FROM sales_payments WHERE sale_id = ? LIMIT 1', [saleId]);
    if (existing.length) return;
    const payment = payload.payments?.[0];
    if (!payment) return;
    await connection.query('INSERT INTO sales_payments SET ?', [{ sale_id: saleId, metodo_pago: payment.codigo,
        monto: payment.monto, referencia: Number(payload.header.condicion_operacion) === 2 ? `Crédito ${payload.header.dias_credito} días` : 'Contado Despacho' }]);
}
module.exports = { emitSavedSale, savePayment };
