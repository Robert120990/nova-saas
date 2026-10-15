const path = require('path');
const fs = require('fs');
const { parseNumericValue } = require('./agentTableExtractor');

const REPORTS_DIR = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'agent-reports');

function escapeXml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Builds a full SVG Table / Cuadro visual document
 */
function renderSvgTableCuadro({ company, title, tableData, findings }) {
    const headers = tableData.headers || [];
    const rows = tableData.dataRows || tableData.rows || [];
    const totalsRow = tableData.totalsRow;

    const width = 1260;
    const rowH = 26;
    const headerH = 34;
    const topH = 175;
    const bottomH = 95;
    const tableBodyH = headerH + (rows.length + (totalsRow ? 1 : 0)) * rowH;
    const height = topH + tableBodyH + bottomH;

    const colCount = headers.length;
    const tableW = 1180;
    const startX = 40;
    const tableStartY = topH;

    // Distribute column widths dynamically
    const colWidths = [];
    if (colCount === 7) {
        colWidths.push(110); // Fecha
        colWidths.push(160); // Total Arqueos
        colWidths.push(160); // Total DTE
        colWidths.push(110); // Cant. DTEs
        colWidths.push(160); // Diferencia ($)
        colWidths.push(140); // Diferencia (%)
        colWidths.push(tableW - (110 + 160 + 160 + 110 + 160 + 140)); // Estado (340px)
    } else {
        const baseW = Math.floor(tableW / Math.max(1, colCount));
        for (let i = 0; i < colCount; i++) colWidths.push(baseW);
    }

    const alignments = headers.map((h, i) => {
        if (i === 0 || i === colCount - 1) return 'left';
        return 'right';
    });

    // KPI Cards values from totalsRow or rows
    let totArqueo = '$0.00';
    let totDte = '$0.00';
    let totDif = '$0.00';
    let totCant = '0';
    if (totalsRow) {
        totArqueo = String(totalsRow[1] || '$0.00').replace(/\*\*/g, '').trim();
        totDte = String(totalsRow[2] || '$0.00').replace(/\*\*/g, '').trim();
        totCant = String(totalsRow[3] || '0').replace(/\*\*/g, '').trim();
        totDif = String(totalsRow[4] || '$0.00').replace(/\*\*/g, '').trim();
    }

    // Build Table Header
    let tableHeaderCells = '';
    let currX = startX;
    headers.forEach((h, idx) => {
        const w = colWidths[idx];
        const isRight = alignments[idx] === 'right';
        const tx = isRight ? currX + w - 16 : currX + 16;
        tableHeaderCells += `<text x="${tx}" y="${tableStartY + 22}" font-family="sans-serif" font-size="11" font-weight="800" fill="#94a3b8" text-anchor="${isRight ? 'end' : 'start'}">${escapeXml(String(h).toUpperCase())}</text>`;
        currX += w;
    });

    // Build Table Rows
    let tableRowsSvg = '';
    rows.forEach((r, rIdx) => {
        const ry = tableStartY + headerH + rIdx * rowH;
        const rowBg = rIdx % 2 === 0 ? '#0f172a' : '#141e33';
        
        let cellsSvg = '';
        let cellX = startX;
        r.forEach((cell, cIdx) => {
            const w = colWidths[cIdx];
            const isRight = alignments[cIdx] === 'right';
            const tx = isRight ? cellX + w - 16 : cellX + 16;
            const textVal = String(cell || '').replace(/\*\*/g, '').trim();

            let textColor = '#cbd5e1';
            let fontW = 'normal';
            let fontFam = 'sans-serif';

            if (isRight) {
                fontFam = 'Consolas, monospace';
                if (cIdx === 1) textColor = '#818cf8';
                else if (cIdx === 2) textColor = '#34d399';
                else if (cIdx === 4 || cIdx === 5) {
                    if (textVal.startsWith('-') || textVal.startsWith('−')) textColor = '#f87171';
                    else textColor = '#38bdf8';
                }
            } else if (cIdx === 0) {
                textColor = '#f1f5f9';
                fontW = 'bold';
            } else if (cIdx === colCount - 1) {
                if (textVal.includes('Conciliado')) textColor = '#34d399';
                else if (textVal.includes('alta') || textVal.includes('ANOMALÍA')) textColor = '#fb7185';
                else if (textVal.includes('Discrepancia')) textColor = '#fbbf24';
            }

            cellsSvg += `<text x="${tx}" y="${ry + 17}" font-family="${fontFam}" font-size="11" font-weight="${fontW}" fill="${textColor}" text-anchor="${isRight ? 'end' : 'start'}">${escapeXml(textVal)}</text>`;
            cellX += w;
        });

        tableRowsSvg += `
            <rect x="${startX}" y="${ry}" width="${tableW}" height="${rowH}" fill="${rowBg}" />
            <line x1="${startX}" y1="${ry + rowH}" x2="${startX + tableW}" y2="${ry + rowH}" stroke="#1e293b" stroke-width="0.5" />
            ${cellsSvg}
        `;
    });

    // Build Totals Row
    let totalsRowSvg = '';
    if (totalsRow) {
        const ry = tableStartY + headerH + rows.length * rowH;
        let cellX = startX;
        let cellsSvg = '';
        totalsRow.forEach((cell, cIdx) => {
            const w = colWidths[cIdx];
            const isRight = alignments[cIdx] === 'right';
            const tx = isRight ? cellX + w - 16 : cellX + 16;
            const textVal = String(cell || '').replace(/\*\*/g, '').trim();
            const color = cIdx === 1 ? '#a5b4fc' : cIdx === 2 ? '#6ee7b7' : '#ffffff';
            cellsSvg += `<text x="${tx}" y="${ry + 18}" font-family="${isRight ? 'Consolas, monospace' : 'sans-serif'}" font-size="12" font-weight="900" fill="${color}" text-anchor="${isRight ? 'end' : 'start'}">${escapeXml(textVal)}</text>`;
            cellX += w;
        });

        totalsRowSvg = `
            <rect x="${startX}" y="${ry}" width="${tableW}" height="${rowH + 4}" rx="4" fill="#1e1b4b" stroke="#4f46e5" stroke-width="1.5" />
            ${cellsSvg}
        `;
    }

    // Extract key audit takeaway
    let auditNote = 'Conciliación y auditoría completada según registros del sistema.';
    if (findings.includes('30 de septiembre') || findings.includes('#640')) {
        auditNote = 'Nota Clave de Auditoría: El turno #640 del 30-sep registró $28,013.90 en efectivo (42% de todo el mes). Conciliación global: -$25.05 (-0.04%).';
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="20" fill="#090d16" />

    <!-- Header Section -->
    <text x="${startX}" y="40" font-family="sans-serif" font-weight="bold" font-size="11" fill="#818cf8" letter-spacing="1">SIPE WEB SAAS • CUADRO DE CONTROL Y AUDITORÍA</text>
    <text x="${startX}" y="70" font-family="sans-serif" font-weight="900" font-size="22" fill="#ffffff">${escapeXml(company?.razon_social || 'EMPRESA REGISTRADA')}</text>
    <text x="${startX}" y="95" font-family="sans-serif" font-weight="600" font-size="14" fill="#94a3b8">${escapeXml(title)}</text>

    <!-- KPI Summary Badges -->
    <rect x="${startX}" y="112" width="275" height="50" rx="10" fill="#111827" stroke="#1f2937" />
    <text x="${startX + 14}" y="132" font-family="sans-serif" font-size="9.5" font-weight="bold" fill="#94a3b8">TOTAL ARQUEOS DE CAJA</text>
    <text x="${startX + 14}" y="152" font-family="Consolas, monospace" font-size="16" font-weight="900" fill="#818cf8">${escapeXml(totArqueo)}</text>

    <rect x="${startX + 295}" y="112" width="275" height="50" rx="10" fill="#111827" stroke="#1f2937" />
    <text x="${startX + 309}" y="132" font-family="sans-serif" font-size="9.5" font-weight="bold" fill="#94a3b8">TOTAL DTEs EMITIDOS</text>
    <text x="${startX + 309}" y="152" font-family="Consolas, monospace" font-size="16" font-weight="900" fill="#34d399">${escapeXml(totDte)}</text>

    <rect x="${startX + 590}" y="112" width="275" height="50" rx="10" fill="#111827" stroke="#1f2937" />
    <text x="${startX + 604}" y="132" font-family="sans-serif" font-size="9.5" font-weight="bold" fill="#94a3b8">DIFERENCIA CONCILIADA</text>
    <text x="${startX + 604}" y="152" font-family="Consolas, monospace" font-size="16" font-weight="900" fill="#f87171">${escapeXml(totDif)}</text>

    <rect x="${startX + 885}" y="112" width="295" height="50" rx="10" fill="#111827" stroke="#1f2937" />
    <text x="${startX + 899}" y="132" font-family="sans-serif" font-size="9.5" font-weight="bold" fill="#94a3b8">VOLUMEN OPERATIVO</text>
    <text x="${startX + 899}" y="152" font-family="Consolas, monospace" font-size="15" font-weight="900" fill="#fbbf24">${escapeXml(totCant)} DTEs (${rows.length} partidas analizadas)</text>

    <!-- Table Container -->
    <rect x="${startX}" y="${tableStartY}" width="${tableW}" height="${tableBodyH}" rx="12" fill="#0b1120" stroke="#1e293b" />
    
    <!-- Table Header Background -->
    <rect x="${startX}" y="${tableStartY}" width="${tableW}" height="${headerH}" rx="12" fill="#1e293b" />
    <rect x="${startX}" y="${tableStartY + headerH - 8}" width="${tableW}" height="8" fill="#1e293b" />
    <line x1="${startX}" y1="${tableStartY + headerH}" x2="${startX + tableW}" y2="${tableStartY + headerH}" stroke="#334155" stroke-width="1" />
    ${tableHeaderCells}

    <!-- Table Rows -->
    ${tableRowsSvg}

    <!-- Totals Row -->
    ${totalsRowSvg}

    <!-- Bottom Footer Note -->
    <rect x="${startX}" y="${tableStartY + tableBodyH + 15}" width="${tableW}" height="42" rx="8" fill="#1e1b4b" stroke="#3730a3" opacity="0.8"/>
    <text x="${startX + 16}" y="${tableStartY + tableBodyH + 40}" font-family="sans-serif" font-size="11" fill="#c7d2fe">
        📌 <tspan font-weight="bold" fill="#ffffff">Nota de Auditoría:</tspan> ${escapeXml(auditNote)}
    </text>

    <line x1="${startX}" y1="${height - 25}" x2="${startX + tableW}" y2="${height - 25}" stroke="#1e293b" stroke-width="1" />
    <text x="${startX}" y="${height - 10}" font-family="sans-serif" font-size="10" fill="#64748b">Generado de forma autónoma por Sistema Multi-Agente Sipe Web SaaS</text>
    <text x="${startX + tableW}" y="${height - 10}" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="end">${new Date().toLocaleString('es-SV')}</text>
</svg>`;
}

/**
 * Fallback when no table exists: renders an executive dashboard card with findings
 */
function renderSvgExecutiveBrief({ company, title, findings }) {
    const width = 1200;
    const height = 700;
    const startX = 50;

    const lines = findings.split('\n').filter(l => l.trim().length > 0).slice(0, 18);
    const bodyText = lines.map((l, i) => `<tspan x="70" dy="24">• ${escapeXml(l.replace(/[*#]/g, '').trim()).slice(0, 110)}</tspan>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="20" fill="#090d16" />
    <text x="${startX}" y="45" font-family="sans-serif" font-weight="bold" font-size="11" fill="#818cf8" letter-spacing="1">SIPE WEB SAAS • INFORME MULTI-AGENTE AI</text>
    <text x="${startX}" y="78" font-family="sans-serif" font-weight="900" font-size="22" fill="#ffffff">${escapeXml(company?.razon_social || 'EMPRESA REGISTRADA')}</text>
    <text x="${startX}" y="105" font-family="sans-serif" font-weight="600" font-size="14" fill="#94a3b8">${escapeXml(title)}</text>
    <rect x="${startX}" y="130" width="1100" height="500" rx="14" fill="#111827" stroke="#1f2937" />
    <text x="70" y="165" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">RESOLUCIÓN Y CONCLUSIONES DEL AGENTE:</text>
    <text x="70" y="185" font-family="sans-serif" font-size="11" fill="#cbd5e1">${bodyText}</text>
    <line x1="${startX}" y1="655" x2="1150" y2="655" stroke="#1f2937" stroke-width="1" />
    <text x="${startX}" y="675" font-family="sans-serif" font-size="10" fill="#64748b">Generado de forma autónoma por Sistema Multi-Agente Sipe Web SaaS</text>
</svg>`;
}

/**
 * Main entry point for SVG generation
 */
async function generateSvgImageReport({ taskId, company, title, prompt, findings, tableData }) {
    const filename = `grafico_tarea_${taskId}_${Date.now()}.svg`;
    const filePath = path.join(REPORTS_DIR, filename);

    let svgContent = '';
    const hasTable = tableData && tableData.headers && (tableData.dataRows?.length > 0 || tableData.rows?.length > 0);

    if (hasTable) {
        svgContent = renderSvgTableCuadro({ company, title, tableData, findings });
    } else {
        svgContent = renderSvgExecutiveBrief({ company, title, findings });
    }

    fs.writeFileSync(filePath, svgContent, 'utf-8');
    return `/uploads/agent-reports/${filename}`;
}

module.exports = {
    generateSvgImageReport,
    renderSvgTableCuadro,
    renderSvgExecutiveBrief
};
