const ExcelJS = require('exceljs');
const { formatDecimalHoursText } = require('./rhBiometricCalc.helper');

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function calculateQuincenaTitle(startDateStr, endDateStr, explicitTitle) {
    if (explicitTitle && typeof explicitTitle === 'string' && explicitTitle.trim()) {
        return explicitTitle.trim();
    }
    if (endDateStr) {
        const [y, m, d] = endDateStr.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const monthName = MONTHS_ES[(m - 1) % 12];
            const quincenaLabel = d <= 15 ? '1°' : '2°';
            return `${quincenaLabel} Quincena ${monthName}  ${y}`;
        }
    }
    if (startDateStr) {
        const [y, m, d] = startDateStr.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            if (d >= 20) {
                const nextM = m === 12 ? 1 : m + 1;
                const nextY = m === 12 ? y + 1 : y;
                return `1° Quincena ${MONTHS_ES[nextM - 1]}  ${nextY}`;
            }
            const monthName = MONTHS_ES[(m - 1) % 12];
            const quincenaLabel = d <= 5 ? '1°' : '2°';
            return `${quincenaLabel} Quincena ${monthName}  ${y}`;
        }
    }
    return 'Reporte de Horas Extras';
}

async function buildAndelsaWorkbookBuffer({
    companyName,
    quincenaTitle,
    processedEmployees,
    avicolaRows = [],
    totalProduccion,
    totalOtrosTransporte,
    totalAvicola = 0,
    totalGeneralHorasExtra
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';
    const ws = workbook.addWorksheet('H EXTRA');

    const colWidths = [14, 13, 11, 11, 10, 38, 18, 14, 4, 4, 26, 12, 14, 12];
    colWidths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const emissionDate = new Date().toISOString().slice(0, 10);
    let rIdx = 1;
    const prodTotalCells = [];
    const transpTotalCells = [];
    let summaryHeaderRow = 7;

    for (let eIdx = 0; eIdx < processedEmployees.length; eIdx++) {
        const emp = processedEmployees[eIdx];

        ws.getCell(`A${rIdx}`).value = 'Reporte de Horas Extras.';
        ws.getCell(`A${rIdx}`).font = { name: 'Calibri', size: 11, bold: true };

        ws.getCell(`A${rIdx + 1}`).value = companyName;
        ws.getCell(`A${rIdx + 1}`).font = { name: 'Calibri', size: 11, bold: true };

        ws.getCell(`A${rIdx + 2}`).value = 'PRO: 018';
        ws.getCell(`A${rIdx + 2}`).font = { name: 'Calibri', size: 10, bold: true };

        if (eIdx === 0) {
            ws.getCell(`K${rIdx + 2}`).value = 'RESUMEN  DE HORAS EXTRAS';
            ws.getCell(`K${rIdx + 2}`).font = { name: 'Calibri', size: 10, bold: true };
            ws.getCell(`K${rIdx + 3}`).value = 'FECHA:';
            ws.getCell(`L${rIdx + 3}`).value = emissionDate;
        }

        ws.getCell(`A${rIdx + 3}`).value = quincenaTitle;
        ws.getCell(`A${rIdx + 3}`).font = { name: 'Calibri', size: 10, bold: true };

        ws.getCell(`A${rIdx + 4}`).value = `Nombre: ${emp.nombre} .     Área: ${emp.area} .`;
        ws.getCell(`A${rIdx + 4}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`H${rIdx + 4}`).value = 'Horas Laborales';
        ws.getCell(`H${rIdx + 4}`).font = { name: 'Calibri', size: 9, bold: true };

        ws.getCell(`H${rIdx + 5}`).value = emp.horasLaboralesStr;
        ws.getCell(`H${rIdx + 5}`).font = { name: 'Calibri', size: 9 };
        ws.getCell(`H${rIdx + 5}`).alignment = { horizontal: 'center' };

        const headerRowIdx = rIdx + 6;
        if (eIdx === 0) summaryHeaderRow = headerRowIdx;

        const headers = ['Dia', 'Fecha', 'Marc-Ent', 'Marc-Sal', 'Extra', 'Observaciones', 'Tiempo de Trabajo', 'Hora Extras'];
        headers.forEach((h, i) => {
            const cell = ws.getCell(headerRowIdx, i + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 9, bold: true };
            cell.alignment = { horizontal: i === 5 ? 'left' : 'center', vertical: 'middle' };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });

        const firstDayRow = headerRowIdx + 1;
        let curRow = firstDayRow;

        emp.days.forEach((day) => {
            const r1 = curRow;
            const r2 = curRow + 1;

            ws.getCell(`A${r1}`).value = day.dayName;
            ws.getCell(`B${r1}`).value = day.dateStr;
            ws.getCell(`C${r1}`).value = day.mEnt1;
            ws.getCell(`D${r1}`).value = day.mSal1;
            ws.getCell(`E${r1}`).value = day.extraVal;
            ws.getCell(`F${r1}`).value = day.observacion;
            ws.getCell(`G${r1}`).value = day.tiempoTrabajo;
            ws.getCell(`H${r1}`).value = day.horaExtras;

            ws.getCell(`C${r2}`).value = day.mEnt2;
            ws.getCell(`D${r2}`).value = day.mSal2;

            const isNeg = typeof day.extraVal === 'number' && day.extraVal < 0;
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                const c1 = ws.getCell(`${col}${r1}`);
                const c2 = ws.getCell(`${col}${r2}`);
                c1.font = { name: 'Calibri', size: 9, bold: col === 'E', color: col === 'E' && isNeg ? { argb: 'FFB91C1C' } : undefined };
                c2.font = { name: 'Calibri', size: 9 };
                c1.alignment = { horizontal: col === 'F' ? 'left' : 'center', vertical: 'middle' };
                c2.alignment = { horizontal: 'center', vertical: 'middle' };
                c1.border = thinBorder;
                c2.border = thinBorder;
            });

            curRow += 2;
        });

        // Fila HORAS PENDIENTES (arrastre automático del corte anterior)
        const pendingRow = curRow;
        ws.getCell(`A${pendingRow}`).value = 'HORAS PENDIENTES';
        ws.getCell(`A${pendingRow}`).font = { name: 'Calibri', size: 9, bold: true };
        const pendingVal = Number(emp.horasPendientes || 0);
        if (pendingVal !== 0) {
            ws.getCell(`E${pendingRow}`).value = pendingVal;
            ws.getCell(`E${pendingRow}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: pendingVal < 0 ? 'FFB91C1C' : 'FF15803D' } };
            ws.getCell(`E${pendingRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getCell(`F${pendingRow}`).value = pendingVal < 0 ? 'Saldo pendiente arrastrado de quincena anterior' : 'Horas pendientes a favor';
            ws.getCell(`F${pendingRow}`).font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } };
        }
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
            ws.getCell(`${col}${pendingRow}`).border = thinBorder;
        });

        const totalRow = pendingRow + 2;
        ws.getCell(`C${totalRow}`).value = 'Total Horas';
        ws.getCell(`C${totalRow}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`E${totalRow}`).value = { formula: `SUM(E${firstDayRow}:E${pendingRow})`, result: emp.totalHorasEmp };
        ws.getCell(`E${totalRow}`).font = { name: 'Calibri', size: 10, bold: true, color: emp.totalHorasEmp < 0 ? { argb: 'FFB91C1C' } : undefined };
        ws.getCell(`E${totalRow}`).alignment = { horizontal: 'center' };
        ws.getCell(`E${totalRow}`).border = thinBorder;
        ws.getCell(`F${totalRow}`).value = emp.totalHorasEmp !== 0
            ? `(${formatDecimalHoursText(emp.totalHorasEmp)})${emp.totalHorasEmp < 0 ? ' — Pasa a Horas Pendientes' : ''}`
            : '';
        ws.getCell(`F${totalRow}`).font = { name: 'Calibri', size: 9, italic: true, color: { argb: emp.totalHorasEmp < 0 ? 'FFB91C1C' : 'FF475569' } };

        if (emp.categoria === 'transporte') transpTotalCells.push(`E${totalRow}`);
        else prodTotalCells.push(`E${totalRow}`);

        ws.getCell(`A${totalRow + 2}`).value = 'F: Empleado';
        ws.getCell(`A${totalRow + 2}`).font = { name: 'Calibri', size: 9, bold: true };
        ws.getCell(`E${totalRow + 2}`).value = 'F: AUTORIZADO';
        ws.getCell(`E${totalRow + 2}`).font = { name: 'Calibri', size: 9, bold: true };

        rIdx = totalRow + 5;
    }

    // Cuadro resumen dinámico con fórmulas completas para TODOS los empleados (sin omitir al #12+)
    const prodFormula = prodTotalCells.length ? prodTotalCells.join('+') : '0';
    const transpFormula = transpTotalCells.length ? transpTotalCells.join('+') : '0';
    const allCells = [...prodTotalCells, ...transpTotalCells];
    const allFormula = allCells.length ? allCells.join('+') : '0';

    ws.getCell(`K${summaryHeaderRow}`).value = 'Produccion';
    ws.getCell(`N${summaryHeaderRow}`).value = { formula: prodFormula, result: totalProduccion };
    ws.getCell(`K${summaryHeaderRow}`).font = { name: 'Calibri', size: 9, bold: true };
    ws.getCell(`N${summaryHeaderRow}`).font = { name: 'Calibri', size: 9, bold: true };

    ws.getCell(`K${summaryHeaderRow + 2}`).value = 'OTROS (TRANSPORTE)';
    ws.getCell(`N${summaryHeaderRow + 2}`).value = { formula: transpFormula, result: totalOtrosTransporte };
    ws.getCell(`K${summaryHeaderRow + 2}`).font = { name: 'Calibri', size: 9, bold: true };
    ws.getCell(`N${summaryHeaderRow + 2}`).font = { name: 'Calibri', size: 9, bold: true };

    ws.getCell(`K${summaryHeaderRow + 4}`).value = 'TOTAL  de HORAS EXTRA';
    ws.getCell(`N${summaryHeaderRow + 4}`).value = { formula: allFormula, result: totalGeneralHorasExtra };
    ws.getCell(`K${summaryHeaderRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };
    ws.getCell(`N${summaryHeaderRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };

    if (totalAvicola > 0) {
        ws.getCell(`K${summaryHeaderRow + 6}`).value = 'AVICOLA (Hoja 2)';
        ws.getCell(`N${summaryHeaderRow + 6}`).value = totalAvicola;
        ws.getCell(`K${summaryHeaderRow + 6}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4F46E5' } };
        ws.getCell(`N${summaryHeaderRow + 6}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4F46E5' } };
    }

    // Hoja 2 opcional: AVICOLA (si el corte tiene horas extras cargadas a Avícola)
    if (Array.isArray(avicolaRows) && avicolaRows.length > 0) {
        const wsAv = workbook.addWorksheet('AVICOLA');
        [28, 16, 12, 12, 10, 34].forEach((w, i) => { wsAv.getColumn(i + 1).width = w; });
        wsAv.getCell('A1').value = `${companyName} — HORAS EXTRAS AVÍCOLA (${quincenaTitle})`;
        wsAv.getCell('A1').font = { name: 'Calibri', size: 11, bold: true };
        const hRow = wsAv.addRow([]);
        const head = wsAv.addRow(['Colaborador', 'Área', 'Día', 'Fecha', 'Extra (h)', 'Observaciones']);
        head.font = { name: 'Calibri', size: 9.5, bold: true };
        head.eachCell(c => { c.border = thinBorder; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
        void hRow;
        avicolaRows.forEach(a => {
            const r = wsAv.addRow([a.nombre, a.area, a.dayName, a.dateStr, a.extraVal, a.observacion]);
            r.font = { name: 'Calibri', size: 9.5 };
            r.eachCell(c => { c.border = thinBorder; });
        });
        const totAv = wsAv.addRow(['TOTAL HORAS EXTRAS AVÍCOLA', '', '', '', totalAvicola, '']);
        totAv.font = { name: 'Calibri', size: 10, bold: true };
        totAv.eachCell(c => { c.border = thinBorder; });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    calculateQuincenaTitle,
    buildAndelsaWorkbookBuffer
};
