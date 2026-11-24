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
    totalProduccion,
    totalOtrosTransporte,
    totalGeneralHorasExtra
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';
    const ws = workbook.addWorksheet('Horas Extras');

    const colWidths = [14, 13, 11, 11, 10, 38, 18, 14, 4, 4, 24, 12, 14, 12];
    colWidths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const emissionDate = new Date().toISOString().slice(0, 10);
    let rIdx = 1;

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
        const headers = ['Dia', 'Fecha', 'Marc-Ent', 'Marc-Sal', 'Extra', 'Observaciones', 'Tiempo de Trabajo', 'Hora Extras'];
        headers.forEach((h, i) => {
            const cell = ws.getCell(headerRowIdx, i + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 9, bold: true };
            cell.alignment = { horizontal: i === 5 ? 'left' : 'center', vertical: 'middle' };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });

        if (eIdx === 0) {
            ws.getCell(`K${headerRowIdx}`).value = 'Produccion';
            ws.getCell(`N${headerRowIdx}`).value = totalProduccion;
            ws.getCell(`K${headerRowIdx}`).font = { name: 'Calibri', size: 9, bold: true };
            ws.getCell(`N${headerRowIdx}`).font = { name: 'Calibri', size: 9, bold: true };
        }

        let curRow = headerRowIdx + 1;

        emp.days.forEach((day, dIdx) => {
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

            if (eIdx === 0 && dIdx === 0) {
                ws.getCell(`K${r2}`).value = 'OTROS (TRANSPORTE)';
                ws.getCell(`N${r2}`).value = totalOtrosTransporte;
                ws.getCell(`K${r2}`).font = { name: 'Calibri', size: 9, bold: true };
                ws.getCell(`N${r2}`).font = { name: 'Calibri', size: 9, bold: true };
            } else if (eIdx === 0 && dIdx === 1) {
                ws.getCell(`K${r2}`).value = 'TOTAL  de HORAS EXTRA';
                ws.getCell(`N${r2}`).value = totalGeneralHorasExtra;
                ws.getCell(`K${r2}`).font = { name: 'Calibri', size: 9, bold: true };
                ws.getCell(`N${r2}`).font = { name: 'Calibri', size: 9, bold: true };
            }

            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                const c1 = ws.getCell(`${col}${r1}`);
                const c2 = ws.getCell(`${col}${r2}`);
                c1.font = { name: 'Calibri', size: 9, bold: col === 'E' };
                c2.font = { name: 'Calibri', size: 9 };
                c1.alignment = { horizontal: col === 'F' ? 'left' : 'center', vertical: 'middle' };
                c2.alignment = { horizontal: 'center', vertical: 'middle' };
                c1.border = thinBorder;
                c2.border = thinBorder;
            });

            curRow += 2;
        });

        ws.getCell(`A${curRow}`).value = 'HORAS PENDIENTES';
        ws.getCell(`A${curRow}`).font = { name: 'Calibri', size: 9, bold: true };

        ws.getCell(`C${curRow + 2}`).value = 'Total Horas';
        ws.getCell(`C${curRow + 2}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`E${curRow + 2}`).value = emp.totalHorasEmp;
        ws.getCell(`E${curRow + 2}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`E${curRow + 2}`).alignment = { horizontal: 'center' };
        ws.getCell(`E${curRow + 2}`).border = thinBorder;
        ws.getCell(`F${curRow + 2}`).value = emp.totalHorasEmp > 0 ? `(${formatDecimalHoursText(emp.totalHorasEmp)})` : '';
        ws.getCell(`F${curRow + 2}`).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };

        ws.getCell(`A${curRow + 4}`).value = 'F: Empleado';
        ws.getCell(`A${curRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };
        ws.getCell(`E${curRow + 4}`).value = 'F: AUTORIZADO';
        ws.getCell(`E${curRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };

        rIdx = curRow + 7;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    calculateQuincenaTitle,
    buildAndelsaWorkbookBuffer
};
