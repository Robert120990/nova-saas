const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
const { buildFiniquitoClauses } = require('./pdf/finiquitoPdf.service');

/**
 * Generates the Finiquito as a Microsoft Word (.docx) file
 */
async function generateFiniquitoDocx(data) {
    const clauses = buildFiniquitoClauses(data);

    const docParagraphs = [];

    // --- 1. Documento Privado de Finiquito Laboral ---
    docParagraphs.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 280 },
            children: [
                new TextRun({
                    text: clauses.title,
                    bold: true,
                    size: 28, // 14pt
                    font: 'Calibri'
                })
            ]
        })
    );

    const privParts = clauses.privateDocText.split('\n\n');
    for (const part of privParts) {
        docParagraphs.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 120, line: 240 },
                children: [
                    new TextRun({
                        text: part.trim(),
                        size: 20, // 10pt
                        font: 'Calibri'
                    })
                ]
            })
        );
    }

    // Firma Trabajador (Página 1) - keepWithNext evita saltos indeseados
    docParagraphs.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { before: 350, after: 60 },
            children: [
                new TextRun({
                    text: '____________________________________________',
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { after: 30 },
            children: [
                new TextRun({
                    text: clauses.empName,
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        })
    );

    if (clauses.empDui) {
        docParagraphs.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 160 },
                children: [
                    new TextRun({
                        text: `DUI: ${clauses.empDui}`,
                        size: 18,
                        font: 'Calibri'
                    })
                ]
            })
        );
    }

    // --- 2. Acta Notarial de Auténtica de Firma (Page Break) ---
    docParagraphs.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
            spacing: { before: 200, after: 240 },
            children: [
                new TextRun({
                    text: 'ACTA NOTARIAL DE AUTÉNTICA DE FIRMA',
                    bold: true,
                    size: 24, // 12pt
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200, line: 276 },
            children: [
                new TextRun({
                    text: clauses.actaText,
                    size: 22,
                    font: 'Calibri'
                })
            ]
        }),
        // Firmas Acta Notarial
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { before: 350, after: 60 },
            children: [
                new TextRun({
                    text: '____________________________________________',
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { after: 150 },
            children: [
                new TextRun({
                    text: clauses.empName,
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { before: 200, after: 60 },
            children: [
                new TextRun({
                    text: '____________________________________________',
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            keepWithNext: true,
            spacing: { after: 30 },
            children: [
                new TextRun({
                    text: `LIC. ${clauses.notarioNombre}`,
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
                new TextRun({
                    text: 'Abogado y Notario',
                    size: 18,
                    font: 'Calibri'
                })
            ]
        })
    );

    // --- 3. Carátula Notarial (Page Break) ---
    docParagraphs.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
            spacing: { before: 1200, after: 400 },
            children: [
                new TextRun({
                    text: String(clauses.year),
                    bold: true,
                    size: 28,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
                new TextRun({
                    text: 'DOCUMENTO PRIVADO Y AUTENTICADO DE:',
                    bold: true,
                    size: 22,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
            children: [
                new TextRun({
                    text: 'FINIQUITO LABORAL',
                    bold: true,
                    size: 28,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: 'OTORGADO POR:',
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
            children: [
                new TextRun({
                    text: clauses.empName,
                    bold: true,
                    size: 24,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: 'A FAVOR DE:',
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
            children: [
                new TextRun({
                    text: clauses.beneficiarioNombre,
                    bold: true,
                    size: 24,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: 'ANTE LOS OFICIOS DEL NOTARIO:',
                    bold: true,
                    size: 20,
                    font: 'Calibri'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: `LIC. ${clauses.notarioNombre}`,
                    bold: true,
                    size: 24,
                    font: 'Calibri'
                })
            ]
        })
    );

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440, // 1 inch (72pt)
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: docParagraphs
            }
        ]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    generateFiniquitoDocx
};
