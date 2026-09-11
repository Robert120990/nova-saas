const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    Footer,
    ShadingType
} = require('docx');

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
    const num = parseFloat(val) || 0;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Genera un archivo Word (.docx) editable con el diseño oficial y corporativo de Eggcelent / ANDELSA
 * @param {Object} quotation Datos de la cotización y sus ítems
 * @returns {Promise<Buffer>} Buffer del documento Word generado
 */
async function generateQuotationDocx(quotation) {
    const items = quotation.items || [];
    let headerImageBuffer = null;
    if (fs.existsSync(HEADER_IMAGE_PATH)) {
        try {
            headerImageBuffer = fs.readFileSync(HEADER_IMAGE_PATH);
        } catch (e) {
            console.warn('No se pudo cargar la imagen de encabezado para Word:', e.message);
        }
    }

    let signatureImageBuffer = null;
    if (quotation.signature_data && quotation.signature_data.startsWith('data:image')) {
        try {
            const base64 = quotation.signature_data.replace(/^data:image\/\w+;base64,/, '');
            signatureImageBuffer = Buffer.from(base64, 'base64');
        } catch (e) {
            console.warn('No se pudo decodificar la firma para Word:', e.message);
        }
    }

    const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
    const borderNone = { style: BorderStyle.NONE, size: 0, color: 'auto' };
    const tableBorders = {
        top: cellBorder,
        bottom: cellBorder,
        left: cellBorder,
        right: cellBorder,
        insideHorizontal: cellBorder,
        insideVertical: cellBorder
    };

    // 1. Tabla de Productos
    const tableRows = [
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'PRODUCTO', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.LEFT })]
                }),
                new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'PRESENTACIÓN', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.LEFT })]
                }),
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'CANT.', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'PRECIO UNIT. (+IVA)', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                }),
                new TableCell({
                    width: { size: 13, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'SUBTOTAL', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                }),
                new TableCell({
                    width: { size: 13, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'NOTAS / DETALLE', bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.LEFT })]
                })
            ]
        })
    ];

    items.forEach((item, idx) => {
        const fill = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
        const qtyVal = parseFloat(item.quantity) || 1;
        const priceVal = parseFloat(item.unit_price) || 0;
        const itemSubtotal = parseFloat(item.subtotal || item.total) || (qtyVal * priceVal);

        tableRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: item.product_name || 'PRODUCTO', bold: true, size: 17, color: '0F172A' })]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 18, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: item.presentation || 'Estándar', size: 16, color: '334155' })]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: qtyVal.toString(), bold: true, size: 17, color: '0F172A' })],
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 18, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: formatMoney(priceVal), size: 17, color: '0F172A' })],
                                alignment: AlignmentType.RIGHT
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 13, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: formatMoney(itemSubtotal), bold: true, size: 17, color: '0F172A' })],
                                alignment: AlignmentType.RIGHT
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 13, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: item.notes || '', italics: true, size: 15, color: '64748B' })]
                            })
                        ]
                    })
                ]
            })
        );
    });

    // 2. Tabla de Totales (Alineada a la derecha)
    const totalsTable = new Table({
        width: { size: 45, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.RIGHT,
        borders: tableBorders,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: 'Subtotal:', size: 17, color: '475569' })] })]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: formatMoney(quotation.subtotal), bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: 'IVA (13%):', size: 17, color: '475569' })] })]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: formatMoney(quotation.tax_amount), bold: true, size: 17, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL COTIZADO:', bold: true, size: 18, color: '0F172A' })] })]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ children: [new TextRun({ text: formatMoney(quotation.total), bold: true, size: 19, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                    })
                ]
            })
        ]
    });

    const authorName = quotation.signature_author_name || quotation.created_by_name || 'Raul Rafael Sosa M.';
    const authorTitle = quotation.signature_author_title || 'Ejecutivo Comercial';
    const authorPhone = quotation.signature_author_phone || '(503) 7060-5040';

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Arial'
                    }
                }
            }
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 576, bottom: 576, left: 720, right: 720 }
                    }
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR S.A DE C.V', bold: true, size: 15, color: '0F172A' })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 20 }
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'Antigua Carretera a Zacatecoluca km. 38.5 Cantón Asunción Amate, El Rosario, Dpto. de La Paz, El Salvador. C.A.', size: 13, color: '475569' })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 20 }
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: '+503 2330-5800  •  @eggcelentsv', bold: true, size: 15, color: 'EA991C' })
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                },
                children: [
                    // 1. Header Banner Oficial
                    ...(headerImageBuffer
                        ? [
                              new Paragraph({
                                  children: [
                                      new ImageRun({
                                          data: headerImageBuffer,
                                          transformation: { width: 560, height: 62 },
                                          type: 'png'
                                      })
                                  ],
                                  alignment: AlignmentType.CENTER,
                                  spacing: { after: 140 }
                              })
                          ]
                        : [
                              new Paragraph({
                                  children: [
                                      new TextRun({ text: 'ANDELSA / Eggcelent', bold: true, size: 26, color: 'EA991C' })
                                  ],
                                  spacing: { after: 120 }
                              })
                          ]),

                    // 2. Fecha y Correlativo en Encabezado
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: borderNone,
                            bottom: borderNone,
                            left: borderNone,
                            right: borderNone,
                            insideHorizontal: borderNone,
                            insideVertical: borderNone
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 60, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: `Rosario de La Paz, ${formatDateFormal(quotation.date)}`, bold: true, size: 20, color: '1E293B' })
                                                ]
                                            })
                                        ]
                                    }),
                                    new TableCell({
                                        width: { size: 40, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: `Cotización N°: ${quotation.quote_number || 'COT-BORRADOR'}`, bold: true, size: 20, color: '64748B' })
                                                ],
                                                alignment: AlignmentType.RIGHT
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),

                    new Paragraph({ spacing: { after: 120 } }),

                    // 3. Destinatario
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Estimados', bold: true, size: 20, color: '0F172A' })
                        ],
                        spacing: { after: 30 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: quotation.customer_name || 'Cliente Estimado', bold: true, size: 22, color: '0F172A' })
                        ],
                        spacing: { after: 30 }
                    }),
                    ...(quotation.customer_contact ? [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `Atención: ${quotation.customer_contact}`, size: 18, color: '475569' })
                            ],
                            spacing: { after: 30 }
                        })
                    ] : []),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Presente', bold: true, size: 20, color: '0F172A' })
                        ],
                        spacing: { after: 140 }
                    }),

                    // 4. Saludo Institucional y Párrafos Introductorios Oficiales
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Reciban un cordial saludo de Alimentos Nutricionales de El Salvador S.A. de C.V.', bold: true, size: 18, color: '0F172A' })
                        ],
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Agradecemos la oportunidad de ofrecerles nuestros productos. Alimentos Nutricionales de El Salvador es una empresa industrial especializada en la fabricación y formulación de huevo líquido pasteurizado para la industria de restaurantes, hoteles y panaderías con más de 25 años de experiencia, pioneros en Centroamérica.',
                                size: 17,
                                color: '334155'
                            })
                        ],
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { after: 60, line: 260 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'ANDELSA cuenta con certificación HACCP, lo que garantiza procesos controlados y apegados a los más altos estándares de inocuidad y calidad para brindarles un servicio superior. Contamos con las instalaciones, tecnología y personal idóneo para el manejo óptimo de los productos.',
                                size: 17,
                                color: '334155'
                            })
                        ],
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { after: 60, line: 260 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Para lo cual estamos presentando nuestra propuesta del producto de su interés:', bold: true, size: 18, color: '0F172A' })
                        ],
                        spacing: { before: 40, after: 100 }
                    }),

                    // 5. Tabla de Productos
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: tableBorders,
                        rows: tableRows
                    }),

                    new Paragraph({ spacing: { after: 80 } }),

                    // Totales
                    totalsTable,

                    new Paragraph({ spacing: { after: 120 } }),

                    // 6. Recuadro Oficial de Compromisos y Condiciones
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: tableBorders,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                                        margins: { top: 120, bottom: 120, left: 160, right: 160 },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'NUESTROS COMPROMISOS Y CONDICIONES COMERCIALES:', bold: true, size: 17, color: '0F172A' })
                                                ],
                                                spacing: { after: 60 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• Política de Envases: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: 'Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son ',
                                                        size: 16,
                                                        color: '334155'
                                                    }),
                                                    new TextRun({ text: 'RETORNABLES', bold: true, size: 16, color: 'B91C1C' }),
                                                    new TextRun({
                                                        text: ' (deben devolverse limpias y en buen estado en cada despacho). Los demás envases (galones, medios galones, litros, bolsas) son descartables de un solo uso y no aplican para retorno.',
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ],
                                                spacing: { after: 40 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• Calidad Certificada: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: 'Se emite Certificado de Calidad e inocuidad física, química y microbiológica en cada entrega bajo certificación HACCP.',
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ],
                                                spacing: { after: 40 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• Vigencia de la Oferta: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: `Oferta válida por ${quotation.validity_days || 30} días a partir de su emisión (Vencimiento: ${formatDateShort(quotation.expiration_date)}).`,
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ],
                                                spacing: { after: 40 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• Condiciones de Pago y Entrega: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: `${quotation.payment_terms || 'Contado'}. Entrega: ${quotation.delivery_time || 'Según programación'}.`,
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),

                    new Paragraph({ spacing: { after: 120 } }),

                    // 7. Despedida y Firma
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'A la espera de poder servirles.', bold: true, size: 17, color: '0F172A' })
                        ],
                        spacing: { after: 80 }
                    }),

                    ...(signatureImageBuffer
                        ? [
                              new Paragraph({
                                  children: [
                                      new ImageRun({
                                          data: signatureImageBuffer,
                                          transformation: { width: 140, height: 40 },
                                          type: 'png'
                                      })
                                  ],
                                  spacing: { after: 30 }
                              })
                          ]
                        : []),

                    new Paragraph({
                        children: [
                            new TextRun({ text: '________________________________________', color: '94A3B8' })
                        ],
                        spacing: { after: 30 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Att. ${authorName}`, bold: true, size: 18, color: '0F172A' })
                        ],
                        spacing: { after: 20 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: authorTitle, size: 16, color: '475569' })
                        ],
                        spacing: { after: 20 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: authorPhone, bold: true, size: 16, color: '0F172A' })
                        ],
                        spacing: { after: 20 }
                    }),
                    ...(quotation.signature_date ? [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `Firma digital registrada: ${formatDateShort(quotation.signature_date)}`, italics: true, size: 14, color: '94A3B8' })
                            ]
                        })
                    ] : [])
                ]
            }
        ]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    generateQuotationDocx
};
