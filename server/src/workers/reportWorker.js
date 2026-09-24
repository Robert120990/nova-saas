/**
 * Worker Thread for heavy report generation (Excel & PDF)
 * Executes CPU-bound tasks off the main Node.js Event Loop.
 */
const { parentPort } = require('worker_threads');
const ExcelJS = require('exceljs');
const path = require('path');

if (!parentPort) {
    throw new Error('reportWorker must be run as a Worker Thread');
}

/**
 * Builds an Excel buffer from sheet definitions and title
 * @param {Object} payload
 * @param {Array<{name: string, columns: Array<{header: string, key: string, width: number}>, data: Array<Object>}>} payload.sheets
 * @param {string} [payload.title]
 * @returns {Promise<Buffer>}
 */
async function generateExcelBuffer({ sheets = [], title } = {}) {
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
 * Executes a PDF service generator function
 * @param {Object} payload
 * @param {string} payload.serviceRelativePath
 * @param {string} payload.methodName
 * @param {Object} payload.data
 * @returns {Promise<Buffer>}
 */
async function generatePdfFromService({ serviceRelativePath, methodName, data } = {}) {
    // Resolve service path relative to server/src
    const serviceFullPath = path.resolve(__dirname, '..', serviceRelativePath);
    const serviceModule = require(serviceFullPath);

    if (typeof serviceModule[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in ${serviceRelativePath}`);
    }

    const result = await serviceModule[methodName](data);
    if (!Buffer.isBuffer(result)) {
        throw new Error(`Expected Buffer from ${serviceRelativePath}.${methodName}, got ${typeof result}`);
    }
    return result;
}

parentPort.on('message', async (task) => {
    const { taskId, type, payload } = task;
    try {
        let buffer;
        if (type === 'EXCEL') {
            buffer = await generateExcelBuffer(payload);
        } else if (type === 'PDF_SERVICE') {
            buffer = await generatePdfFromService(payload);
        } else {
            throw new Error(`Unknown worker task type: ${type}`);
        }

        parentPort.postMessage({
            taskId,
            success: true,
            buffer
        });
    } catch (error) {
        parentPort.postMessage({
            taskId,
            success: false,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});
