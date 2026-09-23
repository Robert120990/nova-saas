const {
    PDFDocument,
    path,
    fs,
    QRCode,
    reportPdfHelper,
    numberToWords,
    isValidTaxVal,
    resolveCompanyInfo,
    fmtDateDDMMYYYY
} = require('./pdfUtils');


// --- DOCUMENTOS LABORALES Y FINIQUITOS (RECURSOS HUMANOS) ---
const generateVacacionPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const sueldoMensual = parseFloat(data.sueldo_base || 0);
            const sueldoQuincenal = sueldoMensual / 2;
            const vacacionesMonto = parseFloat(data.vacaciones_monto || 0);
            const totalDevengado = parseFloat(data.total_devengado || (sueldoQuincenal + vacacionesMonto));
            const descuentoISSS = parseFloat(data.descuento_isss || 0);
            const descuentoAFP = parseFloat(data.descuento_afp || 0);
            const descuentoRenta = parseFloat(data.descuento_renta || 0);
            const totalDeducciones = parseFloat(data.total_deducciones || (descuentoISSS + descuentoAFP + descuentoRenta));
            const totalRecibir = parseFloat(data.total_recibir || (totalDevengado - totalDeducciones));
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(totalRecibir) : '');

            const periodoTexto = `${fmt(data.fecha_inicial)} AL ${fmt(data.fecha_final)}`;

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo, Company, Title Pill) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Periodo
                const rightPillW = 220;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE VACACIONES ANUALES', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`PERÍODO: ${periodoTexto}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Employee Info Card ---
                const cardH = 34;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('EMPLEADO:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                const cargoDepto = `${data.cargo_nombre || 'GENERAL'} • ${data.departamento_nombre || 'GENERAL'}`;
                doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('RÉGIMEN:', M + 375, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('ANUAL (ART. 177 CT)', M + 375, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('SUELDO MENSUAL:', M + 455, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(`$ ${sueldoMensual.toFixed(2)}`, M + 455, y + 11.5);

                // Card Row 2 (Metadata badges line)
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                const metaLine = `CÓD: ${data.empleado_codigo || '—'}    |    DUI: ${data.num_dui || '—'}    |    NIT: ${data.num_nit || '—'}    |    INGRESO: ${fmt(data.fecha_ingreso)}`;
                doc.text(metaLine, M + 8, y + 23);

                y += cardH + 5;

                // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 10;

                // Column Headers
                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 3;

                // Left Column: Percepciones
                let percY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Sueldo Quincenal Ordinario', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${sueldoQuincenal.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                doc.text('Vacación Reglamentaria (+30% Art. 177 CT)', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${vacacionesMonto.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                // Right Column: Deducciones
                let dedY = y;
                const isssPct = data.isss_porcentaje || 3;
                const afpPct = data.afp_porcentaje || 7.25;

                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text(`ISSS (${isssPct}%)`, rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoISSS.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text(`AFP (${afpPct}%)`, rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoAFP.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text('Impuesto sobre la Renta (ISR)', rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoRenta.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                // Column Totals
                const maxRowY = Math.max(percY, dedY) + 2;

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEVENGADO', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${totalDevengado.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${totalDeducciones.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 15;

                // --- 4. Líquido a Recibir ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${totalRecibir.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                y += 9;
                doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                doc.text('Dinero que recibo a mi entera satisfacción en concepto de vacación anual reglamentaria y sueldo respectivo, liberando a la empresa de toda responsabilidad legal y laboral al respecto.', M + 4, y, { width: W - 8 });

                // --- 5. Signatures ---
                y += 34;
                const sigLineY = y;
                const sigW = 200;

                // Empleado Signature
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa / RRHH Signature
                const rightSigX = M + W - sigW - 15;

                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('AUTORIZADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Copy badge at bottom
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
            };

            // Top Copy (Copia Empleado)
            drawCopy(22, 'COPIA EMPLEADO');

            // Middle dashed divider line
            const PAGE_MID = 396;
            doc.save()
               .strokeColor('#cbd5e1')
               .lineWidth(0.6)
               .dash(4, { space: 3 })
               .moveTo(M, PAGE_MID)
               .lineTo(M + W, PAGE_MID)
               .stroke()
               .undash()
               .restore();

            // Bottom Copy (Original Empresa)
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateLiquidacionPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 36, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 36;
            const W = 540;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const sueldoMensual = parseFloat(data.sueldo_base || 0);
            const sueldoDiario = sueldoMensual / 30;
            const totalIndemnizacion = parseFloat(data.total_indemnizacion || 0);
            const totalVacaciones = parseFloat(data.total_vacaciones || 0);
            const totalAguinaldo = parseFloat(data.total_aguinaldo || 0);
            const pagoUltimosDias = parseFloat(data.pago_ultimos_dias || 0);
            const totalDevengado = parseFloat(data.total_devengado || 0);

            const descuentoISSS = parseFloat(data.descuento_isss || 0);
            const descuentoAFP = parseFloat(data.descuento_afp || 0);
            const descuentoRenta = parseFloat(data.descuento_renta || 0);
            const otrosDescuentos = parseFloat(data.otros_descuentos || 0);
            const totalDeducciones = parseFloat(data.total_deducciones || 0);

            const montoRecibir = parseFloat(data.monto_recibir || 0);
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(montoRecibir) : '');

            let y = 34;

            // --- 1. Header (Logo / Company / Title Pill) ---
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [85, 34] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const companyX = logoRendered ? M + 95 : M;
            const companyMaxW = logoRendered ? 230 : 310;

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 14);

            const rightPillW = 220;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('LIQUIDACIÓN LABORAL Y FINIQUITO', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('CONSTANCIA DE PRESTACIONES LABORALES', rightPillX, y + 13, { width: rightPillW, align: 'right' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`LIQ-${String(data.id || '1').padStart(5, '0')} • FECHA: ${new Date().toLocaleDateString('es-SV')}`, rightPillX, y + 24, { width: rightPillW, align: 'right' });

            y += 38;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 6;

            // --- 2. Employee Identification Card ---
            const cardH = 44;
            doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('EMPLEADO:', M + 8, y + 4.5);
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName.substring(0, 36), M + 8, y + 13.5, { width: 190, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('CARGO:', M + 210, y + 4.5);
            doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
            doc.text((data.cargo_nombre || 'GENERAL').substring(0, 30), M + 210, y + 13.5, { width: 155, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('DEPARTAMENTO:', M + 375, y + 4.5);
            doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
            doc.text((data.departamento_nombre || 'GENERAL').substring(0, 30), M + 375, y + 13.5, { width: 155, ellipsis: true });

            // Card Row 2: Metadata
            doc.fontSize(6.8).font('Helvetica').fillColor('#475569');
            const metaLine = `CÓD: ${data.empleado_codigo || '—'}   |   DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}   |   INGRESO: ${fmt(data.fecha_ingreso)}   |   SUELDO BASE: $ ${sueldoMensual.toFixed(2)} (DIARIO: $ ${sueldoDiario.toFixed(2)})`;
            doc.text(metaLine, M + 8, y + 29);

            y += cardH + 7;

            // --- 3. Period & Seniority Cards (4 mini-cards side-by-side) ---
            const miniW = (W - 18) / 4;
            const miniH = 34;

            // Card 1: Indemnización
            doc.rect(M, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('INDEMNIZACIÓN', M + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_indemnizacion_desde)} al ${fmt(data.periodo_indemnizacion_hasta)}`, M + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_indemnizacion || 0} DÍAS`, M + 5, y + 21.5);

            // Card 2: Vacaciones
            const c2X = M + miniW + 6;
            doc.rect(c2X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('VACACIÓN PROPORCIONAL', c2X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_vacaciones_desde)} al ${fmt(data.periodo_vacaciones_hasta)}`, c2X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_vacaciones || 0} DÍAS`, c2X + 5, y + 21.5);

            // Card 3: Aguinaldo
            const c3X = c2X + miniW + 6;
            doc.rect(c3X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('AGUINALDO PROPORCIONAL', c3X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_aguinaldo_desde)} al ${fmt(data.periodo_aguinaldo_hasta)}`, c3X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_aguinaldo || 0} DÍAS`, c3X + 5, y + 21.5);

            // Card 4: Días laborados
            const c4X = c3X + miniW + 6;
            doc.rect(c4X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('ÚLTIMOS DÍAS LABORADOS', c4X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(data.ultimos_dias_laborados ? `${fmt(data.ultimos_dias_laborados)}` : 'AL DÍA', c4X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(pagoUltimosDias > 0 ? `$ ${pagoUltimosDias.toFixed(2)}` : 'COMPLETO', c4X + 5, y + 21.5);

            y += miniH + 9;

            // --- 4. Two Columns Breakdown: PERCEPCIONES vs DEDUCCIONES ---
            const colW = (W - 16) / 2;
            const leftX = M;
            const rightX = M + colW + 16;
            const headerH = 14;
            const rowH = 13;

            // Header Bars
            doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('CONCEPTO DE PERCEPCIÓN (INGRESOS)', leftX + 6, y + 3.5, { width: 180 });
            doc.text('MONTO ($)', leftX + colW - 75, y + 3.5, { width: 70, align: 'right' });

            doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
            doc.text('DEDUCCIONES Y RETENCIONES DE LEY', rightX + 6, y + 3.5, { width: 180 });
            doc.text('MONTO ($)', rightX + colW - 75, y + 3.5, { width: 70, align: 'right' });

            y += headerH + 4;

            // Percepciones List
            let percY = y;
            const drawPercRow = (title, subtitle, amount) => {
                doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155');
                doc.text(title, leftX + 6, percY, { width: 180 });
                doc.font('Helvetica').fontSize(6).fillColor('#64748b');
                doc.text(subtitle, leftX + 6, percY + 9, { width: 180 });
                doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
                doc.text(`$ ${amount.toFixed(2)}`, leftX + colW - 75, percY + 3, { width: 70, align: 'right' });
                percY += rowH + 8;
            };

            drawPercRow('Indemnización por Despido / Retiro', `${data.dias_indemnizacion || 0} días calculados según Art. 58 CT`, totalIndemnizacion);
            drawPercRow('Vacación Proporcional Reglamentaria', `${data.dias_vacaciones || 0} días (+30% recargo ley Art. 177 CT)`, totalVacaciones);
            drawPercRow('Aguinaldo Proporcional', `${data.dias_aguinaldo || 0} días computados según Art. 198 CT`, totalAguinaldo);
            if (pagoUltimosDias > 0) {
                drawPercRow('Últimos Días Laborados Pendientes', 'Salario ordinario devengado no cancelado', pagoUltimosDias);
            }

            // Deducciones List
            let dedY = y;
            const isssPct = data.isss_porcentaje || 3;
            const afpPct = data.afp_porcentaje || 7.25;

            const drawDedRow = (title, subtitle, amount) => {
                doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155');
                doc.text(title, rightX + 6, dedY, { width: 180 });
                doc.font('Helvetica').fontSize(6).fillColor('#64748b');
                doc.text(subtitle, rightX + 6, dedY + 9, { width: 180 });
                doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
                doc.text(`$ ${amount.toFixed(2)}`, rightX + colW - 75, dedY + 3, { width: 70, align: 'right' });
                dedY += rowH + 8;
            };

            drawDedRow(`Cotización ISSS (${isssPct}%)`, 'Aporte del trabajador para régimen de salud', descuentoISSS);
            drawDedRow(`Cotización AFP (${afpPct}%)`, 'Fondo de pensiones previsional obligatorio', descuentoAFP);
            drawDedRow('Retención Impuesto sobre la Renta (ISR)', 'Cálculo de retención tributaria sobre finiquito', descuentoRenta);
            if (otrosDescuentos > 0) {
                drawDedRow('Otros Descuentos / Préstamos', 'Anticipos, retenciones mercantiles o judiciales', otrosDescuentos);
            }

            // Column Totals
            const maxRowY = Math.max(percY, dedY);

            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
            doc.text('TOTAL PERCEPCIONES', leftX + 6, maxRowY + 4, { width: 170 });
            doc.text(`$ ${totalDevengado.toFixed(2)}`, leftX + colW - 85, maxRowY + 4, { width: 80, align: 'right' });

            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
            doc.text('TOTAL DEDUCCIONES', rightX + 6, maxRowY + 4, { width: 170 });
            doc.text(`$ ${totalDeducciones.toFixed(2)}`, rightX + colW - 85, maxRowY + 4, { width: 80, align: 'right' });

            y = maxRowY + 22;

            // --- 5. Net Amount Callout Card ---
            const netH = 24;
            doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#3730a3');
            doc.text('TOTAL LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 10, y + 6.5);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e1b4b');
            doc.text(`$ ${montoRecibir.toFixed(2)}`, M + W - 180, y + 5.5, { width: 170, align: 'right' });

            y += netH + 4;
            doc.fontSize(7.2).font('Helvetica-Oblique').fillColor('#475569');
            doc.text(`Son: ${montoLetras}`, M + 6, y, { width: W - 12 });
            y += 13;

            // Cuotas info if enabled
            if (data.pago_cuotas) {
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`Modalidad de Pago Fraccionado: Cancelable en ${data.cuotas} cuotas mensuales y consecutivas de $ ${parseFloat(data.pago_por_cuota || 0).toFixed(2)} cada una.`, M + 6, y);
                y += 12;
            }

            // --- 6. Release Clause (Cláusula de Finiquito) ---
            doc.rect(M, y, W, 40).fill('#fafafa').stroke('#e2e8f0');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('CLÁUSULA DE FINIQUITO, EXONERACIÓN Y LIBERACIÓN LABORAL:', M + 8, y + 4);
            doc.fontSize(6.2).font('Helvetica').fillColor('#475569');
            const clausulaTexto = `Manifiesto expresamente que he recibido a mi entera satisfacción de ${data.company_name?.toUpperCase() || 'LA EMPRESA'} la cantidad líquida descrita en este documento en concepto de indemnización por terminación de contrato, vacaciones, aguinaldos proporcionales y demás derechos derivados de mi relación de trabajo. En consecuencia, declaro a la empresa y a sus representantes totalmente libres y solventes de cualquier obligación laboral, administrativa, previsional o civil.`;
            doc.text(clausulaTexto, M + 8, y + 14, { width: W - 16, align: 'justify' });

            y += 46;

            const today = new Date();
            const fechaTexto = today.toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(7).font('Helvetica').fillColor('#475569');
            doc.text(`San Salvador, ${fechaTexto}`, M, y);

            // --- 7. Dual Signatures Block ---
            const sigLineY = 690;
            const sigW = 210;

            // Empleado Signature
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, sigLineY).lineTo(M + 20 + sigW, sigLineY).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('RECIBÍ CONFORME (EMPLEADO)', M + 20, sigLineY + 3, { width: sigW, align: 'center' });
            doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, sigLineY + 12, { width: sigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 20, sigLineY + 21, { width: sigW, align: 'center' });

            // Empresa Signature (with optional stamps and digital signatures)
            const rightSigX = M + W - sigW - 20;

            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) {
                        doc.image(fAbs, rightSigX + 15, sigLineY - 34, { fit: [95, 30] });
                    }
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) {
                        doc.image(sAbs, rightSigX + 120, sigLineY - 34, { fit: [80, 30] });
                    }
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR LA EMPRESA / AUTORIZADO', rightSigX, sigLineY + 3, { width: sigW, align: 'center' });
            doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 12, { width: sigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 21, { width: sigW, align: 'center' });

            // Footer note
            doc.fontSize(6).font('Helvetica').fillColor('#94a3b8');
            doc.text('Comprobante emitido en legal forma • Válido como recibo de pago y constancia de liquidación laboral.', M, 742, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateFiniquitoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 45, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 45;
            const W = 522;
            const BOTTOM_FOOTER = 742;
            const SIG_Y = 650;

            const today = new Date();
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            const horaTexto = today.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
            const companyName = (data.company_name || 'EMPRESA').toUpperCase();
            const empleadorNombre = (data.empleador_nombre || data.company_name || 'EL EMPLEADOR').toUpperCase();
            const motivo = data.motivo || 'RENUNCIA INMEDIATA';
            const notarioNombre = data.notario_nombre || '________________________________________';
            const notarioDomicilio = data.notario_domicilio || city;
            const notarioDept = data.notario_dept || dept;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';

            // ==========================================
            // === PAGE 1: Finiquito Laboral Privado ===
            // ==========================================

            let y = 36;
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [75, 30] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const compX = logoRendered ? M + 85 : M;
            const compW = logoRendered ? 240 : 310;
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(companyName, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            const rightPillW = 200;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('INSTRUMENTO PRIVADO', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('FINIQUITO LABORAL CON DESCARGO TOTAL', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Document Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('DOCUMENTO PRIVADO DE FINIQUITO LABORAL Y DESCARGO TOTAL', M, y, { width: W, align: 'center' });
            y += 20;

            // Body Paragraphs
            doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b');
            doc.text(`Yo, ${empName}, mayor de edad, de nacionalidad salvadoreña, del domicilio de la ciudad de ${city}, departamento de ${dept}, con Documento Único de Identidad número ${data.num_dui || '_______________'} y con Número de Identificación Tributaria ${data.num_nit || '_______________'}; por medio del presente instrumento privado, actuando en mi carácter personal, libre de toda coacción y con pleno conocimiento, MANIFIESTO:`, M, y, { width: W, align: 'justify', lineGap: 3.5 });
            doc.moveDown(0.8);

            doc.font('Helvetica-Bold').text('I) ANTECEDENTE LABORAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que ingresé a prestar mis servicios laborales para y bajo las órdenes de ${companyName}, desempeñando el cargo de ${(data.cargo_nombre || 'GENERAL').toUpperCase()}.`);
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('II) TERMINACIÓN DE LA RELACIÓN: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que en esta fecha, por motivo de ${motivo}, se da por terminada formal y definitivamente la relación de trabajo que me vinculaba con el referido empleador.`);
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('III) LIQUIDACIÓN Y PAGO ÍNTEGRO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text('Que he recibido a mi entera y cabal satisfacción la totalidad de las prestaciones laborales ordinarias y extraordinarias que conforme a derecho me corresponden, comprensivas de: salarios ordinarios y extraordinarios devengados, vacación anual reglamentaria y proporcional con el recargo legal correspondiente, aguinaldo proporcional reglamentario, indemnización por terminación laboral conforme a lo regulado en el Código de Trabajo, horas extraordinarias, días de descanso y asuetos devengados.');
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('IV) FINIQUITO Y EXONERACIÓN TOTAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`En consecuencia de haber recibido a mi entera conformidad el cien por ciento (100%) de todas mis prestaciones, declaro al empleador ${companyName}, a sus administradores, socios y empresas filiales o relacionadas, totalmente libres, solventes y exonerados de toda responsabilidad legal, laboral, previsional (AFP), de seguridad social (ISSS) o civil, no teniendo reclamación alguna presente ni futura que formular en sede judicial ni administrativa, otorgándole por este acto el más amplio, formal y eficaz FINIQUITO LABORAL.`);
            doc.moveDown(0.9);

            doc.font('Helvetica').text(`En fe de lo cual y para que surta los efectos jurídicos correspondientes, firmo el presente documento en la ciudad de ${city}, departamento de ${dept}, a los ${fechaTexto}.`, { width: W, align: 'justify', lineGap: 3.5 });

            // Page 1 Signatures Block
            const p1SigW = 200;
            // Trabajador
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, SIG_Y).lineTo(M + 20 + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL TRABAJADOR', M + 20, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '_______________'}`, M + 20, SIG_Y + 21, { width: p1SigW, align: 'center' });

            // Empleador
            const p1RightX = M + W - p1SigW - 20;
            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) doc.image(fAbs, p1RightX + 20, SIG_Y - 32, { fit: [90, 28] });
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) doc.image(sAbs, p1RightX + 115, SIG_Y - 32, { fit: [75, 28] });
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(p1RightX, SIG_Y).lineTo(p1RightX + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR EL EMPLEADOR', p1RightX, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleadorNombre, p1RightX, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('REPRESENTANTE PATRONAL', p1RightX, SIG_Y + 21, { width: p1SigW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Página 1 de 2 • Finiquito Laboral Privado • Sistema Sipe Web SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            // ==========================================
            // === PAGE 2: Acta Notarial de Legalización ===
            // ==========================================
            doc.addPage();

            y = 36;
            if (logoRendered && logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) doc.image(p, M, y, { fit: [75, 30] });
                } catch (e) {}
            }

            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(companyName, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('FE PÚBLICA NOTARIAL', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('ACTA NOTARIAL DE AUTÉNTICA DE FIRMA', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('ACTA NOTARIAL DE LEGALIZACIÓN DE FIRMA', M, y, { width: W, align: 'center' });
            y += 22;

            // Body Notarial
            doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b');
            const notariaTexto1 = `En la ciudad de ${city}, departamento de ${dept}, a las ${horaTexto} horas del día ${fechaTexto}. Ante mí, ${notarioNombre}, Notario, del domicilio de la ciudad de ${notarioDomicilio}, departamento de ${notarioDept}, comparece el/la señor(a) ${empName}, de ${data.edad || '___'} años de edad, de nacionalidad salvadoreña, del domicilio de ${city}, departamento de ${dept}, persona a quien no conozco pero identifico por medio de su Documento Único de Identidad número ${data.num_dui || '_______________'}; quien por este medio ME DICE: Que reconoce como suya la firma que calza el documento privado que antecede, redactado en una hoja de papel útil, suscrito en esta misma fecha y ciudad, por haber sido puesta de su propio puño y letra, así como reconoce las declaraciones y el finiquito de prestaciones de ley en él contenidos, en el cual declara libre y solvente de toda responsabilidad laboral a ${companyName}.`;
            doc.text(notariaTexto1, M, y, { width: W, align: 'justify', lineGap: 4 });
            doc.moveDown(1);

            const notariaTexto2 = `Y yo, el suscrito Notario, DOY FE: Que la firma que aparece al calce del anterior documento es AUTÉNTICA, por haber sido puesta de su puño y letra a mi presencia por el compareciente. Leída que le fue por mí íntegramente la presente acta notarial en un solo acto ininterrumpido, manifiesta estar plenamente enterado/a de sus efectos jurídicos, la ratifica por ser conforme a su voluntad y para constancia firma conmigo. DOY FE.`;
            doc.text(notariaTexto2, { width: W, align: 'justify', lineGap: 4 });

            // Signatures Page 2
            // Compareciente
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, SIG_Y).lineTo(M + 20 + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL COMPARECIENTE (TRABAJADOR)', M + 20, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '_______________'}`, M + 20, SIG_Y + 21, { width: p1SigW, align: 'center' });

            // Notario
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(p1RightX, SIG_Y).lineTo(p1RightX + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('ANTE MÍ: FIRMA Y SELLO NOTARIAL', p1RightX, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text((data.notario_nombre || 'NOTARIO DE LA REPÚBLICA').toUpperCase(), p1RightX, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('NOTARIO AUTORIZADO', p1RightX, SIG_Y + 21, { width: p1SigW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Página 2 de 2 • Acta Notarial de Legalización • Sistema Sipe Web SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAcuerdoPagoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 45, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 45;
            const W = 522;
            const BOTTOM_FOOTER = 742;
            const SIG_Y = 645;

            const today = new Date();
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            const horaTexto = today.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

            const empleado = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
            const empleador = (data.company_name || 'EL EMPLEADOR').toUpperCase();
            const firmante = (data.empleador_nombre || data.company_name || 'REPRESENTANTE PATRONAL').toUpperCase();
            const montoVal = parseFloat(data.monto_recibir || 0);
            const monto = montoVal.toFixed(2);
            const numCuotas = data.cuotas || 1;
            const pagoCuota = parseFloat(data.pago_por_cuota || 0).toFixed(2);
            const diaPago = today.getDate();
            const montoLetras = numberToWords ? numberToWords(montoVal) : '';
            const cuotaLetras = numberToWords ? numberToWords(parseFloat(pagoCuota)) : '';

            const notarioNombre = data.notario_nombre || '________________________________________';
            const notarioDomicilio = data.notario_domicilio || city;
            const notarioDept = data.notario_dept || dept;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';

            // --- Header ---
            let y = 36;
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [75, 30] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const compX = logoRendered ? M + 85 : M;
            const compW = logoRendered ? 240 : 310;
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleador, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            const rightPillW = 200;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('INSTRUMENTO NOTARIAL', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('ACUERDO DE PAGO Y LIQUIDACIÓN EN CUOTAS', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('ACTA NOTARIAL DE ACUERDO DE PAGO Y LIQUIDACIÓN LABORAL', M, y, { width: W, align: 'center' });
            y += 20;

            // Body
            doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
            const introTexto = `En la ciudad de ${city}, departamento de ${dept}, a las ${horaTexto} horas del día ${fechaTexto}. Ante mí, ${notarioNombre}, Notario, del domicilio de la ciudad de ${notarioDomicilio}, Departamento de ${notarioDept}, comparece ${empleado}, mayor de edad, del domicilio de ${city}, departamento de ${dept}, a quien no conozco pero identifico mediante su Documento Único de Identidad número ${data.num_dui || '_______________'}, quien en adelante se denominará como "EL TRABAJADOR"; y por otra parte el señor(a) ${firmante}, en su calidad de representante de ${empleador}, en adelante denominado "EL EMPLEADOR"; y de consuno y mutuo acuerdo ME DICEN:`;
            doc.text(introTexto, M, y, { width: W, align: 'justify', lineGap: 3.5 });
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('I) ANTECEDENTE LABORAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que entre las partes comparecientes existió una relación de trabajo en la cual el trabajador desempeñó las funciones correspondientes al cargo de ${(data.cargo_nombre || 'GENERAL').toUpperCase()}.`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('II) TERMINACIÓN POR MUTUO CONSENTIMIENTO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text('Que ambas partes de mutuo y libre consentimiento convienen en dar por terminada su relación laboral en esta misma fecha, en apego a las disposiciones pertinentes del Código de Trabajo.');
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('III) LIQUIDACIÓN Y MONTO CONVENIDO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que habiendo practicado la liquidación de las prestaciones laborales ordinarias y extraordinarias correspondientes (indemnización, vacación y aguinaldo proporcionales), fijan de común acuerdo la suma neta definitiva a pagar en la cantidad de ${montoLetras.toUpperCase()} ($ ${monto} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA).`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('IV) CALENDARIO Y MODALIDAD DE PAGO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Convienen las partes que dicha cantidad será cancelada íntegramente por el Empleador mediante un plan de ${numCuotas} cuotas mensuales, fijas y sucesivas de $ ${pagoCuota} (${cuotaLetras.toUpperCase()}) cada una, pagaderas los días ${diaPago} de cada uno de los meses subsiguientes hasta la total extinción del saldo. Si el día de pago correspondiese a día inhábil, el pago se verificará el primer día hábil inmediato posterior.`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('V) FINIQUITO CONDICIONAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`El trabajador manifiesta darse por enteramente satisfecho con el presente acuerdo voluntario y se compromete formalmente a que, al recibir el pago íntegro de la última cuota convenida, otorgará el respectivo finiquito laboral total y definitivo a favor de ${empleador}.`);
            doc.moveDown(0.7);

            doc.font('Helvetica').text(`Y yo, el suscrito Notario, DOY FE: a) De haber explicado a los comparecientes los efectos jurídicos del presente acuerdo de pago, manifestando encontrarse enterados y aceptarlo por ser su fiel y libre voluntad; y b) Que los otorgantes se encuentran en el libre ejercicio de sus facultades civiles para celebrar este acto. Leída que les fue la presente acta íntegramente en un solo acto sin interrupción, la ratifican y firman conmigo. DOY FE.`, { width: W, align: 'justify', lineGap: 3.5 });

            // Signatures (Fixed at Bottom)
            const sigBoxW = 160;

            // 1. Trabajador
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 5, SIG_Y).lineTo(M + 5 + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL TRABAJADOR', M + 5, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleado, M + 5, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '—'}`, M + 5, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            // 2. Empleador
            const midSigX = M + 180;
            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) doc.image(fAbs, midSigX + 15, SIG_Y - 32, { fit: [80, 28] });
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) doc.image(sAbs, midSigX + 95, SIG_Y - 32, { fit: [65, 28] });
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(midSigX, SIG_Y).lineTo(midSigX + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR EL EMPLEADOR', midSigX, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(firmante, midSigX, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text('REPRESENTANTE PATRONAL', midSigX, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            // 3. Notario
            const rightSigX = M + 360;
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, SIG_Y).lineTo(rightSigX + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('ANTE MÍ: FIRMA Y SELLO', rightSigX, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text((data.notario_nombre || 'NOTARIO').toUpperCase(), rightSigX, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text('NOTARIO AUTORIZADO', rightSigX, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Acta Notarial de Acuerdo de Pago • Documento fehaciente emitido por Sistema Sipe Web SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateHonorarioPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'PAGADURÍA / GERENCIA FINANCIERA';
            const nombrePrestador = (data.nombre || '').trim().toUpperCase();

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const monto = parseFloat(data.monto || 0);
            const isr = parseFloat(data.renta_isr || 0);
            const liquido = parseFloat(data.liquido_pagar || (monto - isr));
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(liquido) : '');

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo, Company, Title Pill) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Numero
                const rightPillW = 220;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE HONORARIOS Y SERVICIOS', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`NÚMERO: ${data.numero || '—'}   •   FECHA: ${fmt(data.fecha)}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Provider Information Card ---
                const cardH = 36;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('PRESTADOR / PROFESIONAL:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(nombrePrestador.substring(0, 38), M + 8, y + 11.5, { width: 230, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('DUI:', M + 260, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                doc.text(data.num_dui || '—', M + 260, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('NIT:', M + 360, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                doc.text(data.num_nit || '—', M + 360, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('RÉGIMEN:', M + 455, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('HONORARIOS (10% ISR)', M + 455, y + 11.5);

                // Card Row 2: Concepto
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('POR CONCEPTO DE: ', M + 8, y + 23.5, { continued: true });
                doc.font('Helvetica-Oblique').fillColor('#334155');
                doc.text((data.concepto || 'Servicios profesionales independientes').substring(0, 85), { width: W - 120, ellipsis: true });

                y += cardH + 5;

                // --- 3. Two Columns: CONCEPTO BRUTO & RETENCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 10;

                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('HONORARIOS DEVENGADOS (VALOR BRUTO)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('RETENCIÓN TRIBUTARIA DE LEY', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 3;

                // Left Column: Bruto
                let percY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Honorarios por Servicios Profesionales', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${monto.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                // Right Column: Retención
                let dedY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Retención ISR 10% (Art. 156 C. Tributario)', rightX + 4, dedY, { width: 185, ellipsis: true });
                doc.text(`$ ${isr.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                // Totals
                const maxRowY = Math.max(percY, dedY) + 2;

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL HONORARIOS BRUTO', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${monto.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL RETENCIÓN DE LEY', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${isr.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 16;

                // --- 4. Líquido a Pagar ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A PAGAR (NETO RECIBIDO):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${liquido.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                y += 9;
                doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                doc.text('Dinero que recibo a mi entera satisfacción por servicios profesionales prestados de forma independiente, aceptando expresamente la retención fiscal efectuada.', M + 4, y, { width: W - 8 });

                // --- 5. Signatures ---
                y += 34;
                const sigLineY = y;
                const sigW = 200;

                // Prestador
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME (PRESTADOR)', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(nombrePrestador, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa
                const rightSigX = M + W - sigW - 15;

                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('AUTORIZADO Y PAGADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text((data.company_name || 'EMPRESA').toUpperCase(), rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Copy label at bottom
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
            };

            // Top Copy (Copia Prestador)
            drawCopy(22, 'COPIA PRESTADOR / PROFESIONAL');

            // Middle dashed divider line
            const PAGE_MID = 396;
            doc.save()
               .strokeColor('#cbd5e1')
               .lineWidth(0.6)
               .dash(4, { space: 3 })
               .moveTo(M, PAGE_MID)
               .lineTo(M + W, PAGE_MID)
               .stroke()
               .undash()
               .restore();

            // Bottom Copy (Original Empresa)
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAguinaldoPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const startX = 30;
    const contentWidth = 732;
    const items = data.items || [];
    const company = data.company || {
        razon_social: data.company_name || 'EMPRESA REGISTRADA',
        nit: data.company_nit || '0000-000000-000-0',
        nrc: data.company_nrc || '000000-0'
    };

    const title = 'PLANILLA DE AGUINALDOS';
    const periodText = data.periodo_label
        ? `CORRESPONDIENTE AL PERÍODO: ${data.periodo_label}`
        : `CORRESPONDIENTE AL EJERCICIO FISCAL ${data.año || new Date().getFullYear()}`;
    const subtitle = data.departamento_label && data.departamento_label !== 'Todos'
        ? `DEPARTAMENTO: ${data.departamento_label}`
        : null;

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    const colW = {
        num: 18,
        codigo: 38,
        nombre: 150,
        cargo: 85,
        ingreso: 48,
        base: 48,
        dias: 28,
        tabla: 26,
        sueldo: 56,
        aguinaldo: 62,
        excedente: 55,
        renta: 50,
        recibir: 68
    };

    const drawTableHeader = (yPos) => {
        doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX + 2;
        doc.text('Nº', x, yPos + 3.5, { width: colW.num, align: 'center' }); x += colW.num;
        doc.text('CÓDIGO', x, yPos + 3.5, { width: colW.codigo }); x += colW.codigo;
        doc.text('EMPLEADO', x, yPos + 3.5, { width: colW.nombre }); x += colW.nombre;
        doc.text('CARGO / PUESTO', x, yPos + 3.5, { width: colW.cargo }); x += colW.cargo;
        doc.text('F. INGRESO', x, yPos + 3.5, { width: colW.ingreso, align: 'center' }); x += colW.ingreso;
        doc.text('F. BASE', x, yPos + 3.5, { width: colW.base, align: 'center' }); x += colW.base;
        doc.text('D. ANT.', x, yPos + 3.5, { width: colW.dias - 2, align: 'right' }); x += colW.dias;
        doc.text('D. LEY', x, yPos + 3.5, { width: colW.tabla - 2, align: 'right' }); x += colW.tabla;
        doc.text('SUELDO B.', x, yPos + 3.5, { width: colW.sueldo - 3, align: 'right' }); x += colW.sueldo;
        doc.text('AGUINALDO', x, yPos + 3.5, { width: colW.aguinaldo - 3, align: 'right' }); x += colW.aguinaldo;
        doc.text('EXC. RENTA', x, yPos + 3.5, { width: colW.excedente - 3, align: 'right' }); x += colW.excedente;
        doc.text('RET. RENTA', x, yPos + 3.5, { width: colW.renta - 3, align: 'right' }); x += colW.renta;
        doc.text('LÍQUIDO', x, yPos + 3.5, { width: colW.recibir - 3, align: 'right' });

        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, yPos + 14).lineTo(startX + contentWidth, yPos + 14).stroke();
        return yPos + 17;
    };

    let y = drawTableHeader(doc.y + 4);

    if (items.length === 0) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
        doc.text('No se encontraron registros de aguinaldos para el período seleccionado.', startX, y + 10);
        y += 30;
    } else {
        const grupos = new Map();
        for (const item of items) {
            const depto = item.departamento_nombre || 'Sin Depto.';
            if (!grupos.has(depto)) grupos.set(depto, []);
            grupos.get(depto).push(item);
        }

        let totalSueldo = 0;
        let totalAguinaldo = 0;
        let totalExcedente = 0;
        let totalRenta = 0;
        let totalRecibir = 0;
        let globalIndex = 0;

        for (const [depto, deptoItems] of grupos) {
            if (grupos.size > 1) {
                if (y > 510) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = drawTableHeader(doc.y + 4);
                }
                doc.rect(startX, y, contentWidth, 12.5).fill('#e2e8f0');
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`DEPARTAMENTO: ${depto.toUpperCase()} (${deptoItems.length} EMPLEADOS)`, startX + 4, y + 2.5);
                y += 15;
            }

            for (const item of deptoItems) {
                globalIndex++;
                if (y > 525) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = drawTableHeader(doc.y + 4);
                }

                const sueldo = parseFloat(item.sueldo_base || 0);
                const aguinaldo = parseFloat(item.aguinaldo_calculado || 0);
                const excedente = parseFloat(item.excedente || 0);
                const renta = parseFloat(item.renta || 0);
                const recibir = parseFloat(item.monto_recibir || 0);

                totalSueldo += sueldo;
                totalAguinaldo += aguinaldo;
                totalExcedente += excedente;
                totalRenta += renta;
                totalRecibir += recibir;

                if (globalIndex % 2 === 0) {
                    doc.rect(startX, y - 1.5, contentWidth, 12).fill('#f8fafc');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
                let rx = startX + 2;
                doc.text(String(globalIndex), rx, y, { width: colW.num, align: 'center' }); rx += colW.num;
                doc.text(item.codigo || '', rx, y, { width: colW.codigo }); rx += colW.codigo;
                const empNombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                doc.text(empNombre.substring(0, 32), rx, y, { width: colW.nombre - 3, ellipsis: true }); rx += colW.nombre;
                const cargoNombre = item.cargo_nombre || 'GENERAL';
                doc.text(cargoNombre.substring(0, 18), rx, y, { width: colW.cargo - 3, ellipsis: true }); rx += colW.cargo;
                doc.text(reportPdfHelper.formatDate(item.fecha_ingreso), rx, y, { width: colW.ingreso, align: 'center' }); rx += colW.ingreso;
                doc.text(reportPdfHelper.formatDate(item.fecha_base), rx, y, { width: colW.base, align: 'center' }); rx += colW.base;
                doc.text(String(item.dias_antiguedad || 0), rx, y, { width: colW.dias - 2, align: 'right' }); rx += colW.dias;
                doc.text(String(item.dias_segun_tabla || 0), rx, y, { width: colW.tabla - 2, align: 'right' }); rx += colW.tabla;
                doc.text(reportPdfHelper.fmt(sueldo), rx, y, { width: colW.sueldo - 3, align: 'right' }); rx += colW.sueldo;
                doc.text(reportPdfHelper.fmt(aguinaldo), rx, y, { width: colW.aguinaldo - 3, align: 'right' }); rx += colW.aguinaldo;
                doc.text(reportPdfHelper.fmt(excedente), rx, y, { width: colW.excedente - 3, align: 'right' }); rx += colW.excedente;
                doc.text(reportPdfHelper.fmt(renta), rx, y, { width: colW.renta - 3, align: 'right' }); rx += colW.renta;
                doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(recibir), rx, y, { width: colW.recibir - 3, align: 'right' });
                y += 12;
            }
        }

        // Totals row
        if (y > 510) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            y = doc.y + 10;
        }

        doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
        y += 4;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTALES GENERALES:', startX + 2, y);

        let tx = startX + colW.num + colW.codigo + colW.nombre + colW.cargo + colW.ingreso + colW.base + colW.dias + colW.tabla;
        doc.text(reportPdfHelper.fmt(totalSueldo), tx, y, { width: colW.sueldo - 3, align: 'right' }); tx += colW.sueldo;
        doc.text(reportPdfHelper.fmt(totalAguinaldo), tx, y, { width: colW.aguinaldo - 3, align: 'right' }); tx += colW.aguinaldo;
        doc.text(reportPdfHelper.fmt(totalExcedente), tx, y, { width: colW.excedente - 3, align: 'right' }); tx += colW.excedente;
        doc.text(reportPdfHelper.fmt(totalRenta), tx, y, { width: colW.renta - 3, align: 'right' }); tx += colW.renta;
        doc.text(reportPdfHelper.fmt(totalRecibir), tx, y, { width: colW.recibir - 3, align: 'right' });

        y += 18;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, y, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return getBuffer();
};

const generateAguinaldoRecibosPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const items = data.items || [];
            const año = data.año || new Date().getFullYear();
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const logoPath = data.logo_url;

            const M = 28;
            const W = 556;

            const fmtDate = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            for (let i = 0; i < items.length; i++) {
                if (i > 0) doc.addPage();
                const item = items[i];
                const sueldo = parseFloat(item.sueldo_base || 0);
                const sueldoDiario = sueldo / 30;
                const aguinaldo = parseFloat(item.aguinaldo_calculado || 0);
                const renta = parseFloat(item.renta || 0);
                const monto = parseFloat(item.monto_recibir || 0);
                const dias = item.dias_antiguedad || 0;
                const anios = (dias / 365).toFixed(1);
                const diasPagados = item.dias_segun_tabla || 0;
                const depto = item.departamento_nombre || 'GENERAL';
                const cargo = item.cargo_nombre || 'GENERAL';
                const nombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                const montoLetras = numberToWords ? numberToWords(monto) : '';

                const drawCopy = (yStart, label) => {
                    let y = yStart;

                    // --- 1. Header (Logo, Company, Title Pill) ---
                    let logoRendered = false;
                    if (logoPath) {
                        try {
                            const f = logoPath.split('/').pop();
                            const p = path.join(__dirname, '..', '..', 'uploads', f);
                            if (fs.existsSync(p)) {
                                doc.image(p, M, y, { fit: [60, 26] });
                                logoRendered = true;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    const companyX = logoRendered ? M + 68 : M;
                    const companyMaxW = logoRendered ? 270 : 330;

                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                    doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                    // Right header pill: Titulo & Periodo
                    const rightPillW = 220;
                    const rightPillX = M + W - rightPillW;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                    doc.text('RECIBO DE AGUINALDO NAVIDEÑO', rightPillX, y, { width: rightPillW, align: 'right' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                    doc.text(`EJERCICIO: ${año}   •   ART. 198 CÓDIGO DE TRABAJO`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                    y += 24;
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                    y += 4;

                    // --- 2. Employee Info Card ---
                    const cardH = 34;
                    doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                    // Row 1
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('EMPLEADO:', M + 8, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                    const cargoDepto = `${cargo} • ${depto}`;
                    doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('DÍAS A PAGAR:', M + 375, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    doc.text(`${diasPagados} DÍAS`, M + 375, y + 11.5);

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('SUELDO MENSUAL:', M + 455, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`$ ${sueldo.toFixed(2)}`, M + 455, y + 11.5);

                    // Row 2 (Metadata badges line)
                    doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                    const metaLine = `CÓD: ${item.codigo || '—'}   |   DUI: ${item.num_dui || '—'}   |   INGRESO: ${fmtDate(item.fecha_ingreso)}   |   ANTIGÜEDAD: ${anios} AÑOS (${dias} DÍAS)   |   S. DIARIO: $ ${sueldoDiario.toFixed(2)}`;
                    doc.text(metaLine, M + 8, y + 23);

                    y += cardH + 5;

                    // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                    const colW = 270;
                    const colGutter = 16;
                    const leftX = M;
                    const rightX = M + colW + colGutter;
                    const headerH = 12;
                    const rowH = 10;

                    // Headers
                    doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                    doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                    doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                    y += headerH + 3;

                    // Left Column: Aguinaldo
                    let percY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text(`Aguinaldo Calculado (${diasPagados} días s/ tabla Art. 198 CT)`, leftX + 4, percY, { width: 185, ellipsis: true });
                    doc.text(`$ ${aguinaldo.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                    percY += rowH;

                    // Right Column: Renta / ISSS / AFP
                    let dedY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text('Impuesto sobre la Renta (ISR s/ Aguinaldo)', rightX + 4, dedY, { width: 185 });
                    doc.text(`$ ${renta.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                    dedY += rowH;

                    // Subtotals
                    const maxRowY = Math.max(percY, dedY) + 2;

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEVENGADO', leftX + 4, maxRowY + 3, { width: 180 });
                    doc.text(`$ ${aguinaldo.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                    doc.text(`$ ${renta.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    y = maxRowY + 16;

                    // --- 4. Líquido a Recibir ---
                    const netH = 17;
                    doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                    doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                    doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                    doc.text(`$ ${monto.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                    y += netH + 3;
                    doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                    doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                    y += 9;
                    doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                    doc.text(`Dinero que recibo a mi entera satisfacción en concepto de liquidación de aguinaldo correspondiente al ejercicio ${año}, en estricto cumplimiento del Art. 198 del Código de Trabajo.`, M + 4, y, { width: W - 8 });

                    // --- 5. Signatures ---
                    y += 34;
                    const sigLineY = y;
                    const sigW = 200;

                    // Empleado
                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text(`DUI: ${item.num_dui || '—'}   |   NIT: ${item.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Empresa / RRHH
                    const rightSigX = M + W - sigW - 15;

                    if (firmaPath) {
                        try {
                            const fFile = firmaPath.split('/').pop();
                            const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                            if (fs.existsSync(fAbs)) {
                                doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                            }
                        } catch (e) {}
                    }
                    if (selloPath) {
                        try {
                            const sFile = selloPath.split('/').pop();
                            const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                            if (fs.existsSync(sAbs)) {
                                doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                            }
                        } catch (e) {}
                    }

                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('AUTORIZADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Copy label at bottom
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                    doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
                };

                // Top Copy (Copia Empleado)
                drawCopy(22, 'COPIA EMPLEADO');

                // Middle dashed divider line
                const PAGE_MID = 396;
                doc.save()
                   .strokeColor('#cbd5e1')
                   .lineWidth(0.6)
                   .dash(4, { space: 3 })
                   .moveTo(M, PAGE_MID)
                   .lineTo(M + W, PAGE_MID)
                   .stroke()
                   .undash()
                   .restore();

                // Bottom Copy (Original Empresa)
                drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateQuincena25PDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const startX = 30;
    const contentWidth = 732;
    const items = data.items || [];
    const company = data.company || {
        razon_social: data.company_name || 'EMPRESA REGISTRADA',
        nit: data.company_nit || '0000-000000-000-0',
        nrc: data.company_nrc || '000000-0'
    };

    const title = 'PLANILLA DE QUINCENA VEINTICINCO (PLANILLA 25)';
    const periodText = `EJERCICIO FISCAL: ${data.anio || new Date().getFullYear()} • LEY ESPECIAL QUINCENA 25 (D.L. Nº 499)`;
    let subtitle = null;
    if (data.departamento_label && data.departamento_label !== 'Todos') {
        subtitle = `DEPARTAMENTO: ${data.departamento_label}`;
    }
    if (data.sucursal_label && data.sucursal_label !== 'Todas') {
        subtitle = subtitle ? `${subtitle}   |   SUCURSAL: ${data.sucursal_label}` : `SUCURSAL: ${data.sucursal_label}`;
    }

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    const colW = {
        num: 20,
        codigo: 42,
        nombre: 152,
        cargo: 90,
        depto: 85,
        ingreso: 50,
        dias: 38,
        condicion: 60,
        sueldo: 65,
        monto: 65,
        recibir: 65
    };

    const drawTableHeader = (yPos) => {
        doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX + 2;
        doc.text('Nº', x, yPos + 3.5, { width: colW.num, align: 'center' }); x += colW.num;
        doc.text('CÓDIGO', x, yPos + 3.5, { width: colW.codigo }); x += colW.codigo;
        doc.text('EMPLEADO', x, yPos + 3.5, { width: colW.nombre }); x += colW.nombre;
        doc.text('CARGO', x, yPos + 3.5, { width: colW.cargo }); x += colW.cargo;
        doc.text('DEPARTAMENTO', x, yPos + 3.5, { width: colW.depto }); x += colW.depto;
        doc.text('F. INGRESO', x, yPos + 3.5, { width: colW.ingreso, align: 'center' }); x += colW.ingreso;
        doc.text('DÍAS COMP.', x, yPos + 3.5, { width: colW.dias, align: 'center' }); x += colW.dias;
        doc.text('CONDICIÓN', x, yPos + 3.5, { width: colW.condicion, align: 'center' }); x += colW.condicion;
        doc.text('SUELDO BASE', x, yPos + 3.5, { width: colW.sueldo - 3, align: 'right' }); x += colW.sueldo;
        doc.text('MONTO Q25', x, yPos + 3.5, { width: colW.monto - 3, align: 'right' }); x += colW.monto;
        doc.text('TOTAL A PAGAR', x, yPos + 3.5, { width: colW.recibir - 3, align: 'right' });

        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, yPos + 14).lineTo(startX + contentWidth, yPos + 14).stroke();
        return yPos + 17;
    };

    let y = drawTableHeader(doc.y + 4);

    if (items.length === 0) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
        doc.text('No se encontraron registros de Quincena 25 para el período seleccionado.', startX, y + 10);
        y += 30;
    } else {
        let totalSueldo = 0;
        let totalMontoQ25 = 0;
        let totalRecibir = 0;
        let globalIndex = 0;

        for (const item of items) {
            globalIndex++;
            if (y > 525) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                y = drawTableHeader(doc.y + 4);
            }

            const sueldo = parseFloat(item.sueldo_base || 0);
            const montoQ25 = parseFloat(item.monto_quincena25 || 0);
            const recibir = parseFloat(item.monto_recibir || 0);

            totalSueldo += sueldo;
            totalMontoQ25 += montoQ25;
            totalRecibir += recibir;

            if (globalIndex % 2 === 0) {
                doc.rect(startX, y - 1.5, contentWidth, 12).fill('#f8fafc');
            }

            doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
            let rx = startX + 2;
            doc.text(String(globalIndex), rx, y, { width: colW.num, align: 'center' }); rx += colW.num;
            doc.text(item.codigo || '', rx, y, { width: colW.codigo }); rx += colW.codigo;
            const empNombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
            doc.text(empNombre.substring(0, 32), rx, y, { width: colW.nombre - 3, ellipsis: true }); rx += colW.nombre;
            const cargoNombre = item.cargo_nombre || 'GENERAL';
            doc.text(cargoNombre.substring(0, 18), rx, y, { width: colW.cargo - 3, ellipsis: true }); rx += colW.cargo;
            const deptoNombre = item.departamento_nombre || 'GENERAL';
            doc.text(deptoNombre.substring(0, 18), rx, y, { width: colW.depto - 3, ellipsis: true }); rx += colW.depto;
            doc.text(reportPdfHelper.formatDate(item.fecha_ingreso), rx, y, { width: colW.ingreso, align: 'center' }); rx += colW.ingreso;
            doc.text(String(item.dias_laborados_anio || 0), rx, y, { width: colW.dias, align: 'center' }); rx += colW.dias;
            const condText = item.es_proporcional ? 'PROPORCIONAL' : '100% LEY';
            doc.text(condText, rx, y, { width: colW.condicion, align: 'center' }); rx += colW.condicion;
            doc.text(reportPdfHelper.fmt(sueldo), rx, y, { width: colW.sueldo - 3, align: 'right' }); rx += colW.sueldo;
            doc.text(reportPdfHelper.fmt(montoQ25), rx, y, { width: colW.monto - 3, align: 'right' }); rx += colW.monto;
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(recibir), rx, y, { width: colW.recibir - 3, align: 'right' });
            y += 12;
        }

        // Totales generales
        if (y > 510) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            y = doc.y + 10;
        }

        doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
        y += 4;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTALES GENERALES:', startX + 2, y);

        let tx = startX + colW.num + colW.codigo + colW.nombre + colW.cargo + colW.depto + colW.ingreso + colW.dias + colW.condicion;
        doc.text(reportPdfHelper.fmt(totalSueldo), tx, y, { width: colW.sueldo - 3, align: 'right' }); tx += colW.sueldo;
        doc.text(reportPdfHelper.fmt(totalMontoQ25), tx, y, { width: colW.monto - 3, align: 'right' }); tx += colW.monto;
        doc.text(reportPdfHelper.fmt(totalRecibir), tx, y, { width: colW.recibir - 3, align: 'right' });

        y += 18;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, y, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return getBuffer();
};

const generateQuincena25RecibosPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const items = data.items || [];
            const anio = data.anio || new Date().getFullYear();
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const logoPath = data.logo_url;

            const M = 28;
            const W = 556;

            const fmtDate = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            for (let i = 0; i < items.length; i++) {
                if (i > 0) doc.addPage();
                const item = items[i];
                const sueldo = parseFloat(item.sueldo_base || 0);
                const sueldoDiario = sueldo / 30;
                const montoQ25 = parseFloat(item.monto_quincena25 || 0);
                const ajuste = parseFloat(item.ajuste || 0);
                const monto = parseFloat(item.monto_recibir || 0);
                const dias = item.dias_laborados_anio || 365;
                const depto = item.departamento_nombre || 'GENERAL';
                const cargo = item.cargo_nombre || 'GENERAL';
                const nombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                const montoLetras = numberToWords ? numberToWords(monto) : '';

                const drawCopy = (yStart, label) => {
                    let y = yStart;

                    // --- 1. Header (Logo, Company, Title Pill) ---
                    let logoRendered = false;
                    if (logoPath) {
                        try {
                            const f = logoPath.split('/').pop();
                            const p = path.join(__dirname, '..', '..', 'uploads', f);
                            if (fs.existsSync(p)) {
                                doc.image(p, M, y, { fit: [60, 26] });
                                logoRendered = true;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    const companyX = logoRendered ? M + 68 : M;
                    const companyMaxW = logoRendered ? 270 : 330;

                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(data.company_name?.toUpperCase() || 'EMPRESA REGISTRADA', companyX, y, { width: companyMaxW, ellipsis: true });
                    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                    doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                    // Right header pill: Titulo & Periodo
                    const rightPillW = 230;
                    const rightPillX = M + W - rightPillW;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                    doc.text('RECIBO DE PAGO DE QUINCENA 25', rightPillX, y, { width: rightPillW, align: 'right' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                    doc.text(`EJERCICIO: ${anio}   •   D.L. Nº 499 (PRESTACIÓN DE LEY)`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                    y += 24;
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                    y += 4;

                    // --- 2. Employee Info Card ---
                    const cardH = 34;
                    doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                    // Row 1
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('EMPLEADO:', M + 8, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                    const cargoDepto = `${cargo} • ${depto}`;
                    doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('CONDICIÓN / DÍAS:', M + 375, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    const condicionLabel = item.es_proporcional ? `PROPORCIONAL (${dias} DÍAS)` : '100% LEY (1 AÑO+)';
                    doc.text(condicionLabel, M + 375, y + 11.5);

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('SUELDO MENSUAL:', M + 465, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`$ ${sueldo.toFixed(2)}`, M + 465, y + 11.5);

                    // Row 2
                    doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                    const metaLine = `CÓD: ${item.codigo || '—'}   |   DUI: ${item.num_dui || '—'}   |   NIT: ${item.num_nit || '—'}   |   INGRESO: ${fmtDate(item.fecha_ingreso)}   |   S. DIARIO: $ ${sueldoDiario.toFixed(2)}`;
                    doc.text(metaLine, M + 8, y + 23);

                    y += cardH + 5;

                    // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                    const colW = 270;
                    const colGutter = 16;
                    const leftX = M;
                    const rightX = M + colW + colGutter;
                    const headerH = 12;
                    const rowH = 10;

                    // Headers
                    doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                    doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                    doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                    y += headerH + 3;

                    // Left Column: Quincena 25
                    let percY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    const descQ25 = item.es_proporcional
                        ? `Quincena 25 Proporcional (${dias} días de servicio - D.L. 499)`
                        : `Quincena 25 (50% Salario Mensual - D.L. 499)`;
                    doc.text(descQ25, leftX + 4, percY, { width: 185, ellipsis: true });
                    doc.text(`$ ${montoQ25.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                    percY += rowH;

                    if (ajuste !== 0) {
                        doc.text('Ajuste o Bonificación Complementaria', leftX + 4, percY, { width: 185, ellipsis: true });
                        doc.text(`$ ${ajuste.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                        percY += rowH;
                    }

                    // Right Column: Sin Deducciones
                    let dedY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
                    doc.text('Prestación Exenta de Renta, ISSS y AFP (0.00)', rightX + 4, dedY, { width: 185 });
                    doc.text('$ 0.00', rightX + 190, dedY, { width: 75, align: 'right' });
                    dedY += rowH;

                    // Subtotals
                    const maxRowY = Math.max(percY, dedY) + 2;

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEVENGADO', leftX + 4, maxRowY + 3, { width: 180 });
                    doc.text(`$ ${monto.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                    doc.text('$ 0.00', rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    y = maxRowY + 16;

                    // --- 4. Líquido a Recibir ---
                    const netH = 17;
                    doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                    doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                    doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                    doc.text(`$ ${monto.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                    y += netH + 3;
                    doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                    doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                    y += 9;
                    doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                    doc.text(`Dinero que recibo a mi entera satisfacción en concepto de la prestación económica extraordinaria Quincena Veinticinco del ejercicio ${anio}, en cumplimiento del Decreto Legislativo N° 499, haciéndose constar que dicho beneficio no admite descuentos de seguridad social ni tributarios.`, M + 4, y, { width: W - 8 });

                    // --- 5. Signatures ---
                    y += 34;
                    const sigLineY = y;
                    const sigW = 200;

                    // Empleado
                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text(`DUI: ${item.num_dui || '—'}   |   NIT: ${item.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Empresa / RRHH
                    const rightSigX = M + W - sigW - 15;

                    if (firmaPath) {
                        try {
                            const fFile = firmaPath.split('/').pop();
                            const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                            if (fs.existsSync(fAbs)) {
                                doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                            }
                        } catch (e) {}
                    }
                    if (selloPath) {
                        try {
                            const sFile = selloPath.split('/').pop();
                            const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                            if (fs.existsSync(sAbs)) {
                                doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                            }
                        } catch (e) {}
                    }

                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('AUTORIZADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Copy label at bottom
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                    doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
                };

                // Top Copy (Copia Empleado)
                drawCopy(22, 'COPIA EMPLEADO');

                // Middle dashed divider line
                const PAGE_MID = 396;
                doc.save()
                   .strokeColor('#cbd5e1')
                   .lineWidth(0.6)
                   .dash(4, { space: 3 })
                   .moveTo(M, PAGE_MID)
                   .lineTo(M + W, PAGE_MID)
                   .stroke()
                   .undash()
                   .restore();

                // Bottom Copy (Original Empresa)
                drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

// --- PLANILLAS Y RECIBOS DE SALARIO ---
const generatePlanillaPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const pageW = 532;
            const BOTTOM = 740;

            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 28, { width: 75 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 125 : M;
            doc.fontSize(14).font('Helvetica-Bold').text(data.company_name, hx, 28);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 44);
            doc.fontSize(12).font('Helvetica-Bold').text('PLANILLA QUINCENAL', M, 28, { align: 'right' });
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5')
                .text(`$ ${parseFloat(data.monto_recibir).toFixed(2)}`, M, 42, { align: 'right' });
            doc.fillColor('black');

            const quincenaLabel = data.quincena === 'primera' ? '1ra' : '2da';
            const mesLabel = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][(data.periodo_mes || 1) - 1] || '';
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '';

            doc.rect(M, 76, pageW, 56).stroke('#e5e7eb');
            doc.fontSize(9).font('Helvetica');
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`;
            doc.text(`Empleado: ${empName}`, M + 12, 86);
            doc.text(`Cargo: ${data.cargo_nombre || ''}`, M + 12, 100);
            doc.text(`Departamento: ${data.departamento_nombre || ''}`, M + 12, 114);
            doc.text(`Periodo: ${mesLabel} ${data.periodo_anio} - ${quincenaLabel} Quincena`, 280, 86);
            doc.text(`Dias Trabajados: ${data.dias_trabajados || 0}`, 280, 100);
            doc.text(`Sueldo Base: $ ${parseFloat(data.sueldo_base).toFixed(2)}`, 280, 114);

            let ry = 148;
            doc.fontSize(10).font('Helvetica-Bold').text('DETALLE DE PLANILLA', M, ry);
            ry += 18;

            const col1X = M;
            const col2X = 300;
            const colVal1 = 250;
            const colVal2 = 510;
            const rowH = 14;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
            doc.text('PERCEPCIONES', col1X, ry);
            doc.text('DEDUCCIONES', col2X, ry);
            doc.fillColor('black');
            ry += 14;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 4;

            // Agrupar TODAS las horas extras (por descripción) en una sola fila
            const rawPercepciones = (data.detalles || []).filter(d => d.operacion === 'sumar');
            const esHoraExtra = (d) => (d.descripcion || '').toUpperCase().includes('HORA');
            const horasExtras = rawPercepciones.filter(esHoraExtra);
            const otrasPercepciones = rawPercepciones.filter(d => !esHoraExtra(d));
            const percepciones = horasExtras.length > 0
                ? [...otrasPercepciones, { codigo: 'HE', descripcion: 'HORAS EXTRAS', valor_ingresado: horasExtras.reduce((s, d) => s + parseFloat(d.valor_ingresado || 0), 0) }]
                : otrasPercepciones;
            const deducciones = (data.detalles || []).filter(d => d.operacion === 'restar');

            doc.font('Helvetica').fontSize(8);
            const maxRows = Math.max(percepciones.length, deducciones.length);
            for (let i = 0; i < maxRows; i++) {
                if (i < percepciones.length) {
                    const p = percepciones[i];
                    doc.text(`${p.codigo} - ${p.descripcion}`, col1X, ry);
                    doc.text(`$ ${parseFloat(p.valor_ingresado || 0).toFixed(2)}`, colVal1, ry, { align: 'right' });
                }
                if (i < deducciones.length) {
                    const d = deducciones[i];
                    doc.text(`${d.codigo} - ${d.descripcion}`, col2X, ry);
                    doc.text(`$ ${parseFloat(d.valor_ingresado || 0).toFixed(2)}`, colVal2, ry, { align: 'right' });
                }
                ry += rowH;
            }

            ry += 2;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('TOTAL PERCEPCIONES', col1X, ry);
            doc.text(`$ ${parseFloat(data.total_percepciones).toFixed(2)}`, colVal1, ry, { align: 'right' });
            ry += 16;

            doc.font('Helvetica').fontSize(9);
            doc.text('RETENCIONES DE LEY:', col2X, ry - 16);
            const isssPct = data.isss_porcentaje || 0;
            const afpPct = data.afp_porcentaje || 0;
            doc.text(`ISSS (${isssPct}%)`, col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_isss).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 14;
            doc.text(`AFP (${afpPct}%)`, col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_afp).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 14;
            doc.text('RENTA', col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_renta).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 16;
            doc.moveTo(col2X, ry).lineTo(colVal2, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('TOTAL DEDUCCIONES', col2X, ry);
            doc.text(`$ ${parseFloat(data.total_deducciones).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 22;

            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#4f46e5');
            ry += 6;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#4f46e5');
            doc.text('MONTO A RECIBIR', M, ry);
            doc.text(`$ ${parseFloat(data.monto_recibir).toFixed(2)}`, colVal1, ry, { align: 'right' });
            doc.fillColor('black');

            const legalY = ry + 24;
            doc.fontSize(8).font('Helvetica-Oblique')
                .text(`Recibí de ${data.company_name} la cantidad de ${data.monto_letras}, en concepto de planilla quincenal.`, M, legalY, { width: pageW, align: 'justify' });

            const today = new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(9).font('Helvetica').text(`San Salvador, ${today}`, M, legalY + 20);

            const firmY = BOTTOM - 90;
            doc.moveTo(100, firmY).lineTo(270, firmY).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Recibí Conforme', 125, firmY + 4, { align: 'center', width: 120 });
            doc.fontSize(9).font('Helvetica-Bold')
                .text(empName, M, firmY + 22);
            doc.fontSize(8).font('Helvetica').text('FIRMA', M, firmY + 36);
            let extraY = firmY + 50;
            if (data.num_dui) { doc.text(`DUI: ${data.num_dui}`, M, extraY); extraY += 12; }
            if (data.num_nit) { doc.text(`NIT: ${data.num_nit}`, M, extraY); }

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generatePlanillaReciboPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 24, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const quincenaLabel = data.quincena === 'primera' ? '1ra' : '2da';
            const mesLabel = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][(data.periodo_mes || 1) - 1] || '';
            const mesAnio = `${mesLabel} ${data.periodo_anio}`;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : 'N/A';

            // Agrupar TODAS las horas extras (por descripción) en una sola fila
            const rawPercepciones = (data.detalles || []).filter(d => d.operacion === 'sumar');
            const esHoraExtra = (d) => (d.descripcion || '').toUpperCase().includes('HORA');
            const horasExtras = rawPercepciones.filter(esHoraExtra);
            const otrasPercepciones = rawPercepciones.filter(d => !esHoraExtra(d));
            const percepciones = horasExtras.length > 0
                ? [...otrasPercepciones, { codigo: 'HE', descripcion: 'HORAS EXTRAS', valor_ingresado: horasExtras.reduce((s, d) => s + parseFloat(d.valor_ingresado || 0), 0) }]
                : otrasPercepciones;
            const deducciones = (data.detalles || []).filter(d => d.operacion === 'restar');

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo / Company / Title) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Periodo
                const rightPillW = 210;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE PLANILLA QUINCENAL', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`${quincenaLabel.toUpperCase()} QUINCENA • ${mesAnio.toUpperCase()}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Employee Info Card ---
                const cardH = 34;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('EMPLEADO:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                const cargoDepto = `${data.cargo_nombre || 'GENERAL'} • ${data.departamento_nombre || 'GENERAL'}`;
                doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('DÍAS TRAB.:', M + 375, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`${data.dias_trabajados || 0} DÍAS`, M + 375, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('SUELDO BASE:', M + 450, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(`$ ${parseFloat(data.sueldo_base || 0).toFixed(2)}`, M + 450, y + 11.5);

                // Card Row 2 (Metadata badges line)
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                const metaLine = `CÓD: ${data.empleado_codigo || data.codigo || '—'}    |    DUI: ${data.num_dui || '—'}    |    NIT: ${data.num_nit || '—'}    |    INGRESO: ${fmt(data.fecha_ingreso)}`;
                doc.text(metaLine, M + 8, y + 23);

                y += cardH + 5;

                // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 9.5;

                // Table Column Headers
                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 2;

                // Render Left Column (Percepciones)
                let percY = y;
                for (const p of percepciones) {
                    const val = parseFloat(p.valor_ingresado || 0);
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text(`${p.codigo} - ${p.descripcion}`, leftX + 4, percY, { width: 185, ellipsis: true });
                    doc.text(`$ ${val.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                    percY += rowH;
                }

                // Render Right Column (Deducciones)
                let dedY = y;
                const isssPct = data.isss_porcentaje || 0;
                const afpPct = data.afp_porcentaje || 0;

                doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
                doc.text('RETENCIONES DE LEY:', rightX + 4, dedY, { width: 185 });
                dedY += rowH;

                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text(`ISSS (${isssPct}%)`, rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_isss || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text(`AFP (${afpPct}%)`, rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_afp || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text('Impuesto sobre la Renta', rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_renta || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                if (deducciones.length > 0) {
                    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
                    doc.text('OTRAS DEDUCCIONES:', rightX + 4, dedY, { width: 185 });
                    dedY += rowH;
                    for (const d of deducciones) {
                        const val = parseFloat(d.valor_ingresado || 0);
                        doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                        doc.text(`${d.codigo} - ${d.descripcion}`, rightX + 10, dedY, { width: 175, ellipsis: true });
                        doc.text(`$ ${val.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                        dedY += rowH;
                    }
                }

                // Subtotales / Totales de columna
                const maxRowY = Math.max(percY, dedY) + 2;

                // Total Percepciones
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL PERCEPCIONES', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${parseFloat(data.total_percepciones || 0).toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                // Total Deducciones
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${parseFloat(data.total_deducciones || 0).toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 16;

                // --- 4. Líquido a Recibir ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${parseFloat(data.monto_recibir || 0).toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${data.monto_letras || ''}`, M + 4, y, { width: W - 8 });

                // --- 5. Signatures (Generous spacing so signatures NEVER overlap with Monto / Letras) ---
                y += 36;
                const sigLineY = y;
                const sigW = 200;

                // Empleado
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || 'N/A'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa / RRHH
                const rightSigX = M + W - sigW - 15;

                // Firma y Sello images placed cleanly above the line
                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                doc.text('RECURSOS HUMANOS', rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });

                // Copy tag
                doc.fontSize(5.8).font('Helvetica-Bold').fillColor('#94a3b8');
                doc.text(`[ ${label} ]`, M, sigLineY + 22, { width: W, align: 'center' });

                return y;
            };

            // Top copy - Empleado
            drawCopy(22, 'COPIA EMPLEADO');

            // Page middle divider (clean dashed or light line)
            const PAGE_MID = 396;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(4, { space: 3 })
               .moveTo(28, PAGE_MID).lineTo(28 + 556, PAGE_MID).stroke().undash();

            // Bottom copy - Empresa
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    generateVacacionPDF,
    generateLiquidacionPDF,
    generateFiniquitoPDF,
    generateAcuerdoPagoPDF,
    generateHonorarioPDF,
    generateAguinaldoPDF,
    generateAguinaldoRecibosPDF,
    generateQuincena25PDF,
    generateQuincena25RecibosPDF,
    generatePlanillaPDF,
    generatePlanillaReciboPDF
};
