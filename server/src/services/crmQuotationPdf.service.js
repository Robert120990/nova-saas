const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const HEADER_IMAGE_PATH = path.join(__dirname, '../assets/quotations/eggcelent_header.png');

const MONTH_NAMES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatDateFormal(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} de ${MONTH_NAMES_ES[monthIndex] || ''} ${year}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatMoney(val) {
    const n = parseFloat(val) || 0;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Genera el documento oficial de Cotización estilo Eggcelent / ANDELSA
 * idéntico a la plantilla Word corporativa.
 */
function generateQuotationPdf(quotation, items = []) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 0, bottom: 0, left: 40, right: 40 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 612;
            const pageHeight = 792;
            const contentLeft = 40;
            const contentWidth = 532;
            const contentRight = contentLeft + contentWidth;

            // 1. HEADER BANNER (Full-bleed ancho superior)
            if (fs.existsSync(HEADER_IMAGE_PATH)) {
                doc.image(HEADER_IMAGE_PATH, 0, 0, { width: pageWidth, height: 68 });
            }

            // 2. FECHA Y CIUDAD
            let curY = 80;
            const dateText = `Rosario de La Paz, ${formatDateFormal(quotation.date)}`;
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(dateText, contentLeft, curY, { align: 'left' });

            // Número de cotización alineado a la derecha
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text(`Cotización N°: ${quotation.quote_number || 'COT-BORRADOR'}`, contentLeft, curY, {
                width: contentWidth,
                align: 'right'
            });

            // 3. DESTINATARIO
            curY += 20;
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('Estimados', contentLeft, curY);
            curY += 13;

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(quotation.customer_name || 'Cliente Estimado', contentLeft, curY);
            curY += 14;

            if (quotation.customer_contact) {
                doc.fontSize(9).font('Helvetica').fillColor('#475569');
                doc.text(`Atención: ${quotation.customer_contact}`, contentLeft, curY);
                curY += 12;
            }

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('Presente', contentLeft, curY);
            curY += 15;

            // 4. TEXTO INTRODUCTORIO INSTITUCIONAL ANDELSA
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('Reciban un cordial saludo de Alimentos Nutricionales de El Salvador S.A. de C.V.', contentLeft, curY);
            curY += 12;

            doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
            const introP1 = 'Agradecemos la oportunidad de ofrecerles nuestros productos. Alimentos Nutricionales de El Salvador es una empresa industrial especializada en la fabricación y formulación de huevo líquido pasteurizado para la industria de restaurantes, hoteles y panaderías con más de 25 años de experiencia, pioneros en Centroamérica.';
            doc.text(introP1, contentLeft, curY, { width: contentWidth, align: 'justify', lineGap: 1.5 });
            curY = doc.y + 4;

            const introP2 = 'ANDELSA cuenta con certificación HACCP, lo que garantiza procesos controlados y apegados a los más altos estándares de inocuidad y calidad para brindarles un servicio superior. Contamos con las instalaciones, tecnología y personal idóneo para el manejo óptimo de los productos.';
            doc.text(introP2, contentLeft, curY, { width: contentWidth, align: 'justify', lineGap: 1.5 });
            curY = doc.y + 5;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('Para lo cual estamos presentando nuestra propuesta del producto de su interés:', contentLeft, curY);
            curY += 14;

            // 5. TABLA DE PRODUCTOS
            const colProductW = 155;
            const colPresW = 105;
            const colQtyW = 42;
            const colPriceW = 80;
            const colTotalW = 75;
            const colNotesW = 75;

            // Header de la tabla
            const tableHeaderHeight = 18;
            doc.rect(contentLeft, curY, contentWidth, tableHeaderHeight).fill('#f1f5f9');
            doc.rect(contentLeft, curY, contentWidth, tableHeaderHeight).strokeColor('#cbd5e1').lineWidth(0.75).stroke();

            let colX = contentLeft;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');

            doc.text('PRODUCTO', colX + 4, curY + 5, { width: colProductW - 6, align: 'left' });
            colX += colProductW;

            doc.text('PRESENTACIÓN', colX + 4, curY + 5, { width: colPresW - 6, align: 'left' });
            colX += colPresW;

            doc.text('CANT.', colX + 2, curY + 5, { width: colQtyW - 4, align: 'center' });
            colX += colQtyW;

            doc.text('PRECIO UNIT. (+IVA)', colX + 2, curY + 5, { width: colPriceW - 4, align: 'right' });
            colX += colPriceW;

            doc.text('SUBTOTAL', colX + 2, curY + 5, { width: colTotalW - 4, align: 'right' });
            colX += colTotalW;

            doc.text('NOTAS / DETALLE', colX + 4, curY + 5, { width: colNotesW - 6, align: 'left' });

            curY += tableHeaderHeight;

            // Filas de productos
            items.forEach((item, index) => {
                const rowHeight = 20;
                const isEven = index % 2 === 0;

                if (isEven) {
                    doc.rect(contentLeft, curY, contentWidth, rowHeight).fill('#ffffff');
                } else {
                    doc.rect(contentLeft, curY, contentWidth, rowHeight).fill('#f8fafc');
                }
                doc.rect(contentLeft, curY, contentWidth, rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

                let rx = contentLeft;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(item.product_name || 'PRODUCTO', rx + 4, curY + 5, { width: colProductW - 6, ellipsis: true });
                rx += colProductW;

                doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
                doc.text(item.presentation || 'Estándar', rx + 4, curY + 5, { width: colPresW - 6, ellipsis: true });
                rx += colPresW;

                doc.fontSize(8).font('Helvetica').fillColor('#0f172a');
                const qtyVal = parseFloat(item.quantity) || 1;
                doc.text(qtyVal.toString(), rx + 2, curY + 5, { width: colQtyW - 4, align: 'center' });
                rx += colQtyW;

                const priceVal = parseFloat(item.unit_price) || 0;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(formatMoney(priceVal), rx + 2, curY + 5, { width: colPriceW - 4, align: 'right' });
                rx += colPriceW;

                const itemSubtotal = parseFloat(item.subtotal || item.total) || (qtyVal * priceVal);
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(formatMoney(itemSubtotal), rx + 2, curY + 5, { width: colTotalW - 4, align: 'right' });
                rx += colTotalW;

                doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b');
                doc.text(item.notes || '', rx + 4, curY + 5, { width: colNotesW - 6, ellipsis: true });

                curY += rowHeight;
            });

            // Resumen de Totales
            curY += 5;
            const totalsBoxWidth = 180;
            const totalsX = contentLeft + contentWidth - totalsBoxWidth;

            doc.fontSize(8).font('Helvetica').fillColor('#475569');
            doc.text('Subtotal:', totalsX, curY, { width: 90, align: 'left' });
            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(formatMoney(quotation.subtotal), totalsX + 90, curY, { width: 90, align: 'right' });
            curY += 12;

            doc.font('Helvetica').fillColor('#475569');
            doc.text('IVA (13%):', totalsX, curY, { width: 90, align: 'left' });
            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(formatMoney(quotation.tax_amount), totalsX + 90, curY, { width: 90, align: 'right' });
            curY += 12;

            doc.rect(totalsX, curY, totalsBoxWidth, 16).fill('#f1f5f9');
            doc.rect(totalsX, curY, totalsBoxWidth, 16).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
            doc.text('TOTAL COTIZADO:', totalsX + 5, curY + 4, { width: 95, align: 'left' });
            doc.text(formatMoney(quotation.total), totalsX + 90, curY + 4, { width: 85, align: 'right' });
            curY += 22;

            // 6. COMPROMISOS Y CONDICIONES (Recuadro Oficial)
            const boxPadding = 7;
            const commitmentsY = curY;
            const boxHeight = 84;

            doc.rect(contentLeft, commitmentsY, contentWidth, boxHeight).fill('#f8fafc');
            doc.rect(contentLeft, commitmentsY, contentWidth, boxHeight).strokeColor('#cbd5e1').lineWidth(0.75).stroke();

            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('NUESTROS COMPROMISOS Y CONDICIONES COMERCIALES:', contentLeft + boxPadding, commitmentsY + boxPadding);

            let commY = commitmentsY + boxPadding + 13;
            doc.fontSize(7.5).font('Helvetica').fillColor('#334155');

            // Regla de retorno de envases (Requerimiento explícito)
            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('• Política de Envases: ', contentLeft + boxPadding, commY, { continued: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text('Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son ', { continued: true });
            doc.font('Helvetica-Bold').fillColor('#b91c1c');
            doc.text('RETORNABLES', { continued: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text(' (deben devolverse limpias y en buen estado en cada despacho). Los demás envases (galones, medios galones, litros, bolsas) son descartables de un solo uso y no aplican para retorno.');
            commY = doc.y + 2.5;

            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('• Calidad Certificada: ', contentLeft + boxPadding, commY, { continued: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text('Se emite Certificado de Calidad e inocuidad física, química y microbiológica en cada entrega bajo certificación HACCP.');
            commY = doc.y + 2.5;

            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('• Vigencia de la Oferta: ', contentLeft + boxPadding, commY, { continued: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text(`Oferta válida por ${quotation.validity_days || 30} días a partir de su emisión (Vencimiento: ${formatDateShort(quotation.expiration_date)}).`);
            commY = doc.y + 2.5;

            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('• Condiciones de Pago y Entrega: ', contentLeft + boxPadding, commY, { continued: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text(`${quotation.payment_terms || 'Contado'}. Entrega: ${quotation.delivery_time || 'Según programación'}.`);

            curY = commitmentsY + boxHeight + 8;

            // 7. DESPEDIDA Y SECCIÓN DE FIRMA ELECTRÓNICA
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('A la espera de poder servirles.', contentLeft, curY);
            curY += 12;

            // Bloque de Firma
            const sigWidth = 170;
            const sigX = contentLeft;

            // Si hay firma electrónica en Base64, dibujarla sobre la línea
            if (quotation.signature_data && quotation.signature_data.startsWith('data:image')) {
                try {
                    const base64Data = quotation.signature_data.replace(/^data:image\/\w+;base64,/, '');
                    const sigBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(sigBuffer, sigX + 10, curY, { fit: [140, 38], align: 'center' });
                    curY += 40;
                } catch (sigErr) {
                    console.warn('Error al dibujar firma base64:', sigErr.message);
                    curY += 24;
                }
            } else {
                curY += 24;
            }

            // Línea de firma
            doc.moveTo(sigX, curY).lineTo(sigX + sigWidth, curY).strokeColor('#94a3b8').lineWidth(1).stroke();
            curY += 4;

            const authorName = quotation.signature_author_name || quotation.created_by_name || 'Raul Rafael Sosa M.';
            const authorTitle = quotation.signature_author_title || 'Ejecutivo Comercial';
            const authorPhone = quotation.signature_author_phone || '(503) 7060-5040';

            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`Att. ${authorName}`, sigX, curY);
            curY += 10;

            doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
            doc.text(authorTitle, sigX, curY);
            curY += 9;

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(authorPhone, sigX, curY);
            curY += 9;

            if (quotation.signature_date) {
                doc.fontSize(6.5).font('Helvetica-Oblique').fillColor('#94a3b8');
                doc.text(`Firma digital registrada: ${formatDateShort(quotation.signature_date)}`, sigX, curY);
            }

            // 8. FOOTER VECTORIAL DIGITALIZADO (Texto nítido, teléfono e iconos)
            // Separador superior sutil
            doc.moveTo(contentLeft, pageHeight - 46).lineTo(contentRight, pageHeight - 46).strokeColor('#e2e8f0').lineWidth(0.8).stroke();

            // Lado Izquierdo: Razón Social y Dirección Oficial
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a')
               .text('ALIMENTOS NUTRICIONALES DE EL SALVADOR S.A DE C.V', contentLeft, pageHeight - 39, { width: 340 });

            doc.font('Helvetica').fontSize(6.5).fillColor('#475569')
               .text('Antigua Carretera a Zacatecoluca km. 38.5 Cantón Asunción Amate, El Rosario, Dpto. de La Paz, El Salvador. C.A.', contentLeft, pageHeight - 28, { width: 350 });

            // Lado Derecho: Teléfono de Contacto
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
               .text('+503 2330-5800', contentRight - 160, pageHeight - 39, { width: 160, align: 'right' });

            // Redes Sociales (@eggcelentsv + Badges Naranjas Vectoriales)
            const fbX = contentRight - 27;
            const igX = contentRight - 12;
            const badgeY = pageHeight - 27;

            // Texto @eggcelentsv
            doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
               .text('@eggcelentsv', contentRight - 180, pageHeight - 26, { width: 148, align: 'right' });

            // Badge Facebook (recuadro redondeado naranja con 'f' blanca)
            doc.roundedRect(fbX, badgeY, 12, 12, 2.5).fill('#EA991C');
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
               .text('f', fbX + 3.5, badgeY + 1.2);

            // Badge Instagram (recuadro redondeado naranja con cámara vectorial blanca)
            doc.roundedRect(igX, badgeY, 12, 12, 2.5).fill('#EA991C');
            doc.roundedRect(igX + 2, badgeY + 2, 8, 8, 2).strokeColor('#ffffff').lineWidth(0.9).stroke();
            doc.circle(igX + 6, badgeY + 6, 1.8).strokeColor('#ffffff').lineWidth(0.8).stroke();
            doc.circle(igX + 8, badgeY + 3.8, 0.45).fill('#ffffff');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateQuotationPdf
};
