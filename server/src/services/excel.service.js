const ExcelJS = require('exceljs');
const { executeExcelInWorker } = require('./reportWorkerPool.service');

/**
 * Synchronous (main-thread) Excel workbook generator.
 * Used directly or as fallback when worker threads are disabled or unavailable.
 * @param {Object} options
 * @param {Array<{name: string, columns: Array<{header: string, key: string, width: number}>, data: Array<Object>}>} options.sheets
 * @param {string} [options.title] - Optional report title (merged on first row)
 * @returns {Promise<Buffer>}
 */
async function createExcelBufferSync({ sheets = [], title } = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';

    for (const sheetDef of sheets) {
        const ws = workbook.addWorksheet(sheetDef.name || 'Reporte');

        if (title) {
            ws.mergeCells(1, 1, 1, Math.max(1, sheetDef.columns?.length || 1));
            const titleCell = ws.getCell(1, 1);
            titleCell.value = title;
            titleCell.font = { bold: true, size: 14, name: 'Calibri' };
            titleCell.alignment = { horizontal: 'center' };
            ws.addRow([]);
        }

        const columns = Array.isArray(sheetDef.columns) ? sheetDef.columns : [];
        const headerRow = ws.addRow(columns.map(c => c.header || ''));
        headerRow.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        headerRow.alignment = { horizontal: 'center' };
        headerRow.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        columns.forEach((col, i) => {
            const colRef = ws.getColumn(i + 1);
            colRef.width = col.width || 12;
        });

        const data = Array.isArray(sheetDef.data) ? sheetDef.data : [];
        data.forEach(rowData => {
            const row = ws.addRow(columns.map(c => rowData[c.key] ?? ''));
            row.font = { size: 10, name: 'Calibri' };
            row.alignment = { vertical: 'middle' };
            row.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * Creates an Excel workbook buffer non-blockingly using Worker Threads.
 * Automatically falls back to main-thread execution if workers are busy or unavailable.
 * @param {Object} options
 * @param {Array<{name: string, columns: Array<{header: string, key: string, width: number}>, data: Array<Object>}>} options.sheets
 * @param {string} [options.title] - Optional report title (merged on first row)
 * @returns {Promise<Buffer>}
 */
async function createExcelBuffer({ sheets, title } = {}) {
    return executeExcelInWorker({ sheets, title }, createExcelBufferSync);
}

/**
 * Sends an Excel buffer as a downloadable response.
 * @param {import('express').Response} res
 * @param {Buffer} buffer
 * @param {string} filename
 */
function sendExcelResponse(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
}

module.exports = {
    createExcelBuffer,
    createExcelBufferSync,
    sendExcelResponse
};
