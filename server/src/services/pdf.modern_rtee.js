/**
 * MODERN DTE PDF GENERATION (RTEE) - NOVA SAAS EXECUTIVE DESIGN SYSTEM
 * Rediseño estético corporativo de alto impacto:
 * - Cabecera simétrica con Bloque de Emisor estructurado y Tarjeta DTE balanceada
 * - Paleta de alto contraste (Slate 900 / Slate 800 / Blanco puro)
 * - Eliminación de textos lavados o tenues
 * - Tarjetas con bordes nítidos (#cbd5e1) y fondos blancos puros
 * - Soporte 100% normativo para DTE 01, 03, 07, combustibles, FOVIAL/COTRANS, QR y anulación
 */

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const reportPdfHelper = require('../utils/reportPdfHelper');
const { numberToWords } = require('../utils/numberToWords');

// Paleta corporativa de alto contraste
const THEME = {
    navyDark: '#0f172a',      // Slate 900 (Títulos principales, cabeceras de tabla, total a pagar)
    navyHeader: '#1e293b',    // Slate 800 (Encabezados de tarjetas)
    indigoAccent: '#312e81',  // Indigo 900 (Líneas de acento ejecutivas)
    textDark: '#0f172a',      // Texto principal de alto contraste
    textMedium: '#334155',    // Slate 700 (Etiquetas secundarias, nítidas y legibles)
    textMuted: '#475569',     // Slate 600 (Metadatos legibles)
    borderCard: '#cbd5e1',    // Slate 300 (Bordes definidos de tarjetas)
    borderSubtle: '#e2e8f0',  // Slate 200 (Divisores internos)
    bgLight: '#f8fafc',       // Slate 50 (Filas alternadas)
    bgCard: '#ffffff',        // Blanco puro para tarjetas
    badgeBg: '#f1f5f9',       // Slate 100 (Fondo de badges)
    prodGreen: '#047857',     // Esmeralda 700 (Producción)
    prodGreenBg: '#ecfdf5',
    testAmber: '#b45309',     // Ámbar 700 (Pruebas)
    testAmberBg: '#fef3c7',
    dangerRed: '#dc2626',     // Rojo 600 (Descuentos y anulado)
    dangerRedBg: '#fef2f2'
};

const dteTypeLabels = {
    '01': 'Factura',
    '03': 'Comprobante de Crédito Fiscal',
    '04': 'Nota de Remisión',
    '05': 'Nota de Crédito',
    '06': 'Nota de Débito',
    '07': 'Comprobante de Retención',
    '08': 'Comprobante de Liquidación',
    '09': 'Documento Contable de Liquidación',
    '11': 'Factura de Exportación',
    '14': 'Factura de Sujeto Excluido',
    '15': 'Comprobante de Donación'
};

/**
 * Generates a modern redesigned PDF buffer for the DTE Representation (RTEE)
 */
const generateRTEEModern = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'LETTER', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const { emisor, receptor, dte, venta, items } = data;
            const startX = 30;
            const pageWidth = doc.page.width - 60; // 552pt

            // ==========================================
            // 1. CABECERA SIMÉTRICA (Emisor Card + DTE Card)
            // ==========================================
            const headerY = 24;
            const headerH = 124;
            const isProd = dte.ambiente === '01';

            // --- 1.A Tarjeta del Emisor (Lado Izquierdo: 318pt) ---
            const emisorBoxX = startX;
            const emisorBoxW = 318;

            // Contenedor blanco con borde definido
            doc.roundedRect(emisorBoxX, headerY, emisorBoxW, headerH, 5)
               .lineWidth(1)
               .strokeColor(THEME.borderCard)
               .fillColor(THEME.bgCard)
               .fillAndStroke();

            // Línea de acento superior índigo
            doc.roundedRect(emisorBoxX, headerY, emisorBoxW, 3, 2)
               .fillColor(THEME.indigoAccent)
               .fill();

            // Resolución y renderizado del logo
            let logoToRender = emisor.logoPath || emisor.logo_url || emisor.logo;
            if (logoToRender && typeof logoToRender === 'string') {
                if (!fs.existsSync(logoToRender)) {
                    const cleanPath = logoToRender.startsWith('/') ? logoToRender.substring(1) : logoToRender;
                    const alt1 = path.join(__dirname, '..', '..', cleanPath);
                    const fileName = path.basename(cleanPath);
                    const alt2 = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(alt1)) logoToRender = alt1;
                    else if (fs.existsSync(alt2)) logoToRender = alt2;
                    else logoToRender = null;
                }
            }

            let hasLogo = false;
            let textStartX = emisorBoxX + 12;
            let textMaxW = emisorBoxW - 24;

            if (logoToRender) {
                try {
                    doc.image(logoToRender, emisorBoxX + 10, headerY + 12, { fit: [92, 54], align: 'center', valign: 'center' });
                    hasLogo = true;
                    textStartX = emisorBoxX + 108;
                    textMaxW = emisorBoxW - 118;
                } catch (imgErr) {
                    hasLogo = false;
                    textStartX = emisorBoxX + 12;
                    textMaxW = emisorBoxW - 24;
                }
            }

            // Nombre comercial / Razón social (Alto contraste)
            doc.fillColor(THEME.navyDark)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text(emisor.nombre ? emisor.nombre.toUpperCase() : 'EMISOR', textStartX, headerY + 9, {
                   width: textMaxW,
                   lineGap: 1
               });

            // Sucursal / Establecimiento destacado
            const sucursalNombre = emisor.sucursal_nombre || emisor.branch_name;
            const isCasaMatriz = emisor.es_casa_matriz === 1 || emisor.es_casa_matriz === true || emisor.tipo_establecimiento === '02';
            const sucursalTipoLabel = isCasaMatriz ? 'CASA MATRIZ' : 'SUCURSAL';

            if (sucursalNombre) {
                doc.fillColor(THEME.indigoAccent)
                   .fontSize(7.5)
                   .font('Helvetica-Bold')
                   .text(`${sucursalTipoLabel}: ${sucursalNombre.toUpperCase()}`, textStartX, doc.y + 1.5, {
                       width: textMaxW,
                       lineGap: 1
                   });
            }

            // Actividad Económica (Giro)
            if (emisor.descActividad) {
                doc.fillColor(THEME.textMedium)
                   .fontSize(6.5)
                   .font('Helvetica')
                   .text(emisor.descActividad, textStartX, doc.y + 1.5, {
                       width: textMaxW,
                       lineGap: 1
                   });
            }

            // Divisor interno en la tarjeta del emisor
            const emisorDividerY = headerY + 68;
            doc.moveTo(emisorBoxX + 10, emisorDividerY)
               .lineTo(emisorBoxX + emisorBoxW - 10, emisorDividerY)
               .lineWidth(0.5)
               .strokeColor(THEME.borderSubtle)
               .stroke();

            // Bloque inferior de la tarjeta del emisor (NIT, NRC, Establecimiento, Punto de Venta, Dirección y Contacto)
            const metaY = emisorDividerY + 5;

            // Fila 1: NIT, NRC, Establecimiento y Punto de Venta
            doc.fillColor(THEME.textMedium)
               .fontSize(7)
               .font('Helvetica-Bold')
               .text('NIT: ', emisorBoxX + 10, metaY, { continued: true })
               .fillColor(THEME.navyDark)
               .text(`${emisor.nit || '—'}    `, { continued: true })
               .fillColor(THEME.textMedium)
               .text('NRC: ', { continued: true })
               .fillColor(THEME.navyDark)
               .text(`${emisor.nrc || '—'}    `, { continued: true });

            const codEstable = emisor.cod_establecimiento || emisor.codEstable || emisor.codEstableMH;
            const codPunto = emisor.cod_punto_venta || emisor.codPuntoVenta || emisor.codPuntoVentaMH;

            if (codEstable) {
                doc.fillColor(THEME.textMedium)
                   .text('ESTABL: ', { continued: true })
                   .fillColor(THEME.navyDark)
                   .text(`${codEstable}    `, { continued: true });
            }
            if (codPunto) {
                doc.fillColor(THEME.textMedium)
                   .text('PTO. VTA: ', { continued: true })
                   .fillColor(THEME.navyDark)
                   .text(`${codPunto}`, { continued: false });
            } else {
                doc.text('', { continued: false });
            }

            // Fila 2: Dirección de la Sucursal / Casa Matriz con etiqueta explícita
            const dirLabel = isCasaMatriz ? 'DIR. MATRIZ: ' : 'DIR. SUCURSAL: ';
            const emisorUbicacion = emisor.direccion_completa || [
                emisor.direccion?.complemento || emisor.direccion || '',
                emisor.municipio_nombre || emisor.direccion?.municipio_nombre || '',
                emisor.departamento_nombre || emisor.direccion?.departamento_nombre || ''
            ].filter(Boolean).join(', ');

            doc.fillColor(THEME.textMedium)
               .fontSize(6.8)
               .font('Helvetica-Bold')
               .text(dirLabel, emisorBoxX + 10, metaY + 12, { continued: true })
               .fillColor(THEME.navyDark)
               .font('Helvetica')
               .text(emisorUbicacion || 'El Salvador', {
                   width: emisorBoxW - 20,
                   ellipsis: true
               });

            // Fila 3: Contacto (Teléfono y Correo)
            const contactoTexto = `Tel: ${emisor.telefono || 'N/A'}   •   Email: ${emisor.correo || 'N/A'}`;
            doc.fillColor(THEME.textMuted)
               .fontSize(6.5)
               .font('Helvetica')
               .text(contactoTexto, emisorBoxX + 10, metaY + 23, {
                   width: emisorBoxW - 20,
                   ellipsis: true
               });

            // --- 1.B Tarjeta del DTE (Lado Derecho: 224pt) ---
            const dteBoxX = 358;
            const dteBoxW = pageWidth - (dteBoxX - startX); // 224pt

            // Contenedor blanco con borde definido
            doc.roundedRect(dteBoxX, headerY, dteBoxW, headerH, 5)
               .lineWidth(1)
               .strokeColor(THEME.borderCard)
               .fillColor(THEME.bgCard)
               .fillAndStroke();

            // Badge de Ambiente superior
            const badgeH = 18;
            doc.roundedRect(dteBoxX, headerY, dteBoxW, badgeH, 5)
               .fillColor(isProd ? THEME.prodGreen : THEME.testAmber)
               .fill();
            doc.rect(dteBoxX, headerY + badgeH - 5, dteBoxW, 5)
               .fillColor(isProd ? THEME.prodGreen : THEME.testAmber)
               .fill();

            doc.fillColor('#ffffff')
               .fontSize(8)
               .font('Helvetica-Bold')
               .text(isProd ? 'MODO: PRODUCCIÓN' : 'MODO: PRUEBAS (SIN VALIDEZ)', dteBoxX, headerY + 5, {
                   align: 'center',
                   width: dteBoxW
               });

            // Encabezado DTE
            doc.fillColor(THEME.textMuted)
               .fontSize(6.5)
               .font('Helvetica-Bold')
               .text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', dteBoxX + 6, headerY + 24, {
                   align: 'center',
                   width: dteBoxW - 12
               });

            const tipoNombre = (dte.tipoDteNombre || dteTypeLabels[dte.tipoDte] || 'DOCUMENTO TRIBUTARIO').toUpperCase();
            doc.fillColor(THEME.navyDark)
               .fontSize(9.5)
               .font('Helvetica-Bold')
               .text(tipoNombre, dteBoxX + 6, headerY + 34, {
                   align: 'center',
                   width: dteBoxW - 12
               });

            // Divisor sutil
            doc.moveTo(dteBoxX + 8, headerY + 49)
               .lineTo(dteBoxX + dteBoxW - 8, headerY + 49)
               .lineWidth(0.5)
               .strokeColor(THEME.borderSubtle)
               .stroke();

            // Metadatos DTE con alto contraste
            let dteMetaY = headerY + 53;

            // Código de Generación
            doc.fillColor(THEME.textMedium).fontSize(6).font('Helvetica-Bold').text('CÓDIGO DE GENERACIÓN:', dteBoxX + 10, dteMetaY);
            doc.fillColor(THEME.navyDark).fontSize(7).font('Helvetica').text(dte.codigoGeneracion || '—', dteBoxX + 10, dteMetaY + 7);
            dteMetaY += 19;

            // Número de Control
            doc.fillColor(THEME.textMedium).fontSize(6).font('Helvetica-Bold').text('NÚMERO DE CONTROL:', dteBoxX + 10, dteMetaY);
            doc.fillColor(THEME.navyDark).fontSize(7.5).font('Helvetica-Bold').text(dte.numeroControl || '—', dteBoxX + 10, dteMetaY + 7);
            dteMetaY += 19;

            // Sello de Recepción
            doc.fillColor(THEME.textMedium).fontSize(6).font('Helvetica-Bold').text('SELLO DE RECEPCIÓN:', dteBoxX + 10, dteMetaY);
            const selloText = dte.selloRecepcion || 'PENDIENTE DE AUTORIZACIÓN';
            doc.fillColor(dte.selloRecepcion ? THEME.navyDark : THEME.testAmber)
               .fontSize(6.5)
               .font('Helvetica')
               .text(selloText, dteBoxX + 10, dteMetaY + 7, { width: dteBoxW - 20 });

            // ==========================================
            // 2. CINTA TÉCNICA DE METADATOS
            // ==========================================
            const techY = headerY + headerH + 8;
            const techH = 16;

            doc.roundedRect(startX, techY, pageWidth, techH, 3)
               .lineWidth(0.75)
               .strokeColor(THEME.borderCard)
               .fillColor(THEME.badgeBg)
               .fillAndStroke();

            doc.fillColor(THEME.navyDark).fontSize(6.8).font('Helvetica');
            doc.text('Modelo de Emisión: ', startX + 10, techY + 4.5, { continued: true })
               .font('Helvetica-Bold').text(dte.tipoModelo === 1 ? 'Previo' : 'Diferido', { continued: true })
               .font('Helvetica').text('    |    Tipo Transmisión: ', { continued: true })
               .font('Helvetica-Bold').text(dte.tipoOperacion === 1 ? 'Normal' : 'Contingencia', { continued: true })
               .font('Helvetica').text('    |    Moneda: ', { continued: true })
               .font('Helvetica-Bold').text('USD (Dólares de los Estados Unidos de América)');

            // ==========================================
            // 3. TARJETA DEL RECEPTOR / CLIENTE
            // ==========================================
            const receptorY = techY + techH + 8;

            doc.fontSize(8).font('Helvetica');
            const nomH = doc.heightOfString(receptor.nombre || 'Consumidor Final', { width: 315 });
            const dirH = doc.heightOfString(receptor.direccion?.complemento || 'Ciudad', { width: 315 });
            
            let extraFieldsH = 0;
            if (dte.tipoDte === '03') {
                const actH = doc.heightOfString(`Giro: ${receptor.descActividad || receptor.codActividad || 'N/A'}`, { width: 315 });
                extraFieldsH = 12 + actH + 2;
            } else if (dte.tipoDte === '07' || dte.tipoDte === '11') {
                extraFieldsH = 12;
            }

            const calculatedReceptorH = Math.max(76, 26 + nomH + 14 + extraFieldsH + dirH + 8);

            // Contenedor blanco con borde nítido
            doc.roundedRect(startX, receptorY, pageWidth, calculatedReceptorH, 5)
               .lineWidth(1)
               .strokeColor(THEME.borderCard)
               .fillColor(THEME.bgCard)
               .fillAndStroke();

            // Cabecera de la tarjeta del receptor en Slate 800 (Alto contraste profesional)
            const recHeaderH = 18;
            doc.roundedRect(startX, receptorY, pageWidth, recHeaderH, 5)
               .fillColor(THEME.navyHeader)
               .fill();
            doc.rect(startX, receptorY + recHeaderH - 5, pageWidth, 5)
               .fillColor(THEME.navyHeader)
               .fill();

            doc.fillColor('#ffffff')
               .fontSize(7.5)
               .font('Helvetica-Bold')
               .text('DATOS DEL RECEPTOR / CLIENTE', startX + 10, receptorY + 5);

            // Contenido en 2 columnas de alto contraste
            let ry = receptorY + 24;
            const col1X = startX + 10;
            const col1W = 325;
            const col2X = startX + 350;
            const col2W = pageWidth - 360;

            // Nombre
            doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('NOMBRE O RAZÓN SOCIAL:', col1X, ry);
            ry += 8;
            doc.fillColor(THEME.navyDark).fontSize(8.5).font('Helvetica-Bold').text(receptor.nombre || 'Consumidor Final', col1X, ry, { width: col1W });
            ry += nomH + 3;

            // Documento / NIT / NRC
            let docIdentLabel = 'DOCUMENTO:';
            if (dte.tipoDte === '03' && receptor.nit) docIdentLabel = 'NIT:';
            const docVal = receptor.nit || receptor.numDocumento || 'Consumidor Final';

            doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text(`${docIdentLabel} `, col1X, ry, { continued: true });
            doc.fillColor(THEME.navyDark).fontSize(7.5).font('Helvetica-Bold').text(`${docVal}`, { continued: true });

            if (receptor.nrc) {
                doc.fillColor(THEME.textMuted).font('Helvetica-Bold').text('    NRC: ', { continued: true });
                doc.fillColor(THEME.navyDark).font('Helvetica-Bold').text(`${receptor.nrc}`);
            } else {
                doc.text('');
            }
            ry += 11;

            // Giro (Crédito Fiscal)
            if (dte.tipoDte === '03') {
                const actText = receptor.descActividad || receptor.codActividad || 'N/A';
                doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('ACTIVIDAD ECONÓMICA: ', col1X, ry, { continued: true });
                doc.fillColor(THEME.textMedium).fontSize(7).font('Helvetica').text(actText, { width: col1W });
                const actH = doc.heightOfString(`ACTIVIDAD ECONÓMICA: ${actText}`, { width: col1W });
                ry += Math.max(11, actH + 2);
            } else if (dte.tipoDte === '11') {
                doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('PAÍS DESTINO: ', col1X, ry, { continued: true });
                doc.fillColor(THEME.navyDark).fontSize(7.5).font('Helvetica-Bold').text(receptor.nombrePais || receptor.codPais || 'N/A');
                ry += 11;
            }

            // Dirección
            doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('DIRECCIÓN: ', col1X, ry, { continued: true });
            doc.fillColor(THEME.textMedium).fontSize(7).font('Helvetica').text(receptor.direccion?.complemento || 'Ciudad', { width: col1W });

            // Columna 2: Fecha de Emisión y Condición
            let r2y = receptorY + 24;

            doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('FECHA Y HORA DE EMISIÓN:', col2X, r2y);
            r2y += 8;
            doc.fillColor(THEME.navyDark).fontSize(8).font('Helvetica-Bold').text(`${venta.fecha_emision}   ${venta.hora_emision || ''}`, col2X, r2y);
            r2y += 15;

            doc.fillColor(THEME.textMuted).fontSize(6.5).font('Helvetica-Bold').text('CONDICIÓN DE LA OPERACIÓN:', col2X, r2y);
            r2y += 8;
            const esContado = venta.condicion_operacion === 1;
            doc.roundedRect(col2X, r2y, 62, 14, 3)
               .lineWidth(0.75)
               .strokeColor(esContado ? THEME.prodGreen : THEME.testAmber)
               .fillColor(esContado ? THEME.prodGreenBg : THEME.testAmberBg)
               .fillAndStroke();

            doc.fillColor(esContado ? THEME.prodGreen : THEME.testAmber)
               .fontSize(7.5)
               .font('Helvetica-Bold')
               .text(esContado ? 'CONTADO' : 'CRÉDITO', col2X, r2y + 3.5, { align: 'center', width: 62 });

            // ==========================================
            // 4. TABLA DE ÍTEMS / DETALLE
            // ==========================================
            const tableStartY = receptorY + calculatedReceptorH + 10;

            if (dte.tipoDte === '07') {
                // --- 4.A TABLA DTE 07: COMPROBANTE DE RETENCIÓN ---
                const renderRetentionTableHeader = (curY) => {
                    doc.roundedRect(startX, curY, pageWidth, 20, 4)
                       .fillColor(THEME.navyDark)
                       .fill();
                    
                    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                    doc.text('#', startX + 8, curY + 6);
                    doc.text('DOCUMENTO REFERENCIADO', startX + 28, curY + 6);
                    doc.text('FECHA DOC.', startX + 170, curY + 6);
                    doc.text('DESCRIPCIÓN', startX + 235, curY + 6);
                    doc.text('MONTO GRAVADO', startX + 380, curY + 6, { align: 'right', width: 75 });
                    doc.text('IVA RETENIDO', startX + 465, curY + 6, { align: 'right', width: 78 });
                };

                renderRetentionTableHeader(tableStartY);

                let sumSujeto = 0;
                let sumRetenido = 0;
                let curY = tableStartY + 24;

                items.forEach((item, idx) => {
                    const rawTipo = String(item.tipoDte || '').trim();
                    const tipoLabel = dteTypeLabels[rawTipo] || (rawTipo.length === 2 ? `DTE ${rawTipo}` : (rawTipo || 'Documento'));
                    const docNum = item.numeroDocumento || item.numDocumento || item.docNumber || item.doc_number || '';
                    const docRef = docNum ? `${tipoLabel} - ${docNum}` : tipoLabel;

                    let fechaDoc = '—';
                    const rawFecha = item.fechaEmision || item.emissionDate || item.emission_date || item.fecEmi;
                    if (rawFecha) fechaDoc = reportPdfHelper.formatDate(rawFecha);

                    const montoGravado = parseFloat(item.montoSujetoGrav || item.totalItem || item.montoSujeto || 0);
                    const montoRetenido = parseFloat(item.ivaRetenido || 0);
                    sumSujeto += montoGravado;
                    sumRetenido += montoRetenido;

                    const descH = doc.heightOfString(item.descripcion || '', { width: 140 });
                    const refH = doc.heightOfString(docRef, { width: 135 });
                    const rowH = Math.max(descH, refH, 12) + 8;

                    if (curY + rowH > 670) {
                        doc.addPage();
                        curY = 35;
                        renderRetentionTableHeader(curY);
                        curY += 24;
                    }

                    if (idx % 2 === 1) {
                        doc.rect(startX, curY - 3, pageWidth, rowH)
                           .fillColor(THEME.bgLight)
                           .fill();
                    }

                    doc.fillColor(THEME.textDark).fontSize(7.5).font('Helvetica');
                    doc.text(String(idx + 1), startX + 8, curY);
                    doc.font('Helvetica-Bold').text(docRef, startX + 28, curY, { width: 135 });
                    doc.font('Helvetica').text(fechaDoc, startX + 170, curY, { width: 60 });
                    doc.text(item.descripcion || '', startX + 235, curY, { width: 140 });
                    doc.text(`$${montoGravado.toFixed(2)}`, startX + 380, curY, { align: 'right', width: 75 });
                    doc.font('Helvetica-Bold').text(`$${montoRetenido.toFixed(2)}`, startX + 465, curY, { align: 'right', width: 78 });

                    doc.moveTo(startX, curY + rowH - 3)
                       .lineTo(startX + pageWidth, curY + rowH - 3)
                       .lineWidth(0.5)
                       .strokeColor(THEME.borderSubtle)
                       .stroke();

                    curY += rowH;
                });

                // Totales y QR DTE 07
                let footerY = Math.max(curY + 14, 570);
                if (curY + 130 > 725) {
                    doc.addPage();
                    footerY = 35;
                }

                // QR Container Card
                const qrCardW = 105;
                const qrCardH = 115;
                doc.roundedRect(startX, footerY, qrCardW, qrCardH, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.ambiente}&codGen=${dte.codigoGeneracion}&fechaEmi=${venta.fecha_emision}`;
                const qrImage = await QRCode.toDataURL(qrUrl, { margin: 1 });
                doc.image(qrImage, startX + 12, footerY + 8, { width: 80, height: 80 });

                doc.fillColor(THEME.navyDark)
                   .fontSize(6)
                   .font('Helvetica-Bold')
                   .text('CONSULTA PÚBLICA MH', startX + 5, footerY + 92, { width: 95, align: 'center' });

                // Totals Card (Right Side)
                const totCardX = startX + 272;
                const totCardW = pageWidth - 272;
                const totCardH = 105;

                doc.roundedRect(totCardX, footerY, totCardW, totCardH, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                const totalSujetoFinal = parseFloat(venta.totalSujetoRetencion || venta.total_gravado || 0) || sumSujeto;
                const totalRetenidoFinal = parseFloat(venta.totalIVAretenido || venta.totalIvaRetenido || venta.total_retencion || venta.total_iva || 0) || sumRetenido;
                const totalPagarFinal = (parseFloat(venta.total_pagar) > 0) ? parseFloat(venta.total_pagar) : totalRetenidoFinal;

                let cy = footerY + 12;
                const renderRetTotalRow = (label, val, isBold = false) => {
                    doc.fillColor(THEME.textMedium)
                       .fontSize(7.5)
                       .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                       .text(label, totCardX + 12, cy);
                    doc.fillColor(THEME.navyDark)
                       .fontSize(8)
                       .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                       .text(`$${val.toFixed(2)}`, totCardX + 150, cy, { align: 'right', width: totCardW - 165 });
                    cy += 16;
                };

                renderRetTotalRow('TOTAL SUJETO A RETENCIÓN:', totalSujetoFinal);
                renderRetTotalRow('TOTAL IVA RETENIDO (1%):', totalRetenidoFinal, true);

                // Highlighted Final Bar
                doc.roundedRect(totCardX + 6, cy + 2, totCardW - 12, 26, 4)
                   .fillColor(THEME.navyDark)
                   .fill();

                doc.fillColor('#ffffff')
                   .fontSize(9)
                   .font('Helvetica-Bold')
                   .text('TOTAL A PAGAR:', totCardX + 14, cy + 10);
                doc.text(`$${totalPagarFinal.toFixed(2)}`, totCardX + 140, cy + 10, { align: 'right', width: totCardW - 158 });

                // Valor en Letras
                const letrasX = startX + 115;
                const letrasW = totCardX - letrasX - 10;
                doc.roundedRect(letrasX, footerY, letrasW, 70, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                doc.fillColor(THEME.navyHeader)
                   .fontSize(6.8)
                   .font('Helvetica-Bold')
                   .text('VALOR EN LETRAS:', letrasX + 8, footerY + 8);

                const totalLetrasFinal = (venta.total_letras && venta.total_letras !== 'S/N' && venta.total_letras.trim() !== '')
                    ? venta.total_letras
                    : `${numberToWords(totalPagarFinal)} DÓLARES`;

                doc.fillColor(THEME.navyDark)
                   .fontSize(7.5)
                   .font('Helvetica-Bold')
                   .text(totalLetrasFinal.toUpperCase(), letrasX + 8, footerY + 20, { width: letrasW - 16 });

            } else {
                // --- 4.B TABLA ESTÁNDAR (DTE 01, 03, 05, etc.) ---
                const renderTableHeader = (curY) => {
                    doc.roundedRect(startX, curY, pageWidth, 20, 4)
                       .fillColor(THEME.navyDark)
                       .fill();

                    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                    doc.text('CANT.', startX + 8, curY + 6, { width: 38, align: 'center' });
                    doc.text('DESCRIPCIÓN DEL PRODUCTO O SERVICIO', startX + 52, curY + 6);
                    doc.text('PRECIO UNIT.', startX + 345, curY + 6, { align: 'right', width: 62 });
                    doc.text('DESCUENTO', startX + 415, curY + 6, { align: 'right', width: 55 });
                    doc.text('VENTA NETA', startX + 475, curY + 6, { align: 'right', width: 68 });
                };

                renderTableHeader(tableStartY);

                const esConsumidorFinal = dte.tipoDte === '01' || dte.tipoDte === 1 || String(dte.tipoDteNombre || '').toUpperCase().includes('CONSUMIDOR FINAL') || String(dte.tipoDteNombre || '').toUpperCase() === 'FACTURA';
                const fovialVenta = parseFloat(venta.fovial) || 0;
                const cotransVenta = parseFloat(venta.cotrans) || 0;
                const tieneImpuestosCombustible = (fovialVenta > 0 || cotransVenta > 0);

                const isFuelItem = (it) => {
                    if (it.esCombustible || it.es_combustible) return true;
                    if (it.uniMedida === 55) return true;
                    if (Array.isArray(it.tributos) && it.tributos.some(t => (t && (t.codigo === 'D1' || t.codigo === 'C8' || t === 'D1' || t === 'C8')))) return true;
                    const desc = String(it.descripcion || '').toUpperCase();
                    return /(DIESEL|REGULAR|SUPER|GASOLINA|V-POWER|ION\s*DIESEL)/.test(desc);
                };

                let curY = tableStartY + 24;

                items.forEach((item, idx) => {
                    doc.fontSize(7.5).font('Helvetica');
                    const descH = doc.heightOfString(item.descripcion || '', { width: 285 });
                    const rowH = Math.max(descH, 12) + 8;

                    if (curY + rowH > 670) {
                        doc.addPage();
                        curY = 35;
                        renderTableHeader(curY);
                        curY += 24;
                    }

                    const formattedQty = Number(item.cantidad) % 1 === 0 ? 
                        item.cantidad.toString() : 
                        Number(item.cantidad).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

                    let displayUnitPrice = parseFloat(item.precioUnitario) || 0;
                    let displayTotalItem = parseFloat(item.totalItem) || 0;
                    const displayDescuento = parseFloat(item.montoDescuento || 0);

                    if (esConsumidorFinal && tieneImpuestosCombustible && isFuelItem(item)) {
                        const cant = parseFloat(item.cantidad) || 0;
                        const fovialItem = Math.round(cant * 0.20 * 100) / 100;
                        const cotransItem = Math.round(cant * 0.10 * 100) / 100;
                        const fuelTaxes = fovialItem + cotransItem;

                        if (displayUnitPrice > 0.30) {
                            displayUnitPrice = Math.max(0, displayUnitPrice - 0.30);
                        }
                        displayTotalItem = Math.max(0, Math.round((displayTotalItem - fuelTaxes) * 100) / 100);
                    }

                    // Filas alternadas
                    if (idx % 2 === 1) {
                        doc.rect(startX, curY - 3, pageWidth, rowH)
                           .fillColor(THEME.bgLight)
                           .fill();
                    }

                    doc.fillColor(THEME.navyDark).fontSize(7.5).font('Helvetica');
                    doc.text(formattedQty, startX + 8, curY, { width: 38, align: 'center' });
                    doc.text(item.descripcion || '', startX + 52, curY, { width: 285 });
                    doc.text(`$${displayUnitPrice.toFixed(4)}`, startX + 345, curY, { align: 'right', width: 62 });

                    if (displayDescuento > 0) {
                        doc.fillColor(THEME.dangerRed).font('Helvetica-Bold').text(`$${displayDescuento.toFixed(2)}`, startX + 415, curY, { align: 'right', width: 55 });
                        doc.fillColor(THEME.navyDark).font('Helvetica');
                    } else {
                        doc.fillColor(THEME.textMuted).text(`$ -`, startX + 415, curY, { align: 'right', width: 55 });
                        doc.fillColor(THEME.navyDark);
                    }

                    doc.font('Helvetica-Bold').text(`$${displayTotalItem.toFixed(2)}`, startX + 475, curY, { align: 'right', width: 68 });

                    // Línea divisoria suave
                    doc.moveTo(startX, curY + rowH - 3)
                       .lineTo(startX + pageWidth, curY + rowH - 3)
                       .lineWidth(0.5)
                       .strokeColor(THEME.borderSubtle)
                       .stroke();

                    curY += rowH;
                });

                // ==========================================
                // 5. RESUMEN FINANCIERO Y CÓDIGO QR
                // ==========================================
                let gravadasDisplay = parseFloat(venta.total_gravado) || 0;
                let sumaOperacionesDisplay = gravadasDisplay;

                if (esConsumidorFinal && tieneImpuestosCombustible) {
                    const totalPagarNum = parseFloat(venta.total_pagar) || 0;
                    const totalExentoNum = parseFloat(venta.total_exento) || 0;
                    const totalNoSujNum = parseFloat(venta.total_nosujetas) || 0;
                    gravadasDisplay = Math.max(0, Math.round((totalPagarNum - fovialVenta - cotransVenta - totalExentoNum - totalNoSujNum) * 100) / 100);
                    const descNum = parseFloat(venta.total_descuento) || 0;
                    sumaOperacionesDisplay = Math.round((gravadasDisplay + descNum) * 100) / 100;
                }

                const lines = [];
                lines.push({ label: 'SUMA DE OPERACIONES:', val: sumaOperacionesDisplay, isBold: false });

                const totalDesc = parseFloat(venta.total_descuento) || 0;
                if (totalDesc > 0) lines.push({ label: '(-) DESCUENTOS:', val: totalDesc, isNegative: true });

                lines.push({ label: 'VENTAS GRAVADAS:', val: gravadasDisplay, isBold: false });

                const totalExentas = parseFloat(venta.total_exento) || 0;
                if (totalExentas > 0) lines.push({ label: 'VENTAS EXENTAS:', val: totalExentas });

                const totalNoSujetas = parseFloat(venta.total_nosujetas) || 0;
                if (totalNoSujetas > 0) lines.push({ label: 'VENTAS NO SUJETAS:', val: totalNoSujetas });

                if (esConsumidorFinal) {
                    lines.push({ label: 'TOTAL IVA (13%):', raw: '$ -' });
                } else {
                    lines.push({ label: 'TOTAL IVA (13%):', val: parseFloat(venta.total_iva) || 0, isBold: true });
                }

                const processedCodes = new Set();
                if (venta.tributos && venta.tributos.length > 0) {
                    venta.tributos.forEach(tri => {
                        if (tri.codigo !== '20') {
                            let desc = tri.descripcion || tri.codigo;
                            if (desc.toUpperCase().includes('FEFE')) desc = 'FOVIAL';
                            lines.push({ label: `${desc.toUpperCase()}:`, val: parseFloat(tri.valor) || 0 });
                            processedCodes.add(tri.codigo);
                        }
                    });
                }

                if (!processedCodes.has('D1') && !processedCodes.has('C3') && !processedCodes.has('01') && fovialVenta > 0) {
                    lines.push({ label: 'TOTAL FOVIAL ($0.20):', val: fovialVenta });
                }
                if (!processedCodes.has('C8') && !processedCodes.has('C1') && !processedCodes.has('02') && cotransVenta > 0) {
                    lines.push({ label: 'TOTAL COTRAN ($0.10):', val: cotransVenta });
                }

                const retencionIVA = parseFloat(venta.total_retencion) || 0;
                const percepcionIVA = parseFloat(venta.total_percepcion) || 0;
                if (retencionIVA > 0) lines.push({ label: '(-) RETENCIÓN IVA (1%):', val: retencionIVA, isNegative: true });
                if (percepcionIVA > 0) lines.push({ label: '(+) PERCEPCIÓN IVA (1%):', val: percepcionIVA });

                const totCardX = startX + 272;
                const totCardW = pageWidth - 272;
                const totCardH = Math.max(128, (lines.length * 13) + 46);

                let footerY = Math.max(curY + 12, 570);
                if (curY + totCardH + 15 > 730) {
                    doc.addPage();
                    footerY = 35;
                }

                // --- 5.A Tarjeta QR (Lado Izquierdo) ---
                const qrCardW = 105;
                const qrCardH = 126;
                doc.roundedRect(startX, footerY, qrCardW, qrCardH, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.ambiente}&codGen=${dte.codigoGeneracion}&fechaEmi=${venta.fecha_emision}`;
                const qrImage = await QRCode.toDataURL(qrUrl, { margin: 1 });
                doc.image(qrImage, startX + 10, footerY + 8, { width: 85, height: 85 });

                doc.fillColor(THEME.navyDark)
                   .fontSize(6)
                   .font('Helvetica-Bold')
                   .text('CONSULTA PÚBLICA DTE', startX + 6, footerY + 97, { width: 93, align: 'center' });
                doc.fillColor(THEME.textMuted)
                   .fontSize(5)
                   .font('Helvetica')
                   .text('Sitio oficial MH El Salvador', startX + 6, footerY + 106, { width: 93, align: 'center' });

                // --- 5.B Tarjeta Valor en Letras (Centro) ---
                const letrasX = startX + 115;
                const letrasW = totCardX - letrasX - 10;
                const letrasH = 75;

                doc.roundedRect(letrasX, footerY, letrasW, letrasH, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                doc.fillColor(THEME.navyHeader)
                   .fontSize(6.8)
                   .font('Helvetica-Bold')
                   .text('VALOR EN LETRAS:', letrasX + 8, footerY + 8);

                const totalLetrasFinal = (venta.total_letras && venta.total_letras !== 'S/N' && venta.total_letras.trim() !== '')
                    ? venta.total_letras
                    : `${numberToWords(parseFloat(venta.total_pagar) || 0)} DÓLARES`;

                doc.fillColor(THEME.navyDark)
                   .fontSize(7.5)
                   .font('Helvetica-Bold')
                   .text(totalLetrasFinal.toUpperCase(), letrasX + 8, footerY + 20, { width: letrasW - 16, lineGap: 1.5 });

                // --- 5.C Tarjeta de Totales (Lado Derecho) ---
                doc.roundedRect(totCardX, footerY, totCardW, totCardH, 5)
                   .lineWidth(1)
                   .strokeColor(THEME.borderCard)
                   .fillColor(THEME.bgCard)
                   .fillAndStroke();

                let ty = footerY + 8;
                lines.forEach(line => {
                    doc.fillColor(THEME.textMedium)
                       .fontSize(7.2)
                       .font(line.isBold ? 'Helvetica-Bold' : 'Helvetica')
                       .text(line.label, totCardX + 10, ty);

                    let formattedVal = line.raw || `$${(line.val || 0).toFixed(2)}`;
                    if (line.isNegative) formattedVal = `-$${Math.abs(line.val || 0).toFixed(2)}`;

                    doc.fillColor(line.isNegative ? THEME.dangerRed : THEME.navyDark)
                       .fontSize(7.5)
                       .font(line.isBold ? 'Helvetica-Bold' : 'Helvetica')
                       .text(formattedVal, totCardX + 135, ty, { align: 'right', width: totCardW - 147 });
                    ty += 12.5;
                });

                // Highlighted Final Bar (TOTAL A PAGAR)
                doc.roundedRect(totCardX + 6, footerY + totCardH - 32, totCardW - 12, 26, 4)
                   .fillColor(THEME.navyDark)
                   .fill();

                doc.fillColor('#ffffff')
                   .fontSize(9)
                   .font('Helvetica-Bold')
                   .text('TOTAL A PAGAR:', totCardX + 14, footerY + totCardH - 24);

                doc.fontSize(9.5).text(`$${parseFloat(venta.total_pagar).toFixed(2)}`, totCardX + 125, footerY + totCardH - 24, { align: 'right', width: totCardW - 141 });
            }

            // ==========================================
            // 6. MARCA DE AGUA "ANULADO"
            // ==========================================
            if (data.isVoided) {
                const totalPages = doc.bufferedPageRange().count;
                for (let i = 0; i < totalPages; i++) {
                    doc.switchToPage(i);
                    const cx = doc.page.width / 2;
                    const cy = doc.page.height / 2;

                    doc.save();
                    doc.translate(cx, cy);
                    doc.rotate(-45);

                    doc.lineWidth(4).strokeColor(THEME.dangerRed).strokeOpacity(0.22);
                    doc.rect(-210, -50, 420, 100).stroke();
                    doc.lineWidth(1).strokeColor(THEME.dangerRed).strokeOpacity(0.22);
                    doc.rect(-204, -44, 408, 88).stroke();

                    doc.fillColor(THEME.dangerRed).fillOpacity(0.22);
                    doc.fontSize(72).font('Helvetica-Bold');
                    const textWidth = doc.widthOfString('ANULADO');
                    doc.text('ANULADO', -textWidth / 2, -26);

                    doc.restore();
                    doc.fillColor('black').fillOpacity(1);
                }
            }

            // ==========================================
            // 7. PAGINACIÓN DEFENSIVA (Sin hojas en blanco)
            // ==========================================
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                const oldBottom = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;
                doc.fillColor(THEME.textMuted)
                   .fontSize(6.5)
                   .font('Helvetica-Bold')
                   .text(`Página ${i + 1} de ${pageCount}`, startX, doc.page.height - 18, {
                       align: 'center',
                       width: pageWidth,
                       lineBreak: false
                   });
                doc.page.margins.bottom = oldBottom;
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { generateRTEEModern, THEME };
