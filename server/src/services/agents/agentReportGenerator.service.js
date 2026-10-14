const fs = require('fs');
const path = require('path');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../excel.service');

const REPORTS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'agent-reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Extracts tabular data from markdown or tool results.
 */
function extractTableData(resultText = '', toolResults = []) {
    // 1. Check for raw SQL query data in tool results
    for (const tr of toolResults || []) {
        if (tr?.content) {
            try {
                const parsed = typeof tr.content === 'string' ? JSON.parse(tr.content) : tr.content;
                if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
                    const keys = Object.keys(parsed.data[0]);
                    return {
                        headers: keys.map(k => k.replace(/_/g, ' ').toUpperCase()),
                        rows: parsed.data.map(item => keys.map(k => item[k] ?? '---')),
                        rawObjects: parsed.data
                    };
                }
            } catch {
                // not JSON or no data
            }
        }
    }

    // 2. Parse markdown tables from text
    const lines = resultText.split('\n');
    let inTable = false;
    let headers = [];
    let rows = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
            if (!inTable) {
                headers = cells;
                inTable = true;
            } else if (trimmed.includes('---')) {
                // divider row, skip
                continue;
            } else {
                rows.push(cells);
            }
        } else if (inTable && rows.length > 0) {
            // End of first table
            break;
        }
    }

    if (headers.length > 0 && rows.length > 0) {
        return { headers, rows };
    }

    return null;
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
    if (tableData && tableData.headers && tableData.rows) {
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
                const num = Number(cell);
                if (!isNaN(num) && typeof cell === 'number') {
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

    // Render Synthesis Text / Findings
    if (doc.y > maxY - 100) doc.addPage();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text('CONCLUSIONES Y ANÁLISIS DEL AGENTE:');
    doc.moveDown(0.3);

    const cleanFindings = findings
        .replace(/#+\s*/g, '')
        .replace(/\*\*/g, '')
        .split('\n')
        .filter(l => !l.startsWith('|') && l.trim().length > 0)
        .slice(0, 18)
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
    if (tableData && tableData.headers && tableData.rows) {
        const columns = tableData.headers.map((h, i) => ({
            header: String(h),
            key: `col_${i}`,
            width: Math.max(15, String(h).length + 4)
        }));

        const data = tableData.rows.map(row => {
            const obj = {};
            row.forEach((val, i) => {
                const num = Number(val);
                obj[`col_${i}`] = !isNaN(num) && typeof val === 'number' ? num : String(val);
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
 * Generates a modern SVG image infographic / chart
 */
async function generateImageReport({ taskId, companyId, title, prompt, findings, tableData }) {
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const filename = `grafico_tarea_${taskId}_${Date.now()}.svg`;
    const filePath = path.join(REPORTS_DIR, filename);

    const width = 1200;
    const height = 680;

    // Extract numbers for visual chart if available
    const rows = tableData?.rows || [];
    const sampleRows = rows.slice(0, 15);
    const maxVal = Math.max(
        ...sampleRows.map(r => Number(r[1]) || 0),
        ...sampleRows.map(r => Number(r[2]) || 0),
        100
    );

    const chartHeight = 240;
    const chartY = 320;
    const barWidth = Math.max(12, Math.floor(700 / (sampleRows.length * 2.2 || 1)));

    let barsSvg = '';
    sampleRows.forEach((r, idx) => {
        const v1 = Number(r[1]) || 0;
        const v2 = Number(r[2]) || 0;
        const h1 = Math.round((v1 / maxVal) * chartHeight);
        const h2 = Math.round((v2 / maxVal) * chartHeight);
        const x = 70 + idx * (barWidth * 2 + 16);
        barsSvg += `<g><rect x="${x}" y="${chartY - h1}" width="${barWidth}" height="${h1}" rx="3" fill="#6366f1" /><rect x="${x + barWidth + 2}" y="${chartY - h2}" width="${barWidth}" height="${h2}" rx="3" fill="#10b981" /><text x="${x + barWidth}" y="${chartY + 16}" font-size="9" font-family="sans-serif" fill="#94a3b8" text-anchor="middle">${String(r[0] || '').slice(0, 6)}</text></g>`;
    });

    const summaryText = findings.replace(/#+\s*/g, '').replace(/\*\*/g, '').split('\n').filter(l => !l.startsWith('|') && l.trim().length > 0).slice(0, 6).map(l => `<tspan x="840" dy="20">• ${l.slice(0, 48)}</tspan>`).join('');

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="20" fill="#0f172a" />
    <text x="60" y="50" font-family="sans-serif" font-weight="bold" font-size="11" fill="#818cf8" letter-spacing="1">SIPE WEB SAAS • REPORTE MULTI-AGENTE AI</text>
    <text x="60" y="80" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff">${company.razon_social || 'EMPRESA REGISTRADA'}</text>
    <text x="60" y="108" font-family="sans-serif" font-weight="600" font-size="14" fill="#94a3b8">${title}</text>
    <rect x="60" y="135" width="220" height="70" rx="12" fill="#1e293b" stroke="#334155" />
    <text x="75" y="162" font-family="sans-serif" font-size="10" font-weight="bold" fill="#94a3b8">REGISTROS ANALIZADOS</text>
    <text x="75" y="190" font-family="sans-serif" font-size="18" font-weight="bold" fill="#6366f1">${rows.length} partidas</text>
    <rect x="300" y="135" width="220" height="70" rx="12" fill="#1e293b" stroke="#334155" />
    <text x="315" y="162" font-family="sans-serif" font-size="10" font-weight="bold" fill="#94a3b8">ESTADO DE COMPARACIÓN</text>
    <text x="315" y="190" font-family="sans-serif" font-size="16" font-weight="bold" fill="#10b981">Concordancia Activa</text>
    <rect x="540" y="135" width="260" height="70" rx="12" fill="#1e293b" stroke="#334155" />
    <text x="555" y="162" font-family="sans-serif" font-size="10" font-weight="bold" fill="#94a3b8">TIPO DE SALIDA</text>
    <text x="555" y="190" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f59e0b">Gráfico / Infografía</text>
    <rect x="60" y="225" width="740" height="280" rx="14" fill="#1e293b" stroke="#334155" />
    <circle cx="85" cy="245" r="4.5" fill="#6366f1" /><text x="96" y="249" font-family="sans-serif" font-size="10.5" font-weight="bold" fill="#cbd5e1">Serie 1 (Arqueos)</text>
    <circle cx="250" cy="245" r="4.5" fill="#10b981" /><text x="261" y="249" font-family="sans-serif" font-size="10.5" font-weight="bold" fill="#cbd5e1">Serie 2 (DTEs)</text>
    <g transform="translate(10, 160)">${barsSvg}</g>
    <rect x="820" y="135" width="320" height="370" rx="14" fill="#1e293b" stroke="#334155" />
    <text x="840" y="168" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">HALLAZGOS Y AUDITORÍA</text>
    <text x="840" y="195" font-family="sans-serif" font-size="10" fill="#94a3b8">${summaryText}</text>
    <line x1="60" y1="630" x2="1140" y2="630" stroke="#334155" stroke-width="1" />
    <text x="60" y="652" font-family="sans-serif" font-size="10" fill="#64748b">Generado de forma autónoma por Sistema Multi-Agente Sipe Web SaaS</text>
    <text x="1140" y="652" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="end">${new Date().toLocaleString('es-SV')}</text>
</svg>`;

    fs.writeFileSync(filePath, svgContent, 'utf-8');
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
    const params = {
        taskId: task.id,
        companyId,
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
        fileUrl = await generateImageReport(params);
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

module.exports = { generateReportForTask, extractTableData, generatePdfReport, generateExcelReport, generateImageReport };
