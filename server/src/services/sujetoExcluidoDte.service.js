const pool = require('../config/db');
const dteService = require('./dte.service');
const { generateRTEEModern } = require('./pdf.modern_rtee');

class SujetoExcluidoDteService {
    /**
     * Emite un DTE-14 (Factura de Sujeto Excluido) asociado a un gasto operativo.
     */
    async emitExpenseDte(expenseId, companyId, usuarioId, branchId) {
        const [expRows] = await pool.query(`
            SELECT eh.*, 
                   p.nombre AS provider_nombre, 
                   p.nrc AS provider_nrc,
                   p.nit AS provider_nit,
                   p.numero_documento AS provider_num_documento,
                   p.tipo_documento AS provider_tipo_documento,
                   p.direccion AS provider_direccion,
                   p.departamento AS provider_departamento,
                   p.municipio AS provider_municipio,
                   p.distrito AS provider_distrito,
                   p.telefono AS provider_telefono,
                   p.correo AS provider_correo,
                   p.codigo_actividad AS provider_codigo_actividad,
                   p.giro AS provider_giro
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            WHERE eh.id = ? AND eh.company_id = ?
        `, [expenseId, companyId]);

        if (expRows.length === 0) {
            throw new Error('Gasto no encontrado');
        }

        const expense = expRows[0];

        if (String(expense.tipo_documento_id).trim() !== '14') {
            throw new Error('El documento no está configurado como Sujeto Excluido (DTE-14)');
        }

        if (expense.estado_dte === 'PROCESADO' && expense.sello_recepcion) {
            return {
                success: true,
                alreadyProcessed: true,
                message: 'El DTE ya fue procesado y cuenta con sello de recepción',
                codigoGeneracion: expense.numero_documento,
                numeroControl: expense.num_control,
                selloRecepcion: expense.sello_recepcion
            };
        }

        const [items] = await pool.query(
            'SELECT * FROM expense_items WHERE expense_id = ?',
            [expenseId]
        );

        const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
        if (compRows.length === 0) {
            throw new Error('Empresa no encontrada');
        }
        const company = compRows[0];

        const targetBranchId = expense.branch_id || branchId;

        // Armar receptor (Sujeto Excluido)
        const receptor = {
            tipoDocumento: expense.provider_tipo_documento || (expense.provider_num_documento ? '13' : (expense.provider_nit ? '36' : '13')),
            numDocumento: expense.provider_num_documento || expense.provider_nit || '000000000',
            nombre: expense.provider_nombre || 'SUJETO EXCLUIDO',
            codActividad: expense.provider_codigo_actividad || null,
            descActividad: expense.provider_giro || null,
            direccion: {
                departamento: String(expense.provider_departamento || '06').padStart(2, '0'),
                municipio: String(expense.provider_municipio || '14').padStart(2, '0'),
                distrito: String(expense.provider_distrito || '01').padStart(2, '0'),
                complemento: expense.provider_direccion || 'San Salvador'
            },
            telefono: expense.provider_telefono || null,
            correo: expense.provider_correo || null
        };

        const totalCompra = parseFloat(expense.monto_sujeto || expense.total_gravada || expense.monto_total || 0);
        const reteRenta = parseFloat(expense.retencion || 0);
        const totalPagar = parseFloat(expense.monto_total || (totalCompra - reteRenta));

        const dtePayload = {
            header: {
                dte_type: '14',
                user_id: usuarioId,
                branch_id: targetBranchId,
                provider_id: expense.provider_id,
                condicion_operacion: parseInt(expense.condicion_operacion_id, 10) || 1,
                total_compra: totalCompra,
                retencion_renta: reteRenta,
                retencion: reteRenta,
                subtotal: totalCompra,
                total_pagar: totalPagar,
                observaciones: expense.observaciones || 'Factura de Sujeto Excluido'
            },
            receptor,
            items: (items.length > 0 ? items : [{ description: expense.observaciones || 'Gasto registrado', total: totalCompra }]).map((it, idx) => ({
                numItem: idx + 1,
                tipo_item: parseInt(it.tipo_item, 10) || 2, // 2: Servicio por defecto en gastos
                descripcion: it.description || it.descripcion || 'Servicio profesional/técnico',
                cantidad: parseFloat(it.cantidad || 1),
                precio_unitario: parseFloat(it.precio_unitario || it.total || totalCompra),
                compra: parseFloat(it.total || totalCompra),
                descuento: 0,
                unidad_medida: 59
            }))
        };

        const dteResult = await dteService.emitDTE(company, dtePayload, null, { gasto_id: expenseId });

        if (dteResult && dteResult.success) {
            const { codigo_generacion, numero_control, sello_recepcion, contingency } = dteResult.data || {};
            const estadoDte = contingency ? 'CONTINGENCIA' : 'PROCESADO';

            await pool.query(
                'UPDATE expense_headers SET numero_documento = ?, num_control = ?, sello_recepcion = ?, estado_dte = ? WHERE id = ?',
                [codigo_generacion, numero_control, sello_recepcion, estadoDte, expenseId]
            );

            return {
                success: true,
                codigoGeneracion: codigo_generacion,
                numeroControl: numero_control,
                selloRecepcion: sello_recepcion,
                estadoDte
            };
        } else {
            await pool.query(
                'UPDATE expense_headers SET estado_dte = ? WHERE id = ?',
                ['RECHAZADO', expenseId]
            );
            return {
                success: false,
                error: dteResult?.error || 'Rechazo de Hacienda al emitir Factura de Sujeto Excluido'
            };
        }
    }

    /**
     * Emite un DTE-14 (Factura de Sujeto Excluido) asociado a una compra de bienes/servicios.
     */
    async emitPurchaseDte(purchaseId, companyId, usuarioId, branchId) {
        const [purchRows] = await pool.query(`
            SELECT ph.*, 
                   p.nombre AS provider_nombre, 
                   p.nrc AS provider_nrc,
                   p.nit AS provider_nit,
                   p.numero_documento AS provider_num_documento,
                   p.tipo_documento AS provider_tipo_documento,
                   p.direccion AS provider_direccion,
                   p.departamento AS provider_departamento,
                   p.municipio AS provider_municipio,
                   p.distrito AS provider_distrito,
                   p.telefono AS provider_telefono,
                   p.correo AS provider_correo,
                   p.codigo_actividad AS provider_codigo_actividad,
                   p.giro AS provider_giro
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            WHERE ph.id = ? AND ph.company_id = ?
        `, [purchaseId, companyId]);

        if (purchRows.length === 0) {
            throw new Error('Compra no encontrada');
        }

        const purchase = purchRows[0];

        if (String(purchase.tipo_documento_id).trim() !== '14') {
            throw new Error('El documento no está configurado como Sujeto Excluido (DTE-14)');
        }

        if (purchase.estado_dte === 'PROCESADO' && purchase.sello_recepcion) {
            return {
                success: true,
                alreadyProcessed: true,
                message: 'El DTE ya fue procesado y cuenta con sello de recepción',
                codigoGeneracion: purchase.codigo_generacion || purchase.numero_documento,
                numeroControl: purchase.num_control,
                selloRecepcion: purchase.sello_recepcion
            };
        }

        const [items] = await pool.query(
            'SELECT pi.*, p.nombre as product_name, p.codigo as product_code FROM purchase_items pi LEFT JOIN products p ON pi.product_id = p.id WHERE pi.purchase_id = ?',
            [purchaseId]
        );

        const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
        if (compRows.length === 0) {
            throw new Error('Empresa no encontrada');
        }
        const company = compRows[0];

        const targetBranchId = purchase.branch_id || branchId;

        const receptor = {
            tipoDocumento: purchase.provider_tipo_documento || (purchase.provider_num_documento ? '13' : (purchase.provider_nit ? '36' : '13')),
            numDocumento: purchase.provider_num_documento || purchase.provider_nit || '000000000',
            nombre: purchase.provider_nombre || 'SUJETO EXCLUIDO',
            codActividad: purchase.provider_codigo_actividad || null,
            descActividad: purchase.provider_giro || null,
            direccion: {
                departamento: String(purchase.provider_departamento || '06').padStart(2, '0'),
                municipio: String(purchase.provider_municipio || '14').padStart(2, '0'),
                distrito: String(purchase.provider_distrito || '01').padStart(2, '0'),
                complemento: purchase.provider_direccion || 'San Salvador'
            },
            telefono: purchase.provider_telefono || null,
            correo: purchase.provider_correo || null
        };

        const totalCompra = parseFloat(purchase.total_gravada || purchase.monto_total || 0);
        const reteRenta = parseFloat(purchase.retencion || 0);
        const totalPagar = parseFloat(purchase.monto_total || (totalCompra - reteRenta));

        const dtePayload = {
            header: {
                dte_type: '14',
                user_id: usuarioId,
                branch_id: targetBranchId,
                provider_id: purchase.provider_id,
                condicion_operacion: parseInt(purchase.condicion_operacion_id, 10) || 1,
                total_compra: totalCompra,
                retencion_renta: reteRenta,
                retencion: reteRenta,
                subtotal: totalCompra,
                total_pagar: totalPagar,
                observaciones: purchase.observaciones || 'Factura de Sujeto Excluido'
            },
            receptor,
            items: items.map((it, idx) => ({
                numItem: idx + 1,
                tipo_item: parseInt(it.tipo_item, 10) || 1, // 1: Bienes por defecto en compras
                descripcion: it.descripcion || it.product_name || 'Compra de bien',
                cantidad: parseFloat(it.cantidad || 1),
                precio_unitario: parseFloat(it.precio_unitario || 0),
                compra: parseFloat(it.total || (parseFloat(it.cantidad || 1) * parseFloat(it.precio_unitario || 0))),
                descuento: 0,
                unidad_medida: 59,
                codigo: it.product_code || null
            }))
        };

        const dteResult = await dteService.emitDTE(company, dtePayload, null, { compra_id: purchaseId });

        if (dteResult && dteResult.success) {
            const { codigo_generacion, numero_control, sello_recepcion, contingency } = dteResult.data || {};
            const estadoDte = contingency ? 'CONTINGENCIA' : 'PROCESADO';

            await pool.query(
                'UPDATE purchase_headers SET codigo_generacion = ?, numero_documento = ?, num_control = ?, sello_recepcion = ?, estado_dte = ? WHERE id = ?',
                [codigo_generacion, codigo_generacion, numero_control, sello_recepcion, estadoDte, purchaseId]
            );

            return {
                success: true,
                codigoGeneracion: codigo_generacion,
                numeroControl: numero_control,
                selloRecepcion: sello_recepcion,
                estadoDte
            };
        } else {
            await pool.query(
                'UPDATE purchase_headers SET estado_dte = ? WHERE id = ?',
                ['RECHAZADO', purchaseId]
            );
            return {
                success: false,
                error: dteResult?.error || 'Rechazo de Hacienda al emitir Factura de Sujeto Excluido'
            };
        }
    }

    /**
     * Retorna el JSON del DTE emitido para un gasto.
     */
    async getExpenseDteJson(expenseId, companyId) {
        const [dtes] = await pool.query(
            `SELECT d.* FROM dtes d
             WHERE (d.gasto_id = ? OR d.codigo_generacion = (SELECT numero_documento FROM expense_headers WHERE id = ?))
               AND d.company_id = ?
             ORDER BY d.id DESC LIMIT 1`,
            [expenseId, expenseId, companyId]
        );

        if (dtes.length === 0) {
            throw new Error('DTE no encontrado para este gasto');
        }

        const dte = dtes[0];
        const rawJson = dte.json_original ? JSON.parse(dte.json_original) : null;
        return {
            dte_id: dte.id,
            status: dte.status,
            codigoGeneracion: dte.codigo_generacion,
            numeroControl: dte.numero_control,
            selloRecepcion: dte.sello_recepcion,
            fhProcesamiento: dte.fh_procesamiento,
            ambiente: dte.ambiente,
            json: rawJson,
            respuestaHacienda: dte.respuesta_hacienda ? JSON.parse(dte.respuesta_hacienda) : null
        };
    }

    /**
     * Genera la Representación Gráfica (PDF / RTEE) para un gasto emitido con DTE-14.
     */
    async getExpenseDtePdfBuffer(expenseId, companyId) {
        const [dtes] = await pool.query(
            `SELECT d.* FROM dtes d
             WHERE (d.gasto_id = ? OR d.codigo_generacion = (SELECT numero_documento FROM expense_headers WHERE id = ?))
               AND d.company_id = ?
             ORDER BY d.id DESC LIMIT 1`,
            [expenseId, expenseId, companyId]
        );

        if (dtes.length === 0) {
            throw new Error('DTE no encontrado para generar PDF');
        }

        const dteRow = dtes[0];
        const dteJson = JSON.parse(dteRow.json_original);

        const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
        const company = compRows[0] || {};

        const [branchRows] = await pool.query('SELECT * FROM branches WHERE id = ?', [dteRow.branch_id || company.id]);
        const branch = branchRows[0] || {};

        const reportData = {
            emisor: {
                ...company,
                direccion_complemento: branch.direccion || company.direccion,
                telefono: branch.telefono || company.telefono,
                correo: branch.correo || company.correo,
                codigo_actividad: company.codigo_actividad,
                actividad_economica: company.actividad_economica
            },
            receptor: dteJson.receptor,
            dte: {
                tipoDte: dteJson.identificacion?.tipoDte || '14',
                tipoDteNombre: 'Factura de Sujeto Excluido',
                codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
                numeroControl: dteJson.identificacion?.numeroControl,
                selloRecepcion: dteRow.sello_recepcion,
                ambiente: dteJson.identificacion?.ambiente,
                tipoModelo: dteJson.identificacion?.tipoModelo,
                tipoOperacion: dteJson.identificacion?.tipoOperacion
            },
            venta: {
                fecha_emision: dteJson.identificacion?.fecEmi,
                hora_emision: dteJson.identificacion?.horEmi,
                condicion_operacion: dteJson.resumen?.condicionOperacion || 1,
                subtotal_ventas: dteJson.resumen?.totalCompra || 0,
                total_compra: dteJson.resumen?.totalCompra || 0,
                totalCompra: dteJson.resumen?.totalCompra || 0,
                subtotal: dteJson.resumen?.subTotal || dteJson.resumen?.totalCompra || 0,
                reteRenta: dteJson.resumen?.reteRenta || 0,
                retencion_renta: dteJson.resumen?.reteRenta || 0,
                total_pagar: dteJson.resumen?.totalPagar || 0,
                total_descuento: dteJson.resumen?.totalDescu || 0,
                total_letras: dteJson.resumen?.totalLetras || ''
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || 0,
                montoDescuento: item.montoDescu || 0,
                compra: item.compra || 0,
                totalItem: item.compra || 0,
                uniMedida: item.uniMedida || 59
            }))
        };

        return await generateRTEEModern(reportData);
    }

    /**
     * Retorna el JSON del DTE emitido para una compra.
     */
    async getPurchaseDteJson(purchaseId, companyId) {
        const [dtes] = await pool.query(
            `SELECT d.* FROM dtes d
             WHERE (d.compra_id = ? OR d.codigo_generacion = (SELECT codigo_generacion FROM purchase_headers WHERE id = ?))
               AND d.company_id = ?
             ORDER BY d.id DESC LIMIT 1`,
            [purchaseId, purchaseId, companyId]
        );

        if (dtes.length === 0) {
            throw new Error('DTE no encontrado para esta compra');
        }

        const dte = dtes[0];
        const rawJson = dte.json_original ? JSON.parse(dte.json_original) : null;
        return {
            dte_id: dte.id,
            status: dte.status,
            codigoGeneracion: dte.codigo_generacion,
            numeroControl: dte.numero_control,
            selloRecepcion: dte.sello_recepcion,
            fhProcesamiento: dte.fh_procesamiento,
            ambiente: dte.ambiente,
            json: rawJson,
            respuestaHacienda: dte.respuesta_hacienda ? JSON.parse(dte.respuesta_hacienda) : null
        };
    }

    /**
     * Genera la Representación Gráfica (PDF / RTEE) para una compra emitida con DTE-14.
     */
    async getPurchaseDtePdfBuffer(purchaseId, companyId) {
        const [dtes] = await pool.query(
            `SELECT d.* FROM dtes d
             WHERE (d.compra_id = ? OR d.codigo_generacion = (SELECT codigo_generacion FROM purchase_headers WHERE id = ?))
               AND d.company_id = ?
             ORDER BY d.id DESC LIMIT 1`,
            [purchaseId, purchaseId, companyId]
        );

        if (dtes.length === 0) {
            throw new Error('DTE no encontrado para generar PDF');
        }

        const dteRow = dtes[0];
        const dteJson = JSON.parse(dteRow.json_original);

        const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
        const company = compRows[0] || {};

        const [branchRows] = await pool.query('SELECT * FROM branches WHERE id = ?', [dteRow.branch_id || company.id]);
        const branch = branchRows[0] || {};

        const reportData = {
            emisor: {
                ...company,
                direccion_complemento: branch.direccion || company.direccion,
                telefono: branch.telefono || company.telefono,
                correo: branch.correo || company.correo,
                codigo_actividad: company.codigo_actividad,
                actividad_economica: company.actividad_economica
            },
            receptor: dteJson.receptor,
            dte: {
                tipoDte: dteJson.identificacion?.tipoDte || '14',
                tipoDteNombre: 'Factura de Sujeto Excluido',
                codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
                numeroControl: dteJson.identificacion?.numeroControl,
                selloRecepcion: dteRow.sello_recepcion,
                ambiente: dteJson.identificacion?.ambiente,
                tipoModelo: dteJson.identificacion?.tipoModelo,
                tipoOperacion: dteJson.identificacion?.tipoOperacion
            },
            venta: {
                fecha_emision: dteJson.identificacion?.fecEmi,
                hora_emision: dteJson.identificacion?.horEmi,
                condicion_operacion: dteJson.resumen?.condicionOperacion || 1,
                subtotal_ventas: dteJson.resumen?.totalCompra || 0,
                total_compra: dteJson.resumen?.totalCompra || 0,
                totalCompra: dteJson.resumen?.totalCompra || 0,
                subtotal: dteJson.resumen?.subTotal || dteJson.resumen?.totalCompra || 0,
                reteRenta: dteJson.resumen?.reteRenta || 0,
                retencion_renta: dteJson.resumen?.reteRenta || 0,
                total_pagar: dteJson.resumen?.totalPagar || 0,
                total_descuento: dteJson.resumen?.totalDescu || 0,
                total_letras: dteJson.resumen?.totalLetras || ''
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || 0,
                montoDescuento: item.montoDescu || 0,
                compra: item.compra || 0,
                totalItem: item.compra || 0,
                uniMedida: item.uniMedida || 59
            }))
        };

        return await generateRTEEModern(reportData);
    }
}

module.exports = new SujetoExcluidoDteService();
