const pool = require('../config/db');
const { fail } = require('./eggRules.service');
const { savePayment } = require('./eggDispatchEmission.service');

// Nunca reemite un intento enviado: concilia solo contra el documento persistido por DTE.
async function reconcileEmission(companyId, saleId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [jobs] = await connection.query('SELECT * FROM egg_dispatch_emissions WHERE company_id = ? AND sale_id = ? FOR UPDATE', [companyId, saleId]);
        if (!jobs.length) fail('Emisión industrial no encontrada.', 404);
        const job = jobs[0];
        if (job.status === 'pending') { await connection.commit(); return { pending: true }; }
        if (job.status === 'accepted') {
            await connection.commit();
            return typeof job.result_json === 'string' ? JSON.parse(job.result_json) : job.result_json;
        }
        const [docs] = await connection.query('SELECT * FROM dtes WHERE company_id = ? AND venta_id = ? ORDER BY id DESC FOR UPDATE', [companyId, saleId]);
        if (docs.length !== 1) fail('El intento requiere conciliación en Gestión DTE. No se generó otra venta ni se repitió la emisión.', 409);
        const doc = docs[0];
        const accepted = doc.status === 'ACCEPTED' && !!doc.sello_recepcion;
        const contingency = ['CONTINGENCY', 'CONTINGENCIA_PENDIENTE'].includes(doc.status);
        if (!accepted && !contingency) fail(`Documento ${doc.codigo_generacion}: ${doc.status}. Resuelva el documento en Gestión DTE y vuelva a conciliar.`, 409);
        const result = { success: true, sale_id: Number(saleId), codigo_generacion: doc.codigo_generacion,
            numero_control: doc.numero_control, sello_recepcion: doc.sello_recepcion,
            dte_status: accepted ? 'ACEPTADO_HACIENDA' : 'CONTINGENCIA', hacienda_msg: 'Documento conciliado con Gestión DTE.' };
        await connection.query('UPDATE sales_headers SET estado = ?, codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ? WHERE company_id = ? AND id = ?',
            [accepted ? 'emitido' : 'contingencia', doc.codigo_generacion, doc.numero_control, doc.sello_recepcion, doc.fh_procesamiento, companyId, saleId]);
        await connection.query("UPDATE egg_dispatch_emissions SET status = 'accepted', result_json = ? WHERE id = ?", [JSON.stringify(result), job.id]);
        await savePayment(connection, saleId, typeof job.payload_json === 'string' ? JSON.parse(job.payload_json) : job.payload_json);
        await connection.query('UPDATE egg_customer_orders SET dte_codigo_generacion = ? WHERE company_id = ? AND sale_id = ?', [doc.codigo_generacion, companyId, saleId]);
        await connection.query('UPDATE egg_dispatch_stops s JOIN egg_dispatch_routes r ON r.id = s.dispatch_route_id SET s.dte_codigo_generacion = ? WHERE r.company_id = ? AND s.sale_id = ?', [doc.codigo_generacion, companyId, saleId]);
        await connection.commit();
        return result;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
module.exports = { reconcileEmission };
