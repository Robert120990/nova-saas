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

const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Genera un archivo Word (.docx) editable con el diseño oficial de Eggcelent
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
            console.warn('No se pudo cargar la imagen de encabezado:', e.message);
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

    // Tabla de Items
    const tableRows = [
        // Fila de encabezado
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    width: { size: 6, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'CÓDIGO', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                    width: { size: 36, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'DESCRIPCIÓN DEL PRODUCTO', bold: true, color: 'FFFFFF', size: 18 })] })]
                }),
                new TableCell({
                    width: { size: 16, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'PRESENTACIÓN', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'CANT.', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.RIGHT })]
                }),
                new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'PRECIO U.', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.RIGHT })]
                }),
                new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'EA991C' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'SUBTOTAL', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.RIGHT })]
                })
            ]
        })
    ];

    // Filas de productos
    items.forEach((item, idx) => {
        const isOdd = idx % 2 === 1;
        const fill = isOdd ? 'F8FAFC' : 'FFFFFF';

        tableRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 6, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 17 })], alignment: AlignmentType.CENTER })]
                    }),
                    new TableCell({
                        width: { size: 14, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: item.product_code || '—', size: 17, color: '475569' })], alignment: AlignmentType.CENTER })]
                    }),
                    new TableCell({
                        width: { size: 36, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: item.product_name || '', bold: true, size: 18, color: '0F172A' })] }),
                            ...(item.notes ? [new Paragraph({ children: [new TextRun({ text: item.notes, italics: true, size: 15, color: '64748B' })] })] : [])
                        ]
                    }),
                    new TableCell({
                        width: { size: 16, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: item.presentation || 'Cubeta 30 LBS', size: 17, color: '334155' })], alignment: AlignmentType.CENTER })]
                    }),
                    new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: parseFloat(item.quantity || 1).toFixed(0), size: 17, bold: true })], alignment: AlignmentType.RIGHT })]
                    }),
                    new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: formatMoney(item.unit_price), size: 17 })], alignment: AlignmentType.RIGHT })]
                    }),
                    new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill },
                        children: [new Paragraph({ children: [new TextRun({ text: formatMoney(item.total), size: 17, bold: true, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                    })
                ]
            })
        );
    });

    // Fila de Total
    tableRows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 5,
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL OFERTA COMERCIAL (USD):', bold: true, size: 18, color: '0F172A' })], alignment: AlignmentType.RIGHT })]
                }),
                new TableCell({
                    columnSpan: 2,
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
                    children: [new Paragraph({ children: [new TextRun({ text: formatMoney(quotation.total), bold: true, size: 20, color: 'B45309' })], alignment: AlignmentType.RIGHT })]
                })
            ]
        })
    );

    const authorName = quotation.signature_author_name || quotation.created_by_name || 'Raul Rafael Sosa M.';
    const authorTitle = quotation.signature_author_title || 'Ejecutivo Comercial';
    const authorPhone = quotation.signature_author_phone || '(503) 7060-5040';

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 720, bottom: 720, left: 720, right: 720 } // 0.5 inch margins
                    }
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR S.A DE C.V', bold: true, size: 15, color: '0F172A' }),
                                    new TextRun({ text: '  •  Antigua Carr. a Zacatecoluca km 38.5, El Rosario, La Paz  •  ', size: 14, color: '64748B' }),
                                    new TextRun({ text: '+503 2330-5800  •  @eggcelentsv', bold: true, size: 15, color: 'EA991C' })
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                },
                children: [
                    // 1. Imagen de encabezado corporativo
                    ...(headerImageBuffer
                        ? [
                              new Paragraph({
                                  children: [
                                      new ImageRun({
                                          data: headerImageBuffer,
                                          transformation: { width: 540, height: 54 }
                                      })
                                  ],
                                  alignment: AlignmentType.CENTER,
                                  spacing: { after: 200 }
                              })
                          ]
                        : []),

                    // 2. Título de la Cotización y Correlativo
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE },
                            insideVertical: { style: BorderStyle.NONE }
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 60, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'COTIZACIÓN COMERCIAL', bold: true, size: 26, color: '0F172A' })
                                                ]
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'Suministro de Ovoproductos Pasteurizados Eggcelent', italics: true, size: 18, color: '64748B' })
                                                ]
                                            })
                                        ]
                                    }),
                                    new TableCell({
                                        width: { size: 40, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: quotation.quote_number || 'COT-2026-0001', bold: true, size: 26, color: 'EA991C' })
                                                ],
                                                alignment: AlignmentType.RIGHT
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: `Fecha: ${formatDateShort(quotation.date)}`, size: 17, color: '475569' }),
                                                    new TextRun({ text: `  |  Vence: ${formatDateShort(quotation.expiration_date)}`, bold: true, size: 17, color: 'B91C1C' })
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

                    // 3. Ficha de Datos del Cliente
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'DATOS DEL CLIENTE', bold: true, size: 17, color: '475569' })
                                                ],
                                                spacing: { after: 60 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'Razón Social / Cliente: ', bold: true, size: 18, color: '0F172A' }),
                                                    new TextRun({ text: quotation.customer_name || '', size: 18, color: '0F172A' })
                                                ]
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'Atención / Contacto: ', bold: true, size: 16, color: '475569' }),
                                                    new TextRun({ text: quotation.customer_contact || 'Gerencia de Compras / Operaciones', size: 16 }),
                                                    new TextRun({ text: '    Teléfono: ', bold: true, size: 16, color: '475569' }),
                                                    new TextRun({ text: quotation.customer_phone || '—', size: 16 }),
                                                    new TextRun({ text: '    Correo: ', bold: true, size: 16, color: '475569' }),
                                                    new TextRun({ text: quotation.customer_email || '—', size: 16 })
                                                ]
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'Dirección: ', bold: true, size: 16, color: '475569' }),
                                                    new TextRun({ text: quotation.customer_address || 'El Salvador', size: 16 }),
                                                    ...(quotation.customer_nrc ? [
                                                        new TextRun({ text: '    NRC: ', bold: true, size: 16, color: '475569' }),
                                                        new TextRun({ text: quotation.customer_nrc, size: 16 })
                                                    ] : []),
                                                    ...(quotation.customer_nit ? [
                                                        new TextRun({ text: '    NIT: ', bold: true, size: 16, color: '475569' }),
                                                        new TextRun({ text: quotation.customer_nit, size: 16 })
                                                    ] : [])
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),

                    new Paragraph({ spacing: { after: 120 } }),

                    // 4. Saludo Formal
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Estimados Señores:', bold: true, size: 18, color: '0F172A' })
                        ],
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Por medio de la presente, nos complace presentar a ustedes nuestra oferta comercial formal para el suministro de ovoproductos pasteurizados bajo estrictas normas internacionales de inocuidad y calidad (HACCP):',
                                size: 17,
                                color: '334155'
                            })
                        ],
                        spacing: { after: 140 }
                    }),

                    // 5. Tabla de Productos
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows
                    }),

                    new Paragraph({ spacing: { after: 160 } }),

                    // 6. Sección de Compromisos Corporativos (Envases Retornables y Calidad)
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' }, // fondo sutil ámbar
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: 'NUESTROS COMPROMISOS Y CONDICIONES COMERCIALES', bold: true, size: 18, color: '92400E' })
                                                ],
                                                spacing: { after: 60 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• POLÍTICA DE ENVASES RETORNABLES: ', bold: true, size: 16, color: 'B91C1C' }),
                                                    new TextRun({
                                                        text: 'Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son ',
                                                        size: 16,
                                                        color: '1E293B'
                                                    }),
                                                    new TextRun({ text: 'ESTRICTAMENTE RETORNABLES', bold: true, size: 16, color: 'B91C1C' }),
                                                    new TextRun({
                                                        text: ' (deben devolverse limpias y en perfecto estado en cada entrega subsiguiente). Los demás envases (galones, medios galones, litros y bolsas liner) son descartables de un solo uso y no aplican para retorno.',
                                                        size: 16,
                                                        color: '1E293B'
                                                    })
                                                ],
                                                spacing: { after: 50 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• CALIDAD CERTIFICADA: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: 'Garantía de inocuidad física, química y microbiológica certificada con análisis de lote en cada despacho (certificación HACCP).',
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ],
                                                spacing: { after: 50 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• VIGENCIA DE LA OFERTA: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: `Precios y condiciones garantizadas por ${quotation.validity_days || 30} días a partir de su emisión (Vencimiento: ${formatDateShort(quotation.expiration_date)}).`,
                                                        size: 16,
                                                        color: '334155'
                                                    })
                                                ],
                                                spacing: { after: 50 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: '• CONDICIONES DE PAGO Y ENTREGA: ', bold: true, size: 16, color: '0F172A' }),
                                                    new TextRun({
                                                        text: `${quotation.payment_terms || 'Contado'}. Modalidad de entrega: ${quotation.delivery_time || 'Según programación acordada'}.`,
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

                    new Paragraph({ spacing: { after: 160 } }),

                    // 7. Despedida y Firma
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'A la espera de poder servirles y formalizar una exitosa relación comercial.', bold: true, size: 17, color: '0F172A' })
                        ],
                        spacing: { after: 140 }
                    }),

                    // Bloque de Firma
                    ...(signatureImageBuffer
                        ? [
                              new Paragraph({
                                  children: [
                                      new ImageRun({
                                          data: signatureImageBuffer,
                                          transformation: { width: 140, height: 42 }
                                      })
                                  ],
                                  spacing: { after: 40 }
                              })
                          ]
                        : [
                              new Paragraph({
                                  spacing: { after: 300 }
                              })
                          ]),

                    new Paragraph({
                        children: [
                            new TextRun({ text: '________________________________________', color: '94A3B8' })
                        ],
                        spacing: { after: 40 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Att. ${authorName}`, bold: true, size: 18, color: '0F172A' })
                        ]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: authorTitle, size: 16, color: '475569' })
                        ]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: authorPhone, bold: true, size: 16, color: '0F172A' })
                        ]
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
