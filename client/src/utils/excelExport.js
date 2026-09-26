import * as XLSX from 'xlsx';
import { toast } from 'sonner';

/**
 * Standard utility to export array of JSON objects to Excel (.xlsx) file.
 * Supports both positional arguments:
 *   exportJsonToExcel(data, fileName, sheetName, columnWidths)
 * and options object:
 *   exportJsonToExcel({ data, fileName, sheetName, columnWidths })
 */
export const exportJsonToExcel = (dataOrOptions, fileName = 'Reporte', sheetName = 'Datos', columnWidths = null) => {
    let data = [];
    let finalFileName = fileName;
    let finalSheetName = sheetName;
    let finalColumnWidths = columnWidths;

    if (Array.isArray(dataOrOptions)) {
        data = dataOrOptions;
    } else if (dataOrOptions && typeof dataOrOptions === 'object') {
        data = dataOrOptions.data || [];
        finalFileName = dataOrOptions.fileName || fileName;
        finalSheetName = dataOrOptions.sheetName || sheetName;
        finalColumnWidths = dataOrOptions.columnWidths || columnWidths;
    }

    if (!Array.isArray(data) || data.length === 0) {
        toast.warning('No hay datos disponibles para exportar a Excel');
        return;
    }

    try {
        const cleanFileName = finalFileName.endsWith('.xlsx') ? finalFileName : `${finalFileName}.xlsx`;
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Auto-fit column widths if not provided
        if (finalColumnWidths && Array.isArray(finalColumnWidths)) {
            worksheet['!cols'] = finalColumnWidths;
        } else {
            const firstRow = data[0];
            const keys = Object.keys(firstRow);
            worksheet['!cols'] = keys.map(key => {
                let maxLen = key.length;
                for (let i = 0; i < Math.min(data.length, 100); i++) {
                    const val = data[i][key];
                    const strLen = val !== null && val !== undefined ? String(val).length : 0;
                    if (strLen > maxLen) maxLen = strLen;
                }
                return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
            });
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName.substring(0, 31));
        XLSX.writeFile(workbook, cleanFileName);
        toast.success(`Archivo ${cleanFileName} exportado correctamente`);
    } catch (err) {
        console.error('Error al exportar a Excel:', err);
        toast.error('Error al generar el archivo Excel');
    }
};

/**
 * Standard utility to export Array of Arrays (AOA) to Excel (.xlsx) file.
 * Supports both positional arguments:
 *   exportAoaToExcel(aoa, fileName, sheetName, columnWidths)
 * and options object:
 *   exportAoaToExcel({ aoa, fileName, sheetName, columnWidths })
 */
export const exportAoaToExcel = (aoaOrOptions, fileName = 'Reporte', sheetName = 'Reporte', columnWidths = null) => {
    let aoa = [];
    let finalFileName = fileName;
    let finalSheetName = sheetName;
    let finalColumnWidths = columnWidths;

    if (Array.isArray(aoaOrOptions)) {
        aoa = aoaOrOptions;
    } else if (aoaOrOptions && typeof aoaOrOptions === 'object') {
        aoa = aoaOrOptions.aoa || [];
        finalFileName = aoaOrOptions.fileName || fileName;
        finalSheetName = aoaOrOptions.sheetName || sheetName;
        finalColumnWidths = aoaOrOptions.columnWidths || columnWidths;
    }

    if (!Array.isArray(aoa) || aoa.length === 0) {
        toast.warning('No hay datos disponibles para exportar a Excel');
        return;
    }

    try {
        const cleanFileName = finalFileName.endsWith('.xlsx') ? finalFileName : `${finalFileName}.xlsx`;
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);

        if (finalColumnWidths && Array.isArray(finalColumnWidths)) {
            worksheet['!cols'] = finalColumnWidths;
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName.substring(0, 31));
        XLSX.writeFile(workbook, cleanFileName);
        toast.success(`Archivo ${cleanFileName} exportado correctamente`);
    } catch (err) {
        console.error('Error al exportar a Excel:', err);
        toast.error('Error al generar el archivo Excel');
    }
};

export default {
    exportJsonToExcel,
    exportAoaToExcel
};
