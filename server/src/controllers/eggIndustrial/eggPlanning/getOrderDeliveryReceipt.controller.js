const { pool, reportPdfHelper } = require('./shared');

const getOrderDeliveryReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const [orderRows] = await pool.query(
            `SELECT o.*,
                    c.nombre as customer_registered_name,
                    c.nombre_comercial as customer_commercial_name,
                    c.nit as customer_nit,
                    c.nrc as customer_nrc,
                    c.telefono as customer_phone,
                    c.direccion as customer_address,
                    cb.nombre as branch_name,
                    cb.direccion as branch_address,
                    cb.contacto_nombre as branch_contact_person,
                    cb.contacto_telefono as branch_contact_phone,
                    r.codigo_ruta,
                    r.fecha_despacho as route_date,
                    r.driver_name as route_driver_name,
                    r.driver_phone as route_driver_phone,
                    v.codigo as vehicle_code,
                    v.placa as vehicle_plate,
                    v.modelo as vehicle_model,
                    b.batch_code_display as linked_batch_code,
                    sh.codigo_generacion as sale_codigo_generacion,
                    sh.numero_control as sale_numero_control,
                    sh.dte_type as sale_dte_type,
                    (CASE WHEN o.sale_id IS NOT NULL OR o.dte_codigo_generacion IS NOT NULL OR sh.id IS NOT NULL THEN 1 ELSE 0 END) as is_billed
             FROM egg_customer_orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             LEFT JOIN customer_branches cb ON o.customer_branch_id = cb.id
             LEFT JOIN egg_dispatch_routes r ON o.dispatch_route_id = r.id
             LEFT JOIN delivery_vehicles v ON r.vehicle_id = v.id
             LEFT JOIN egg_production_batches b ON o.batch_id = b.id
             LEFT JOIN sales_headers sh ON (o.sale_id = sh.id OR (o.dte_codigo_generacion IS NOT NULL AND o.dte_codigo_generacion COLLATE utf8mb4_unicode_ci = sh.codigo_generacion COLLATE utf8mb4_unicode_ci))
             WHERE o.id = ? AND o.company_id = ?`,
            [id, company_id]
        );

        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Pedido no encontrado.' });
        }

        const ord = orderRows[0];
        const company = await reportPdfHelper.getCompanyInfo(company_id);

        let lineItems = [];
        if (ord.items_json) {
            try {
                const parsed = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : ord.items_json;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    lineItems = parsed;
                }
            } catch (e) {}
        }
        if (lineItems.length === 0) {
            lineItems = [{
                product_type: ord.product_type,
                presentation: ord.presentation,
                quantity_lbs: ord.quantity_lbs,
                price_per_lb: ord.price_per_lb,
                lot_code: ord.lot_code || ord.linked_batch_code || 'Por asignar'
            }];
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

        // Encabezado institucional
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(company.razon_social || 'EMPRESA INDUSTRIAL', 35, 35, { align: 'center' });
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text(`NIT: ${company.nit || 'N/A'} | NRC: ${company.nrc || 'N/A'} | Tel: ${company.telefono || 'N/A'}`, 35, 50, { align: 'center' });
        doc.text(company.direccion || 'San Salvador, El Salvador', 35, 62, { align: 'center' });

        doc.rect(35, 78, 542, 22).fill('#4f46e5');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('COMPROBANTE DE DESPACHO Y ENTREGA DE OVOPRODUCTOS', 35, 84, { align: 'center' });

        let currentY = 110;
        doc.rect(35, currentY, 542, 95).fill('#f8fafc');
        doc.rect(35, currentY, 542, 95).stroke('#cbd5e1');

        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        doc.text('DATOS DEL PEDIDO', 45, currentY + 8);
        doc.text('DATOS DEL CLIENTE Y DESTINO', 300, currentY + 8);
        doc.rect(45, currentY + 18, 230, 0.5).fill('#cbd5e1');
        doc.rect(300, currentY + 18, 265, 0.5).fill('#cbd5e1');

        doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
        const orderNum = ord.order_number || `PED-${String(ord.id).padStart(5, '0')}`;
        const reqDate = ord.required_delivery_date
            ? (typeof ord.required_delivery_date === 'string'
                ? ord.required_delivery_date.split('T')[0]
                : (ord.required_delivery_date instanceof Date
                    ? ord.required_delivery_date.toISOString().split('T')[0]
                    : String(ord.required_delivery_date).substring(0, 10)))
            : 'N/A';
        doc.text(`Orden #: `, 45, currentY + 24);
        doc.font('Helvetica-Bold').text(orderNum, 90, currentY + 24);
        doc.font('Helvetica').text(`Fecha Entrega: `, 45, currentY + 36);
        doc.font('Helvetica-Bold').text(reqDate, 115, currentY + 36);
        doc.font('Helvetica').text(`Prioridad: `, 45, currentY + 48);
        doc.text((ord.priority || 'Normal').toUpperCase(), 95, currentY + 48);
        doc.font('Helvetica').text(`Ruta Despacho: `, 45, currentY + 60);
        doc.font('Helvetica-Bold').text(ord.codigo_ruta || 'Sin Ruta Asignada', 115, currentY + 60);
        doc.font('Helvetica').text(`Camión / Motorista: `, 45, currentY + 72);
        doc.text(`${ord.vehicle_code ? `${ord.vehicle_code} (${ord.vehicle_plate}) - ` : ''}${ord.route_driver_name || 'Sin asignar'}`, 130, currentY + 72, { width: 145, ellipsis: true });

        const customerDisplayName = ord.customer_commercial_name || ord.customer_registered_name || ord.customer_name || 'Cliente sin registrar';
        doc.font('Helvetica-Bold').text(customerDisplayName, 300, currentY + 24, { width: 265, ellipsis: true });
        doc.font('Helvetica').text(`Sucursal: `, 300, currentY + 36);
        doc.text(ord.branch_name || 'Sucursal Principal', 345, currentY + 36, { width: 220, ellipsis: true });
        doc.text(`Dirección: `, 300, currentY + 48);
        doc.text(ord.branch_address || ord.customer_address || 'Dirección no especificada', 345, currentY + 48, { width: 220, ellipsis: true });
        doc.text(`Contacto: `, 300, currentY + 60);
        doc.text(`${ord.branch_contact_person || 'N/A'} ${ord.branch_contact_phone ? `(Tel: ${ord.branch_contact_phone})` : ''}`, 345, currentY + 60, { width: 220, ellipsis: true });
        doc.text(`Estado: `, 300, currentY + 72);
        doc.font('Helvetica-Bold').text((ord.delivery_status || ord.status || 'Pendiente').toUpperCase(), 340, currentY + 72);

        // Tabla de Productos
        currentY += 105;
        doc.rect(35, currentY, 542, 16).fill('#1e293b');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
        doc.text('#', 40, currentY + 4, { width: 15 });
        doc.text('PRODUCTO SOLICITADO', 60, currentY + 4, { width: 145 });
        doc.text('PRESENTACIÓN', 210, currentY + 4, { width: 80 });
        doc.text('LOTE PROD.', 295, currentY + 4, { width: 65 });
        doc.text('CANT (UDS)', 365, currentY + 4, { width: 45, align: 'right' });
        doc.text('PESO (LBS)', 415, currentY + 4, { width: 50, align: 'right' });
        doc.text('PESO (KG)', 470, currentY + 4, { width: 45, align: 'right' });
        doc.text('TOTAL ($)', 520, currentY + 4, { width: 50, align: 'right' });

        currentY += 16;
        let totalUnits = 0;
        let totalLbs = 0;
        let totalKg = 0;
        let totalMonto = 0;

        lineItems.forEach((it, idx) => {
            const pres = (it.presentation || '').toLowerCase();
            let factorLbs = 30;
            const mWeight = pres.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
            if (mWeight) {
                factorLbs = parseFloat(mWeight[1]) || 30;
            } else if (pres.includes('55')) factorLbs = 55;
            else if (pres.includes('32')) factorLbs = 32;
            else if (pres.includes('30')) factorLbs = 30;
            else if (pres.includes('20')) factorLbs = 20;
            else if (pres.includes('8') || pres.includes('galon') || pres.includes('galón')) factorLbs = 8;
            else if (pres.includes('4') || pres.includes('medio')) factorLbs = 4;
            else if (pres.includes('2') || pres.includes('litro')) factorLbs = 2;
            else if (pres.includes('0.2') || pres.includes('unidad')) factorLbs = 0.20;

            const rawUnits = it.quantity_units ?? it.units;
            const units = (rawUnits !== undefined && rawUnits !== null && rawUnits !== '' && parseFloat(rawUnits) > 0)
                ? parseFloat(rawUnits)
                : (it.quantity_lbs ? Math.max(1, Math.round(parseFloat(it.quantity_lbs) / factorLbs)) : 0);
            const lbs = it.quantity_lbs ? parseFloat(it.quantity_lbs) : (units * factorLbs);
            const kg = it.quantity_kg ? parseFloat(it.quantity_kg) : (lbs * 0.45359237);
            const precio = parseFloat(it.price_per_lb) || 0;
            const subtotal = lbs * precio;

            totalUnits += units;
            totalLbs += lbs;
            totalKg += kg;
            totalMonto += subtotal;

            if (idx % 2 === 1) {
                doc.rect(35, currentY, 542, 15).fill('#f8fafc');
            }

            doc.fillColor('#334155').font('Helvetica').fontSize(7.5);
            doc.text(String(idx + 1), 40, currentY + 3, { width: 15 });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(it.product_type || 'Huevo Entero Pasteurizado', 60, currentY + 3, { width: 145, ellipsis: true });
            doc.font('Helvetica').fillColor('#334155').text(it.presentation || 'cubeta 30 lb', 210, currentY + 3, { width: 80 });
            doc.font('Helvetica-Bold').fillColor('#4338ca').text(it.lot_code || ord.lot_code || ord.linked_batch_code || 'Por asignar', 295, currentY + 3, { width: 65 });
            doc.fillColor('#0f172a').text(`${units.toLocaleString()} uds`, 365, currentY + 3, { width: 45, align: 'right' });
            doc.text(`${lbs.toLocaleString()} lb`, 415, currentY + 3, { width: 50, align: 'right' });
            doc.text(`${kg.toFixed(2)} kg`, 470, currentY + 3, { width: 45, align: 'right' });
            doc.text(subtotal > 0 ? `$${subtotal.toFixed(2)}` : '$0.00', 520, currentY + 3, { width: 50, align: 'right' });

            currentY += 15;
        });

        // Totales
        doc.rect(35, currentY, 542, 18).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        doc.text('TOTALES DE ENTREGA:', 45, currentY + 5);
        doc.text(`${totalUnits.toLocaleString()} Uds`, 365, currentY + 5, { width: 45, align: 'right' });
        doc.text(`${totalLbs.toLocaleString()} Lbs`, 415, currentY + 5, { width: 50, align: 'right' });
        doc.text(`${totalKg.toFixed(2)} Kg`, 470, currentY + 5, { width: 45, align: 'right' });
        doc.text(totalMonto > 0 ? `$${totalMonto.toFixed(2)}` : '$0.00', 520, currentY + 5, { width: 50, align: 'right' });

        currentY += 28;

        if (ord.notes || ord.delivery_notes) {
            doc.rect(35, currentY, 542, 35).fill('#f1f5f9');
            doc.rect(35, currentY, 542, 35).stroke('#cbd5e1');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('NOTAS E INDICACIONES DE ENTREGA:', 45, currentY + 5);
            doc.font('Helvetica').fontSize(7).fillColor('#475569').text(ord.notes || ord.delivery_notes, 45, currentY + 16, { width: 520 });
            currentY += 45;
        } else {
            currentY += 15;
        }

        currentY = Math.max(currentY + 20, 600);
        doc.rect(35, currentY, 250, 75).stroke('#cbd5e1');
        doc.rect(327, currentY, 250, 75).stroke('#cbd5e1');

        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
        doc.text('DESPACHADO / ENTREGADO POR:', 45, currentY + 8);
        doc.text('RECIBIDO CONFORME (CLIENTE):', 337, currentY + 8);

        doc.font('Helvetica').fontSize(7).fillColor('#475569');
        doc.text(`Motorista: ${ord.route_driver_name || '________________________'}`, 45, currentY + 38);
        doc.text(`Firma: ______________________________`, 45, currentY + 55);

        doc.text(`Nombre: ________________________________`, 337, currentY + 38);
        doc.text(`DUI / Firma: ___________________________`, 337, currentY + 55);

        doc.fontSize(6.5).fillColor('#94a3b8').text(`Comprobante generado el ${new Date().toLocaleString('es-SV')} | Sistema SIPEWEB NOVASAAS`, 35, 740, { align: 'center' });

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=comprobante_entrega_${orderNum}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al generar comprobante de entrega:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getOrderDeliveryReceipt };
