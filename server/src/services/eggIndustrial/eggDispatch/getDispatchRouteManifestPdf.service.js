const { pool, reportPdfHelper, excelService, getSaleRTEEPdfBuffer, PDFDocument } = require('../../../controllers/eggDispatch/shared');

const getDispatchRouteManifestPdf = async (req) => {
    const responseHeaders = {};
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;
        const { format } = req.query;

        // 1. Obtener datos de la ruta y vehículo
        const [routeRows] = await pool.query(
            `SELECT r.*,
                    v.codigo AS vehicle_codigo,
                    v.placa AS vehicle_placa,
                    v.marca AS vehicle_marca,
                    v.modelo AS vehicle_modelo,
                    v.capacidad_peso_lbs AS vehicle_capacidad_peso,
                    v.capacidad_cubetas AS vehicle_capacidad_cubetas,
                    v.tiene_termo_king,
                    u.nombre AS driver_user_nombre
             FROM egg_dispatch_routes r
             LEFT JOIN delivery_vehicles v ON r.vehicle_id = v.id
             LEFT JOIN users u ON r.driver_id = u.id
             WHERE r.id = ? AND r.company_id = ?`,
            [id, company_id]
        );

        if (routeRows.length === 0) {
            return ({ status: 404, body: { message: 'Ruta de despacho no encontrada.' }, headers: responseHeaders });
        }

        const route = routeRows[0];
        const company = await reportPdfHelper.getCompanyInfo(company_id);

        // 2. Obtener paradas con detalle de pedidos y lotes
        const [stops] = await pool.query(
            `SELECT s.*,
                    o.order_number,
                    o.product_type,
                    o.presentation,
                    o.quantity_lbs,
                    o.price_per_lb,
                    o.notes AS order_notes,
                    o.items_json,
                    o.batch_id AS order_batch_id,
                    o.lot_code AS order_lot_code,
                    o.required_delivery_date,
                    b.batch_code_display AS linked_batch_code,
                    COALESCE(s.lot_code, o.lot_code, b.batch_code_display) AS lot_code_display,
                    c.nombre AS customer_name,
                    c.nombre_comercial AS customer_commercial_name,
                    c.nit AS customer_nit,
                    c.nrc AS customer_nrc,
                    c.telefono AS customer_phone,
                    c.direccion AS customer_address,
                    cb.nombre AS branch_name,
                    cb.direccion AS branch_address,
                    cb.departamento AS branch_departamento,
                    cb.municipio AS branch_municipio,
                    cb.telefono AS branch_phone,
                    cb.contacto_nombre AS branch_contact_person,
                    cb.contacto_telefono AS branch_contact_phone,
                    cb.indicaciones_entrega AS branch_delivery_notes
             FROM egg_dispatch_stops s
             JOIN egg_customer_orders o ON s.order_id = o.id
             LEFT JOIN egg_production_batches b ON o.batch_id = b.id
             JOIN customers c ON s.customer_id = c.id
             LEFT JOIN customer_branches cb ON s.customer_branch_id = cb.id
             WHERE s.dispatch_route_id = ?
             ORDER BY s.orden_visita ASC, s.id ASC`,
            [id]
        );

        // 3. Aplanar items para el manifiesto
        const flattenedRows = [];
        let totalGeneralLbs = 0;
        let totalGeneralCubetas = 0;

        stops.forEach((stop, stopIdx) => {
            let items = [];
            if (stop.items_json) {
                try {
                    const parsed = typeof stop.items_json === 'string' ? JSON.parse(stop.items_json) : stop.items_json;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        items = parsed;
                    }
                } catch (e) {}
            }

            if (items.length === 0) {
                items = [{
                    product_type: stop.product_type || 'Ovoproducto Líquido',
                    presentation: stop.presentation || 'cubeta 30LB',
                    quantity_lbs: stop.quantity_lbs || 0,
                    lot_code: stop.lot_code_display || '---'
                }];
            }

            const clientDisplayName = (stop.customer_commercial_name || stop.customer_name || 'CLIENTE').toUpperCase();
            const branchText = stop.branch_name ? `${stop.branch_name}${stop.branch_address ? ' - ' + stop.branch_address : ''}` : (stop.customer_address || 'Sucursal Principal');
            const contactText = stop.branch_contact_person ? `${stop.branch_contact_person} (${stop.branch_contact_phone || stop.branch_phone || stop.customer_phone || ''})` : (stop.customer_phone || '');
            const orderDateStr = reportPdfHelper.formatDate(stop.required_delivery_date || route.fecha_despacho);
            const orderNumStr = stop.order_number || `PED-${String(stop.order_id).padStart(5, '0')}`;

            items.forEach((it, itIdx) => {
                const lbs = parseFloat(it.quantity_lbs) || 0;
                const cubetas = Math.ceil(lbs / 30);
                totalGeneralLbs += lbs;
                totalGeneralCubetas += cubetas;

                flattenedRows.push({
                    stopIndex: stopIdx + 1,
                    isFirstItemOfStop: itIdx === 0,
                    itemCountInStop: items.length,
                    fecha: orderDateStr,
                    cliente: clientDisplayName,
                    sucursal_direccion: branchText,
                    contacto: contactText,
                    pedido: orderNumStr,
                    prioridad: stop.prioridad || 'normal',
                    producto: it.product_type || 'Ovoproducto Líquido',
                    presentacion: it.presentation || 'cubeta 30LB',
                    cantidad_lbs: lbs,
                    cubetas: cubetas,
                    lote: it.lot_code || stop.lot_code_display || '---',
                    estado: stop.estado_entrega || 'pendiente'
                });
            });
        });

        // ==========================================
        // EXPORTACIÓN A EXCEL (si format === 'excel')
        // ==========================================
        if (format === 'excel') {
            const excelColumns = [
                { header: 'N° Visita', key: 'stopIndex', width: 10 },
                { header: 'Fecha Entrega', key: 'fecha', width: 14 },
                { header: 'Cliente', key: 'cliente', width: 32 },
                { header: 'Sucursal / Dirección', key: 'sucursal_direccion', width: 35 },
                { header: 'Contacto / Tel.', key: 'contacto', width: 25 },
                { header: 'N° Pedido', key: 'pedido', width: 14 },
                { header: 'Producto', key: 'producto', width: 30 },
                { header: 'Presentación', key: 'presentacion', width: 18 },
                { header: 'Cantidad (Lbs)', key: 'cantidad_lbs', width: 16 },
                { header: 'Cubetas Est.', key: 'cubetas', width: 14 },
                { header: 'Lote de Producción', key: 'lote', width: 22 },
                { header: 'Estado Entrega', key: 'estado', width: 15 }
            ];

            const excelData = flattenedRows.map(r => ({
                stopIndex: r.stopIndex,
                fecha: r.fecha,
                cliente: r.cliente,
                sucursal_direccion: r.sucursal_direccion,
                contacto: r.contacto,
                pedido: r.pedido,
                producto: r.producto,
                presentacion: r.presentacion,
                cantidad_lbs: r.cantidad_lbs,
                cubetas: r.cubetas,
                lote: r.lote,
                estado: r.estado.toUpperCase()
            }));

            // Fila de totales
            excelData.push({
                stopIndex: '',
                fecha: '',
                cliente: 'TOTALES DE RUTA',
                sucursal_direccion: '',
                contacto: '',
                pedido: `${stops.length} Paradas`,
                producto: '',
                presentacion: '',
                cantidad_lbs: totalGeneralLbs,
                cubetas: totalGeneralCubetas,
                lote: '',
                estado: ''
            });

            const buffer = await excelService.createExcelBuffer({
                title: `MANIFIESTO DE RUTA ${route.codigo_ruta} - ${reportPdfHelper.formatDate(route.fecha_despacho)}`,
                sheets: [
                    {
                        name: 'Listado Despacho',
                        columns: excelColumns,
                        data: excelData
                    }
                ]
            });

            return { status: 200, body: buffer, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Manifiesto.xlsx"' } };
        }

        // ==========================================
        // GENERACIÓN DE PDF FORMAL (Landscape)
        // ==========================================
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const pageWidth = 792;
        const pageHeight = 612;
        const margin = 30;
        const contentWidth = pageWidth - margin * 2; // 732

        // Función para dibujar encabezado de página
        const drawPageHeader = () => {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b').text(`Emisión: ${dateStr} ${timeStr}`, margin, 18);

            // Razón social
            const companyName = (company?.razon_social || company?.nombre_comercial || 'EMPRESA INDUSTRIAL').toUpperCase();
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, margin, 18, { align: 'center', width: contentWidth });

            // Título
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text('MANIFIESTO DE CARGA Y HOJA DE RUTA DE DESPACHO', margin, 31, { align: 'center', width: contentWidth });

            // Identificadores fiscales
            const taxLine = `NRC: ${company?.nrc || 'N/A'}  |  NIT: ${company?.nit || 'N/A'}  |  PBX: ${company?.telefono || 'N/A'}`;
            doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(taxLine, margin, 43, { align: 'center', width: contentWidth });

            // Caja resumen de metadatos de la ruta
            const boxY = 56;
            const boxH = 34;
            doc.rect(margin, boxY, contentWidth, boxH).fill('#f8fafc');
            doc.rect(margin, boxY, contentWidth, boxH).stroke('#cbd5e1');

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('CÓDIGO RUTA:', margin + 8, boxY + 6);
            doc.font('Helvetica-Bold').fillColor('#4f46e5').text(route.codigo_ruta || 'RUTA-S/N', margin + 70, boxY + 6);

            doc.font('Helvetica-Bold').fillColor('#0f172a').text('FECHA DESPACHO:', margin + 8, boxY + 19);
            doc.font('Helvetica').fillColor('#334155').text(reportPdfHelper.formatDate(route.fecha_despacho), margin + 85, boxY + 19);

            doc.font('Helvetica-Bold').fillColor('#0f172a').text('CAMIÓN / PLACA:', margin + 165, boxY + 6);
            const vehTxt = `${route.vehicle_codigo || 'CAMIÓN'} (${route.vehicle_placa || 'S/P'}) ${route.tiene_termo_king ? '• TERMO-KING' : ''}`;
            doc.font('Helvetica').fillColor('#334155').text(vehTxt, margin + 245, boxY + 6);

            doc.font('Helvetica-Bold').fillColor('#0f172a').text('MOTORISTA / TEL:', margin + 165, boxY + 19);
            const driverTxt = `${route.driver_name || route.driver_user_nombre || 'No Asignado'} ${route.driver_phone ? '- Tel: ' + route.driver_phone : ''}`;
            doc.font('Helvetica').fillColor('#334155').text(driverTxt, margin + 245, boxY + 19);

            doc.font('Helvetica-Bold').fillColor('#0f172a').text('TOTAL PARADAS:', margin + 490, boxY + 6);
            doc.font('Helvetica-Bold').fillColor('#4f46e5').text(`${stops.length} Clientes / Entregas`, margin + 565, boxY + 6);

            doc.font('Helvetica-Bold').fillColor('#0f172a').text('CARGA PROGRAMADA:', margin + 490, boxY + 19);
            doc.font('Helvetica-Bold').fillColor('#059669').text(`${parseFloat(route.total_peso_lbs || totalGeneralLbs).toLocaleString()} Lbs  (${route.total_cubetas || totalGeneralCubetas} Cubetas)`, margin + 585, boxY + 19);

            // Cabecera de la tabla de paradas
            const tableHeaderY = boxY + boxH + 6;
            drawTableHeader(tableHeaderY);
            return tableHeaderY + 16;
        };

        // Definición de anchos de columna (Total: 732pt)
        const colW = {
            num: 22,        // # Visita
            fecha: 48,      // Fecha
            cliente: 162,   // Cliente / Sucursal / Contacto
            pedido: 50,     // N° Pedido
            producto: 125,  // Producto
            pres: 65,       // Presentación
            lbs: 45,        // Libras
            cubetas: 40,    // Cubetas
            lote: 75,       // Lote de producción
            firma: 100      // Firma / Sello Recibido
        };

        const colX = {
            num: margin,
            fecha: margin + colW.num,
            cliente: margin + colW.num + colW.fecha,
            pedido: margin + colW.num + colW.fecha + colW.cliente,
            producto: margin + colW.num + colW.fecha + colW.cliente + colW.pedido,
            pres: margin + colW.num + colW.fecha + colW.cliente + colW.pedido + colW.producto,
            lbs: margin + colW.num + colW.fecha + colW.cliente + colW.pedido + colW.producto + colW.pres,
            cubetas: margin + colW.num + colW.fecha + colW.cliente + colW.pedido + colW.producto + colW.pres + colW.lbs,
            lote: margin + colW.num + colW.fecha + colW.cliente + colW.pedido + colW.producto + colW.pres + colW.lbs + colW.cubetas,
            firma: margin + colW.num + colW.fecha + colW.cliente + colW.pedido + colW.producto + colW.pres + colW.lbs + colW.cubetas + colW.lote
        };

        const drawTableHeader = (y) => {
            doc.rect(margin, y, contentWidth, 16).fill('#1e293b');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#ffffff');

            doc.text('#', colX.num, y + 5, { width: colW.num, align: 'center' });
            doc.text('FECHA', colX.fecha, y + 5, { width: colW.fecha, align: 'center' });
            doc.text('CLIENTE / DESTINO / CONTACTO', colX.cliente + 3, y + 5, { width: colW.cliente - 6, align: 'left' });
            doc.text('PEDIDO #', colX.pedido, y + 5, { width: colW.pedido, align: 'center' });
            doc.text('PRODUCTO(S)', colX.producto + 3, y + 5, { width: colW.producto - 6, align: 'left' });
            doc.text('PRESENTACIÓN', colX.pres + 2, y + 5, { width: colW.pres - 4, align: 'left' });
            doc.text('LBS', colX.lbs - 3, y + 5, { width: colW.lbs, align: 'right' });
            doc.text('CUB.', colX.cubetas - 3, y + 5, { width: colW.cubetas, align: 'right' });
            doc.text('LOTE PROD.', colX.lote, y + 5, { width: colW.lote, align: 'center' });
            doc.text('FIRMA / SELLO RECIBIDO', colX.firma, y + 5, { width: colW.firma, align: 'center' });
        };

        let currentY = drawPageHeader();

        // Renderizado de cada fila
        flattenedRows.forEach((row, idx) => {
            // Estimar altura de fila
            const rowH = row.isFirstItemOfStop ? 26 : 18;

            // Salto defensivo de página si se acerca al final
            if (currentY + rowH > pageHeight - 65) {
                doc.addPage();
                currentY = drawPageHeader();
            }

            // Fondo alternado suave
            if (row.stopIndex % 2 === 0) {
                doc.rect(margin, currentY, contentWidth, rowH).fill('#f8fafc');
            }

            // Borde inferior sutil
            doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(margin, currentY + rowH).lineTo(pageWidth - margin, currentY + rowH).stroke();

            // Si es el primer item de la parada, pintar datos del cliente y parada
            if (row.isFirstItemOfStop) {
                // Número de parada con círculo o número negrita
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(String(row.stopIndex), colX.num, currentY + 4, { width: colW.num, align: 'center' });

                // Fecha
                doc.fontSize(7).font('Helvetica').fillColor('#475569');
                doc.text(row.fecha, colX.fecha, currentY + 4, { width: colW.fecha, align: 'center' });

                // Cliente y destino
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(reportPdfHelper.fitText(doc, row.cliente, colW.cliente - 6), colX.cliente + 3, currentY + 3, { width: colW.cliente - 6 });

                // Sucursal y contacto debajo
                doc.fontSize(6).font('Helvetica').fillColor('#64748b');
                const subLoc = `${row.sucursal_direccion} ${row.contacto ? '| ' + row.contacto : ''}`;
                doc.text(reportPdfHelper.fitText(doc, subLoc, colW.cliente - 6), colX.cliente + 3, currentY + 13, { width: colW.cliente - 6 });

                // Pedido
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text(row.pedido, colX.pedido, currentY + 4, { width: colW.pedido, align: 'center' });

                // Recuadro para firma y sello en la columna de la derecha
                doc.rect(colX.firma + 4, currentY + 2, colW.firma - 8, rowH - 4).stroke('#cbd5e1');
                doc.fontSize(5.5).font('Helvetica').fillColor('#94a3b8').text('Firma y Sello', colX.firma + 6, currentY + rowH - 8, { width: colW.firma - 12, align: 'center' });
            }

            // Datos del producto (se muestran en cada fila)
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(reportPdfHelper.fitText(doc, `• ${row.producto}`, colW.producto - 6), colX.producto + 3, currentY + 4, { width: colW.producto - 6 });

            doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
            doc.text(reportPdfHelper.fitText(doc, row.presentacion, colW.pres - 4), colX.pres + 2, currentY + 4, { width: colW.pres - 4 });

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(row.cantidad_lbs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), colX.lbs - 3, currentY + 4, { width: colW.lbs, align: 'right' });

            doc.fontSize(7).font('Helvetica').fillColor('#475569');
            doc.text(String(row.cubetas), colX.cubetas - 3, currentY + 4, { width: colW.cubetas, align: 'right' });

            // Lote con badge visual o texto negrita
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(row.lote !== '---' ? '#047857' : '#94a3b8');
            doc.text(row.lote, colX.lote, currentY + 4, { width: colW.lote, align: 'center' });

            currentY += rowH;
        });

        // ==========================================
        // FILA DE TOTALES Y CIERRE
        // ==========================================
        if (currentY + 65 > pageHeight - 35) {
            doc.addPage();
            currentY = drawPageHeader();
        }

        currentY += 4;
        doc.rect(margin, currentY, contentWidth, 18).fill('#f1f5f9');
        doc.rect(margin, currentY, contentWidth, 18).stroke('#cbd5e1');

        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`TOTALES GENERALES DE LA RUTA (${stops.length} PARADAS / ${flattenedRows.length} ÍTEMS):`, margin + 10, currentY + 5);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`${totalGeneralLbs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs`, colX.lbs - 8, currentY + 5, { width: colW.lbs + 5, align: 'right' });

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
        doc.text(`${totalGeneralCubetas} Cubetas`, colX.cubetas - 5, currentY + 5, { width: colW.cubetas + 15, align: 'right' });

        currentY += 24;

        // Bloques de firma obligatorios de control de despacho
        const signY = currentY;
        const signW = 200;

        // Bloque 1: Despachador de Planta
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(margin + 40, signY + 26).lineTo(margin + 40 + signW, signY + 26).stroke();
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e293b').text('DESPACHADO POR (BODEGA / PLANTA)', margin + 40, signY + 29, { width: signW, align: 'center' });
        doc.fontSize(5.5).font('Helvetica').fillColor('#64748b').text('Nombre, Firma y Hora de Salida', margin + 40, signY + 37, { width: signW, align: 'center' });

        // Bloque 2: Transportista / Conductor
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(pageWidth - margin - 40 - signW, signY + 26).lineTo(pageWidth - margin - 40, signY + 26).stroke();
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e293b').text('MOTORISTA / TRANSPORTISTA', pageWidth - margin - 40 - signW, signY + 29, { width: signW, align: 'center' });
        doc.fontSize(5.5).font('Helvetica').fillColor('#64748b').text('Recibí Conforme Carga para Entrega', pageWidth - margin - 40 - signW, signY + 37, { width: signW, align: 'center' });

        // Numeración de páginas
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        let finalBuffer = await getBuffer();

        // Anexar automáticamente los PDFs de DTEs emitidos de las paradas si fue solicitado
        const includeDtes = req.query.include_dtes === 'true' || req.query.include_dtes === '1';
        if (includeDtes) {
            try {
                const [saleRows] = await pool.query(
                    `SELECT DISTINCT sh.id, sh.numero_control, s.orden_visita
                     FROM egg_dispatch_stops s
                     JOIN sales_headers sh ON s.sale_id = sh.id
                     LEFT JOIN dtes d ON d.venta_id = sh.id
                     WHERE s.dispatch_route_id = ?
                       AND (sh.sello_recepcion IS NOT NULL OR d.status = 'ACCEPTED')
                     ORDER BY s.orden_visita ASC, s.id ASC`,
                    [id]
                );

                if (saleRows.length > 0) {
                    const mergedDoc = await PDFDocument.load(finalBuffer);

                    for (const sRow of saleRows) {
                        try {
                            const dteBuf = await getSaleRTEEPdfBuffer(sRow.id, company_id);
                            if (dteBuf && dteBuf.length > 0) {
                                const dteDoc = await PDFDocument.load(dteBuf);
                                const copiedPages = await mergedDoc.copyPages(dteDoc, dteDoc.getPageIndices());
                                copiedPages.forEach(page => mergedDoc.addPage(page));
                            }
                        } catch (dteErr) {
                            console.error(`[ManifestPDF] Advertencia al adjuntar DTE para venta ${sRow.id}:`, dteErr.message);
                        }
                    }

                    finalBuffer = Buffer.from(await mergedDoc.save());
                }
            } catch (mergeErr) {
                console.error('[ManifestPDF] Error fusionando PDFs de DTEs:', mergeErr.message);
            }
        }

        responseHeaders['Content-Type'] = 'application/pdf';
        responseHeaders['Content-Disposition'] = `inline; filename="Manifiesto_${route.codigo_ruta}.pdf"`;
        return ({ status: 200, body: finalBuffer, headers: responseHeaders });
    } catch (error) {
        console.error('Error al generar manifiesto de ruta:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = getDispatchRouteManifestPdf;
