const fs = require('fs');
const path = require('path');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../excel.service');
const { extractTableData, parseNumericValue } = require('./reports/agentTableExtractor');
const { generateSvgImageReport } = require('./reports/agentSvgGenerator');

const REPORTS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'agent-reports');

if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generates an official PDF report using reportPdfHelper
 */
async function generatePdfReport({ taskId, companyId, title, prompt, findings, tableData }) {
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const orientation = (tableData?.headers?.length || 0) > 5 ? 'landscape' : 'portrait';
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument(orientation);

    const filename = `reporte_tarea_${taskId}_${Date.now()}.pdf`;
    const filePath = path.join(REPORTS_DIR, filename);

    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;
    const maxY = orientation === 'landscape' ? 510 : 700;

    // Header
    const periodMatch = prompt.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?\d{4}/i);
    const periodText = periodMatch ? `PERÍODO: ${periodMatch[0].toUpperCase()}` : 'INFORME DE GESTIÓN Y AUDITORÍA';
    reportPdfHelper.renderHeader(doc, company, title, periodText, orientation, 'AGENTE INTELIGENTE AUTÓNOMO');

    doc.moveDown(0.5);

    // Prompt Context Box
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('OBJETIVO / PROMPT DE LA SOLICITUD:');
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(prompt, { width: contentWidth });
    doc.moveDown(0.8);

    // Render Table if available
    if (tableData && tableData.headers && tableData.rows && tableData.rows.length > 0) {
        const colCount = tableData.headers.length;
        const colWidth = Math.floor(contentWidth / colCount);

        const drawTableHeader = () => {
            const headerY = doc.y;
            doc.rect(30, headerY, contentWidth, 16).fill('#f1f5f9');
            doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(30, headerY, contentWidth, 16).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            tableData.headers.forEach((h, idx) => {
                doc.text(String(h), 34 + idx * colWidth, headerY + 4, {
                    width: colWidth - 8,
                    align: idx === 0 ? 'left' : 'right'
                });
            });
            doc.y = headerY + 18;
        };

        drawTableHeader();

        doc.font('Helvetica').fontSize(7).fillColor('#1e293b');
        tableData.rows.forEach((row, rIdx) => {
            if (doc.y > maxY) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, title, periodText, orientation, 'AGENTE INTELIGENTE AUTÓNOMO');
                drawTableHeader();
            }

            const rowY = doc.y;
            if (rIdx % 2 === 1) {
                doc.rect(30, rowY - 1, contentWidth, 13).fill('#f8fafc');
            }
            doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(30, rowY + 12).lineTo(pageWidth - 30, rowY + 12).stroke();

            doc.fillColor('#0f172a');
            row.forEach((cell, cIdx) => {
                let cellText = String(cell);
                const num = parseNumericValue(cell);
                if (num > 0 && typeof cell === 'number') {
                    cellText = reportPdfHelper.fmt(num);
                }
                doc.text(cellText, 34 + cIdx * colWidth, rowY + 2, {
                    width: colWidth - 8,
                    align: cIdx === 0 ? 'left' : 'right'
                });
            });
            doc.y = rowY + 13;
        });

        doc.moveDown(0.8);
    }

    // Render Synthesis Text / Findings without cutting off
    if (doc.y > maxY - 80) doc.addPage();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text('CONCLUSIONES Y ANÁLISIS DEL AGENTE:');
    doc.moveDown(0.3);

    const cleanFindings = findings
        .replace(/#+\s*/g, '')
        .replace(/\*\*/g, '')
        .split('\n')
        .filter(l => !l.startsWith('|') && l.trim().length > 0)
        .join('\n');

    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(cleanFindings, {
        width: contentWidth,
        lineGap: 1.5
    });

    // Footer
    if (doc.y > maxY) doc.addPage();
    reportPdfHelper.renderClosingFooter(doc, 30, Math.min(doc.y + 15, maxY + 10), tableData?.rows?.length || 1, 'Registros / Partidas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    const pdfBuffer = await getBuffer();
    fs.writeFileSync(filePath, pdfBuffer);

    return `/uploads/agent-reports/${filename}`;
}

/**
 * Generates an Excel report using excel.service.js
 */
async function generateExcelReport({ taskId, title, prompt, findings, tableData }) {
    const filename = `reporte_tarea_${taskId}_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, filename);
    const sheets = [];

    // Sheet 1: Tabular data
    if (tableData && tableData.headers && tableData.rows && tableData.rows.length > 0) {
        const columns = tableData.headers.map((h, i) => ({
            header: String(h),
            key: `col_${i}`,
            width: Math.max(15, String(h).length + 4)
        }));

        const data = tableData.rows.map(row => {
            const obj = {};
            row.forEach((val, i) => {
                const num = parseNumericValue(val);
                const isStrictNum = typeof val === 'number' || (typeof val === 'string' && /^[$€\s]*\d+([.,]\d+)?\s*$/.test(val.trim()));
                obj[`col_${i}`] = isStrictNum && !isNaN(num) ? num : String(val);
            });
            return obj;
        });

        sheets.push({
            name: 'Detalle de Datos',
            columns,
            data
        });
    }

    // Sheet 2: Executive Analysis
    const analysisLines = findings.split('\n').filter(l => l.trim().length > 0).map(l => ({
        linea: l.replace(/#+\s*/g, '').replace(/\*\*/g, '').trim()
    }));

    sheets.push({
        name: 'Análisis Ejecutivo',
        columns: [{ header: 'Resumen y Recomendaciones', key: 'linea', width: 90 }],
        data: [{ linea: `OBJETIVO: ${prompt}` }, { linea: '' }, ...analysisLines]
    });

    const buffer = await excelService.createExcelBuffer({
        sheets,
        title: title.toUpperCase()
    });

    fs.writeFileSync(filePath, buffer);
    return `/uploads/agent-reports/${filename}`;
}

/**
 * Main dispatcher to generate output files based on task.output_type
 */
async function generateReportForTask({ task, companyId, findings, toolResults }) {
    const outputType = task.output_type || 'texto';
    if (outputType === 'texto') {
        return { fileUrl: null, metadata: null };
    }

    const tableData = extractTableData(findings, toolResults);
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const params = {
        taskId: task.id,
        companyId,
        company,
        title: task.title,
        prompt: task.prompt,
        findings,
        tableData
    };

    let fileUrl = null;
    if (outputType === 'pdf') {
        fileUrl = await generatePdfReport(params);
    } else if (outputType === 'excel') {
        fileUrl = await generateExcelReport(params);
    } else if (outputType === 'imagen') {
        fileUrl = await generateSvgImageReport(params);
    }

    return {
        fileUrl,
        metadata: {
            outputType,
            hasTable: !!tableData,
            rowCount: tableData?.rows?.length || 0,
            generatedAt: new Date().toISOString()
        }
    };
}

module.exports = {
    generateReportForTask,
    extractTableData,
    generatePdfReport,
    generateExcelReport
};
