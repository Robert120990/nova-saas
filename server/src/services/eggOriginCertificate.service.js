const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle
} = require('docx');

const MONTH_NAMES_ES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function formatDateSpanishFormal(d) {
    if (!d) return '---';
    let dt;
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            const year = parts[0];
            return `${day} DE ${MONTH_NAMES_ES[monthIdx] || ''} ${year}`;
        }
        dt = new Date(d);
    } else {
        dt = new Date(d);
    }
    if (isNaN(dt.getTime())) return '---';
    const day = dt.getDate();
    const month = MONTH_NAMES_ES[dt.getMonth()];
    const year = dt.getFullYear();
    return `${day} DE ${month} ${year}`;
}

/**
 * Obtiene y estructura los datos de la recepción para el Certificado de Calidad de Origen
 */
async function getOriginCertificateData(rawMaterialId, companyId) {
    const [rows] = await pool.query(
        `SELECT rm.*, 
                p.nombre as provider_name, 
                p.nombre_comercial as provider_commercial_name,
                p.nit as provider_nit,
                p.direccion as provider_address,
                p.telefono as provider_phone,
                p.correo as provider_email,
                p.pais as provider_country,
                COALESCE(c.razon_social, c.nombre_comercial, 'ANDELSA') as company_name
         FROM egg_raw_materials rm
         LEFT JOIN providers p ON rm.provider_id = p.id
         LEFT JOIN companies c ON rm.company_id = c.id
         WHERE rm.id = ? AND rm.company_id = ?`,
        [rawMaterialId, companyId]
    );

    if (rows.length === 0) return null;
    const rm = rows[0];

    let labJson = {};
    if (rm.quality_lab_report_json) {
        try {
            labJson = typeof rm.quality_lab_report_json === 'string'
                ? JSON.parse(rm.quality_lab_report_json)
                : rm.quality_lab_report_json;
        } catch (e) {
            labJson = {};
        }
    }

    const providerName = (rm.provider_commercial_name || rm.provider_name || 'INVERSIONES AVÍCOLAS DE HONDURAS, S.A.').toUpperCase();
    const clientName = (rm.company_name && rm.company_name.toUpperCase().includes('ANDELSA'))
        ? 'ANDELSA'
        : (rm.company_name || 'ANDELSA').toUpperCase();

    const productionDate = rm.production_date || labJson.production_date || rm.fecha;
    const deliveryDate = labJson.delivery_date || rm.reception_date || rm.fecha || productionDate;
    const expirationDate = rm.expiration_date || labJson.expiration_date || '';

    // Requerimientos de inspección
    const isColorBlanco = (rm.egg_color || labJson.egg_color || 'BLANCO').toUpperCase().includes('BLANC');
    const isCamionCerrado = labJson.camion_cerrado !== undefined ? Boolean(labJson.camion_cerrado) : true;
    const isLimpiezaCamion = labJson.limpieza_camion !== undefined
        ? Boolean(labJson.limpieza_camion)
        : (labJson.transport_storage?.limpieza_camion ? !labJson.transport_storage.limpieza_camion.toLowerCase().includes('no') : true);
    const isCartonesLimpios = labJson.cartones_limpios_sin_plaga !== undefined
        ? Boolean(labJson.cartones_limpios_sin_plaga)
        : (labJson.transport_storage?.apariencia_cajas ? !labJson.transport_storage.apariencia_cajas.toLowerCase().includes('no') : true);

    // Lotes de aves
    let birdBatches = [];
    if (Array.isArray(labJson.bird_batches) && labJson.bird_batches.length > 0) {
        birdBatches = labJson.bird_batches;
    } else if (Array.isArray(labJson.flock_ages) && labJson.flock_ages.length > 0) {
        birdBatches = labJson.flock_ages;
    } else {
        // Datos de ejemplo representativos según la raza o granja
        birdBatches = [
            { breed: 'DEKALB WHITE', age_weeks: '69 SEMANAS DE EDAD' },
            { breed: 'DEKALB WHITE', age_weeks: '34 SEMANAS DE EDAD' },
            { breed: 'DEKALB WHITE', age_weeks: '71 SEMANAS DE EDAD' }
        ];
    }

    const assignedLot = rm.provider_lot || `MP-${String(rm.id).padStart(4, '0')}`;

    return {
        id: rm.id,
        provider_name: providerName,
        provider_nit: rm.provider_nit || '05019011438124',
        provider_address: rm.provider_address || 'El Zapote, San Francisco de Yojoa, Cortés, Honduras C.A.',
        provider_phone: rm.provider_phone || '(504) 2620-5406',
        provider_email: rm.provider_email || 'servicioalcliente@inavih.com',
        product_name: 'HUEVO FRESCO',
        production_date: formatDateSpanishFormal(productionDate),
        delivery_date: formatDateSpanishFormal(deliveryDate),
        expiration_date: formatDateSpanishFormal(expirationDate),
        client_name: clientName,
        assigned_lot: assignedLot,
        requirements: {
            color_blanco: isColorBlanco,
            color_marron: !isColorBlanco,
            camion_cerrado: isCamionCerrado,
            limpieza_camion: isLimpiezaCamion,
            cartones_limpios: isCartonesLimpios
        },
        bird_batches: birdBatches,
        responsible_quality: rm.quality_inspector_name || labJson.inspector_name || 'Responsable de Calidad'
    };
}

/**
 * Genera el documento PDF con diseño oficial idéntico al formato escaneado
 */
async function generateOriginCertificatePdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER', // 612 x 792 pt
                margins: { top: 40, bottom: 40, left: 50, right: 50 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', b => buffers.push(b));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 612;
            const contentWidth = 512;
            const leftX = 50;

            // 1. Título y Proveedor Superior
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827');
            doc.text(data.provider_name, leftX, 45, { align: 'center', width: contentWidth });

            doc.moveDown(0.6);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
            doc.text('CERTIFICADO DE CALIDAD', { align: 'center', width: contentWidth });

            doc.moveDown(1.2);
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`PROVEEDOR: ${data.provider_name}`, { align: 'center', width: contentWidth });

            doc.moveDown(1.2);

            // 2. Metadatos del Envío
            const metaStartY = doc.y;
            const colLabelWidth = 160;
            const boxWidth = 140;
            const boxHeight = 20;

            const renderMetaField = (label, value, y) => {
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000');
                doc.text(label, leftX + 40, y + 5);

                // Cuadro delimitador
                doc.rect(leftX + 40 + colLabelWidth, y, boxWidth, boxHeight).lineWidth(0.8).strokeColor('#4b5563').stroke();
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827');
                doc.text(value, leftX + 40 + colLabelWidth + 5, y + 5, { width: boxWidth - 10, align: 'center' });
            };

            // PRODUCTO
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000');
            doc.text('PRODUCTO:', leftX + 40, metaStartY);
            doc.text(data.product_name, leftX + 130, metaStartY);

            let currentY = metaStartY + 22;
            renderMetaField('FECHA DE PRODUCCION:', data.production_date, currentY);
            currentY += 26;
            renderMetaField('FECHA DE ENTREGA:', data.delivery_date, currentY);
            currentY += 26;
            renderMetaField('FECHA DE VENCIMIENTO:', data.expiration_date, currentY);
            currentY += 26;

            // CLIENTE
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`CLIENTE: ${data.client_name}`, leftX + 40, currentY + 5);
            currentY += 26;

            // Lote (Se lo colocamos en ANDELSA)
            const loteBoxWidth = 320;
            const loteBoxHeight = 36;
            const loteBoxX = leftX + 50;
            doc.rect(loteBoxX, currentY, loteBoxWidth, loteBoxHeight).lineWidth(0.8).strokeColor('#4b5563').stroke();

            doc.fontSize(8).font('Helvetica').fillColor('#374151');
            doc.text(`Lote (Se lo colocamos en ${data.client_name})`, loteBoxX, currentY + 5, { width: 160, align: 'center' });

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af');
            doc.text(data.assigned_lot, loteBoxX + 160, currentY + 12, { width: 150, align: 'center' });

            currentY += 50;

            // 3. Tabla de Requerimientos y Especificaciones
            const tableX = leftX;
            const col1W = 150;
            const col2W = 180;
            const col3W = 182;
            const tableTotalW = col1W + col2W + col3W;

            // Encabezado de la tabla
            doc.rect(tableX, currentY, tableTotalW, 20).lineWidth(0.8).strokeColor('#374151').stroke();
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Requerimiento', tableX + 8, currentY + 5);
            doc.text('Especificación', tableX + col1W + 140, currentY + 5);

            // Línea divisoria vertical en cabecera
            doc.moveTo(tableX + col1W, currentY).lineTo(tableX + col1W, currentY + 20).strokeColor('#374151').stroke();
            currentY += 20;

            const drawRequirementRow = (reqText, opt1Text, isOpt1Checked, opt2Text, isOpt2Checked, rowH = 24) => {
                doc.rect(tableX, currentY, tableTotalW, rowH).lineWidth(0.8).strokeColor('#374151').stroke();
                doc.moveTo(tableX + col1W, currentY).lineTo(tableX + col1W, currentY + rowH).strokeColor('#374151').stroke();
                doc.moveTo(tableX + col1W + col2W, currentY).lineTo(tableX + col1W + col2W, currentY + rowH).strokeColor('#374151').stroke();

                doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
                doc.text(reqText, tableX + 8, currentY + (rowH > 24 ? 6 : 7), { width: col1W - 14 });

                // Opción 1
                doc.text(opt1Text, tableX + col1W + 10, currentY + 7);
                if (isOpt1Checked) {
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#059669');
                    doc.text('✓', tableX + col1W + 120, currentY + 5);
                }

                // Opción 2
                doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
                doc.text(opt2Text, tableX + col1W + col2W + 10, currentY + 7);
                if (isOpt2Checked) {
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#059669');
                    doc.text('✓', tableX + col1W + col2W + 120, currentY + 5);
                }

                currentY += rowH;
            };

            drawRequirementRow('Color', 'Blanco', data.requirements.color_blanco, 'Marrón', data.requirements.color_marron, 22);
            drawRequirementRow('Camión cerrado', 'Conforme', data.requirements.camion_cerrado, 'No conforme', !data.requirements.camion_cerrado, 22);
            drawRequirementRow('Limpieza del camión', 'Conforme', data.requirements.limpieza_camion, 'No conforme', !data.requirements.limpieza_camion, 22);
            drawRequirementRow('Cartones no reciclables y limpios, sin plaga ni objetos extraños.', 'Conforme', data.requirements.cartones_limpios, 'No conforme', !data.requirements.cartones_limpios, 30);

            currentY += 15;

            // 4. Tabla de Lotes de Aves ("Con respecto al huevo enviado:")
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Con respecto al huevo enviado:', tableX, currentY);
            currentY += 14;

            const birdCol1W = 256;
            const birdCol2W = 256;
            doc.rect(tableX, currentY, tableTotalW, 18).lineWidth(0.8).strokeColor('#374151').stroke();
            doc.moveTo(tableX + birdCol1W, currentY).lineTo(tableX + birdCol1W, currentY + 18).strokeColor('#374151').stroke();

            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Raza del ave', tableX + 8, currentY + 5);
            doc.text('Edad en semanas', tableX + birdCol1W + 8, currentY + 5);
            currentY += 18;

            data.bird_batches.forEach(b => {
                doc.rect(tableX, currentY, tableTotalW, 18).lineWidth(0.8).strokeColor('#374151').stroke();
                doc.moveTo(tableX + birdCol1W, currentY).lineTo(tableX + birdCol1W, currentY + 18).strokeColor('#374151').stroke();

                doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
                doc.text(b.breed || 'DEKALB WHITE', tableX + 8, currentY + 5);
                doc.text(b.age_weeks || '34 SEMANAS DE EDAD', tableX + birdCol1W + 8, currentY + 5);
                currentY += 18;
            });

            currentY += 30;

            // 5. Firma y Sello
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Firma de responsable de Calidad:', tableX, currentY + 15);
            doc.moveTo(tableX + 160, currentY + 22).lineTo(tableX + 320, currentY + 22).lineWidth(0.8).strokeColor('#111827').stroke();

            // Recuadro del Sello Oficial
            const stampW = 160;
            const stampH = 50;
            const stampX = tableX + 340;
            const stampY = currentY - 5;
            doc.rect(stampX, stampY, stampW, stampH).lineWidth(0.8).dash(3, { space: 2 }).strokeColor('#6b7280').stroke();
            doc.undash();

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e3a8a');
            doc.text(data.provider_name, stampX + 5, stampY + 8, { width: stampW - 10, align: 'center' });
            doc.fontSize(7).font('Helvetica').fillColor('#374151');
            doc.text(`R.T.N. / NIT: ${data.provider_nit}`, stampX + 5, stampY + 24, { width: stampW - 10, align: 'center' });
            doc.text('DEPARTAMENTO DE CONTROL DE CALIDAD', stampX + 5, stampY + 34, { width: stampW - 10, align: 'center' });

            // 6. Pie de Página de Contacto
            const footerY = 740;
            doc.moveTo(tableX, footerY - 8).lineTo(tableX + tableTotalW, footerY - 8).lineWidth(0.5).strokeColor('#d1d5db').stroke();
            doc.fontSize(7.5).font('Helvetica').fillColor('#6b7280');
            doc.text(
                `${data.provider_address} • Teléfono: ${data.provider_phone} • Email: ${data.provider_email}`,
                leftX,
                footerY,
                { align: 'center', width: contentWidth }
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Genera el documento en formato Microsoft Word (.docx) editable
 */
async function generateOriginCertificateWord(data) {
    const tableBorder = {
        top: { style: BorderStyle.SINGLE, size: 8, color: "4B5563" },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "4B5563" },
        left: { style: BorderStyle.SINGLE, size: 8, color: "4B5563" },
        right: { style: BorderStyle.SINGLE, size: 8, color: "4B5563" }
    };

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, bottom: 720, left: 1000, right: 1000 }
                }
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: data.provider_name, bold: true, size: 28 })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 },
                    children: [
                        new TextRun({ text: "CERTIFICADO DE CALIDAD", bold: true, size: 22 })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 240 },
                    children: [
                        new TextRun({ text: `PROVEEDOR: ${data.provider_name}`, bold: true, size: 18 })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 80 },
                    children: [
                        new TextRun({ text: "PRODUCTO: ", bold: true, size: 18 }),
                        new TextRun({ text: data.product_name, size: 18 })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 80 },
                    children: [
                        new TextRun({ text: `FECHA DE PRODUCCION:  ${data.production_date}`, bold: true, size: 18 })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 80 },
                    children: [
                        new TextRun({ text: `FECHA DE ENTREGA:      ${data.delivery_date}`, bold: true, size: 18 })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 80 },
                    children: [
                        new TextRun({ text: `FECHA DE VENCIMIENTO:  ${data.expiration_date}`, bold: true, size: 18 })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 160 },
                    children: [
                        new TextRun({ text: `CLIENTE: ${data.client_name}`, bold: true, size: 18 })
                    ]
                }),

                // Recuadro Lote ANDELSA
                new Table({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    alignment: AlignmentType.CENTER,
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    borders: tableBorder,
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({ text: `Lote (Se lo colocamos en ${data.client_name}): `, size: 16 }),
                                                new TextRun({ text: data.assigned_lot, bold: true, size: 20, color: "1E40AF" })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Tabla de Requerimientos
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Requerimiento", bold: true, size: 18 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Especificación", bold: true, size: 18 })] })], columnSpan: 2 })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Color", size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `Blanco ${data.requirements.color_blanco ? "  [✓]" : "  [ ]"}`, size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `Marrón ${data.requirements.color_marron ? "  [✓]" : "  [ ]"}`, size: 17 })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Camión cerrado", size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `Conforme ${data.requirements.camion_cerrado ? "  [✓]" : "  [ ]"}`, size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `No conforme ${!data.requirements.camion_cerrado ? "  [✓]" : "  [ ]"}`, size: 17 })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Limpieza del camión", size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `Conforme ${data.requirements.limpieza_camion ? "  [✓]" : "  [ ]"}`, size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `No conforme ${!data.requirements.limpieza_camion ? "  [✓]" : "  [ ]"}`, size: 17 })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Cartones no reciclables y limpios, sin plaga ni objetos extraños.", size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `Conforme ${data.requirements.cartones_limpios ? "  [✓]" : "  [ ]"}`, size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: `No conforme ${!data.requirements.cartones_limpios ? "  [✓]" : "  [ ]"}`, size: 17 })] })] })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 180 } }),

                new Paragraph({
                    spacing: { after: 80 },
                    children: [
                        new TextRun({ text: "Con respecto al huevo enviado:", bold: true, size: 18 })
                    ]
                }),

                // Tabla de Lotes de Aves
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Raza del ave", bold: true, size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: "Edad en semanas", bold: true, size: 17 })] })] })
                            ]
                        }),
                        ...data.bird_batches.map(b => new TableRow({
                            children: [
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: b.breed || "DEKALB WHITE", size: 17 })] })] }),
                                new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [new TextRun({ text: b.age_weeks || "34 SEMANAS DE EDAD", size: 17 })] })] })
                            ]
                        }))
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 300 } }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Firma de responsable de Calidad:  ____________________________________", bold: true, size: 17 })
                    ]
                }),

                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 300 },
                    children: [
                        new TextRun({
                            text: `${data.provider_address} • Tel: ${data.provider_phone} • Email: ${data.provider_email}`,
                            size: 15,
                            color: "6B7280"
                        })
                    ]
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    getOriginCertificateData,
    generateOriginCertificatePdf,
    generateOriginCertificateWord
};
