const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const energyAnalyticsService = require('./energyAnalytics.service');

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

async function generateEnergyReport(req, res) {
    const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id || 9;
    const { period = 'month', date, month = '2026-10', year = '2026', plantId, format } = req.query;

    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const analytics = await energyAnalyticsService.getAnalyticsData(companyId, {
        period: period === 'day' ? 'month' : period,
        date,
        month: period === 'day' && date ? date.slice(0, 7) : month,
        year: period === 'month' && month ? month.slice(0, 4) : year,
        plantId
    });

    const targetMonth = (period === 'day' && date) ? date.slice(0, 7) : (month || '2026-10');
    const targetYear = targetMonth.slice(0, 4);
    const [mYear, mNum] = targetMonth.split('-').map(Number);
    const monthLabel = `${MONTH_NAMES[(mNum || 10) - 1] || targetMonth} ${mYear || 2026}`;

    const [dbDays] = await pool.query(
        `SELECT summary_date, solar_generated_kwh, battery_charged_kwh, battery_discharged_kwh,
                peak_savings_usd, solar_savings_usd, total_savings_usd, max_solar_power_kw
         FROM energy_daily_summaries
         WHERE company_id = ? AND DATE_FORMAT(summary_date, '%Y-%m') = ?
         ORDER BY summary_date ASC`,
        [companyId, targetMonth]
    );

    const dbByDate = new Map();
    for (const r of dbDays) {
        const dt = r.summary_date instanceof Date ? r.summary_date.toISOString().slice(0, 10) : String(r.summary_date).slice(0, 10);
        dbByDate.set(dt, r);
    }

    const yearData = period === 'year'
        ? analytics
        : await energyAnalyticsService.getAnalyticsData(companyId, { period: 'year', year: targetYear, plantId });

    const dailyPoints = analytics.dailyPoints || [];
    const sum = analytics.summary || {};

    // Exportación a Excel no bloqueante via Worker Pool (excelService)
    if (format === 'excel') {
        const columns = [
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Generación Solar (kWh)', key: 'solar_kwh', width: 22 },
            { header: 'Pico Solar (kW)', key: 'pico_kw', width: 18 },
            { header: 'Carga Batería BESS (kWh)', key: 'carga_bess', width: 24 },
            { header: 'Descarga Pico BESS (kWh)', key: 'descarga_bess', width: 24 },
            { header: 'Ahorro Solar ($)', key: 'ahorro_solar', width: 18 },
            { header: 'Ahorro Total ($)', key: 'ahorro_total', width: 18 }
        ];
        const rows = dailyPoints.map((pt) => {
            const dbRow = dbByDate.get(pt.date) || {};
            const sKwh = Number(pt.solarKwh || 0);
            const pKw = Number(dbRow.max_solar_power_kw || 0);
            const bChg = Number(dbRow.battery_charged_kwh || 172.0);
            const bDis = Number(pt.batteryKwh || 0);
            const sUsd = Number((sKwh * 0.17).toFixed(2));
            const totUsd = Number((sUsd + ((sum.peakSavingsUsd || 0) / Math.max(dailyPoints.length, 1))).toFixed(2));
            return {
                fecha: reportPdfHelper.formatDate(pt.date),
                solar_kwh: sKwh,
                pico_kw: pKw,
                carga_bess: bChg,
                descarga_bess: bDis,
                ahorro_solar: sUsd,
                ahorro_total: totUsd
            };
        });
        const buffer = await excelService.createExcelBuffer({
            sheetName: `SFV ${monthLabel}`,
            title: `REPORTE DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV) — ${monthLabel.toUpperCase()}`,
            companyName: company?.razon_social || 'ANDELSA, S.A. DE C.V.',
            columns,
            rows
        });
        return excelService.sendExcelResponse(res, buffer, `Reporte_SFV_${targetMonth}.xlsx`);
    }

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const fmt = reportPdfHelper.fmt;

    const title = 'REPORTE MENSUAL DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV) Y BATERÍAS BESS';
    const periodText = `PERÍODO: ${monthLabel.toUpperCase()} (${targetMonth})`;
    const isAndelsa = Number(companyId) === 9;
    const subtitle = isAndelsa
        ? 'PLANTA SOLAR ANDELSA (GROWATT ID 2410077 / GESS BESS ID 218)'
        : 'PLANTA FOTOVOLTAICA GROWATT';

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentW = 552;

    // 1. Resumen Ejecutivo
    doc.y += 4;
    doc.rect(startX, doc.y, contentW, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(`1. RESUMEN EJECUTIVO DE OPERACIÓN Y AHORRO ENERGÉTICO — ${monthLabel.toUpperCase()}`, startX + 6, doc.y + 3.5);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, doc.y + 14).lineTo(startX + contentW, doc.y + 14).stroke();
    doc.y += 18;

    let maxPeakKw = 0;
    let maxPeakDate = '';
    let minDay = null;
    for (const pt of dailyPoints) {
        const dbRow = dbByDate.get(pt.date) || {};
        const pKw = Number(dbRow.max_solar_power_kw || 0);
        if (pKw > maxPeakKw) {
            maxPeakKw = pKw;
            maxPeakDate = reportPdfHelper.formatDate(pt.date);
        }
        if (pt.solarKwh > 0 && (!minDay || pt.solarKwh < minDay.kwh)) {
            minDay = { date: reportPdfHelper.formatDate(pt.date), kwh: pt.solarKwh };
        }
    }

    const bestDateStr = sum.bestDay?.date ? reportPdfHelper.formatDate(sum.bestDay.date) : 'N/A';
    const totalSolarKwh = Number(sum.totalSolarKwh || 0);
    const co2Kg = (totalSolarKwh * 0.5).toFixed(2);
    const co2Ton = (totalSolarKwh * 0.0005).toFixed(2);

    const kpiRows = [
        ['Generación Solar Total (Inversores Growatt)', `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh (${(totalSolarKwh / 1000).toFixed(2)} MWh)`, 'Disponibilidad Operativa Planta', `${dailyPoints.filter(d => d.solarKwh > 0).length} de ${dailyPoints.length} días`],
        ['Promedio Diario Generación Fotovoltaica', `${Number(sum.avgDailySolarKwh || 0).toFixed(2)} kWh / día`, 'Potencia Pico Máxima Registrada', maxPeakKw > 0 ? `${maxPeakKw.toFixed(1)} kW (${maxPeakDate})` : 'N/A'],
        [`Mejor Día de Generación Solar (${bestDateStr})`, `${Number(sum.maxDailySolarKwh || 0).toFixed(1)} kWh`, `Día de Menor Generación (${minDay?.date || 'N/A'})`, minDay ? `${Number(minDay.kwh).toFixed(1)} kWh` : 'N/A'],
        ['Energía Cargada Baterías BESS (513.6 kWh)', `${Number(sum.monthChargedKwh || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`, 'Energía Descargada Hora Pico (18-22h)', `${Number(sum.monthDischargedKwh || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`],
        ['Ahorro por Generación Solar ($0.17/kWh)', fmt(sum.solarSavingsUsd || 0), 'Ahorro por Baterías Hora Punta ($0.22/kWh)', fmt(sum.peakSavingsUsd || 0)],
        [`AHORRO ECONÓMICO TOTAL (${monthLabel.toUpperCase()})`, fmt(sum.totalSavingsUsd || 0), 'Emisiones de CO2 Evitadas en el Mes', `${Number(co2Kg).toLocaleString('en-US')} kg (${co2Ton} Ton CO2)`]
    ];

    for (let i = 0; i < kpiRows.length; i++) {
        const [lbl1, val1, lbl2, val2] = kpiRows[i];
        const rowY = doc.y;
        const isTotal = i === kpiRows.length - 1;
        if (isTotal) {
            doc.rect(startX, rowY - 1, contentW, 14).fill('#eef2ff');
        } else if (i % 2 === 1) {
            doc.rect(startX, rowY - 1, contentW, 13).fill('#f8fafc');
        }
        doc.fillColor('#334155').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.8)
            .text(lbl1, startX + 4, rowY + 2, { width: 162, lineBreak: false });
        doc.fillColor(isTotal ? '#1e3a8a' : '#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(val1, startX + 168, rowY + 2, { width: 108, align: 'right', lineBreak: false });
        doc.fillColor('#334155').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.8)
            .text(lbl2, startX + 288, rowY + 2, { width: 155, lineBreak: false });
        doc.fillColor(isTotal ? '#047857' : '#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(val2, startX + 445, rowY + 2, { width: 103, align: 'right', lineBreak: false });
        doc.y = rowY + (isTotal ? 15 : 13);
    }

    // 2. Estado de Inversores (Andelsa)
    if (isAndelsa) {
        doc.y += 6;
        doc.rect(startX, doc.y, contentW, 14).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
            .text('2. ESTADO DE INVERSORES GROWATT Y CAPACIDAD EN PANELES DE 400 W (IMPACTO INVERSOR APAGADO)', startX + 6, doc.y + 3.5);
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, doc.y + 14).lineTo(startX + contentW, doc.y + 14).stroke();
        doc.y += 16;

        const invCols = [
            { label: 'POSICIÓN / ALIAS', x: startX + 4, w: 72, align: 'left' },
            { label: 'MODELO DE EQUIPO', x: startX + 78, w: 95, align: 'left' },
            { label: 'SERIE (SN)', x: startX + 175, w: 68, align: 'left' },
            { label: 'POTENCIA (W / kW)', x: startX + 245, w: 72, align: 'right' },
            { label: 'PANELES (400W)', x: startX + 320, w: 62, align: 'right' },
            { label: 'ESTADO OPERATIVO', x: startX + 388, w: 92, align: 'left' },
            { label: 'GEN. HISTÓRICA', x: startX + 482, w: 66, align: 'right' }
        ];

        const invHeaderY = doc.y;
        doc.rect(startX, invHeaderY, contentW, 13).fill('#e2e8f0');
        for (const c of invCols) {
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5)
                .text(c.label, c.x, invHeaderY + 3, { width: c.w, align: c.align, lineBreak: false });
        }
        doc.y = invHeaderY + 15;

        const inverters = [
            ['I01', 'Growatt MAC 60KTL3-X MV', 'QHEUD6800D', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '173,544.1 kWh'],
            ['Inversor 2 (ex I02)', 'Growatt MAC 50KTL3-X MV', 'QGEUD4600G', '50,000 W (50 kW)', '125 paneles', 'ACTIVO / EN LÍNEA', '33,502.8 kWh'],
            ['I03', 'Growatt MAC 60KTL3-X MV', 'QHESD47008', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '134,054.6 kWh'],
            ['I04', 'Growatt MAC 60KTL3-X MV', 'QHEUD6800L', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '186,159.2 kWh'],
            ['I05 (Inversor 5)', 'Growatt MAC 70KTL3-X MV', 'MXKDD5M00U', '70,000 W (70 kW)', '175 paneles', 'APAGADO (Desde 19/06)', '380,904.1 kWh'],
            ['Campo Solar GESS', '3 Controladores MPPT PMDE1', 'BR0322000282', '117,000 W (117 kWp)', '293 paneles', 'ACTIVO (Carga BESS)', '315,883.5 kWh']
        ];

        for (let i = 0; i < inverters.length; i++) {
            const row = inverters[i];
            const ry = doc.y;
            const isOff = row[5].includes('APAGADO');
            if (isOff) {
                doc.rect(startX, ry - 1, contentW, 12).fill('#fef2f2');
            } else if (i % 2 === 1) {
                doc.rect(startX, ry - 1, contentW, 12).fill('#f8fafc');
            }
            for (let cIdx = 0; cIdx < invCols.length; cIdx++) {
                const col = invCols[cIdx];
                doc.fillColor(isOff ? '#991b1b' : '#1e293b')
                    .font(cIdx === 0 || isOff ? 'Helvetica-Bold' : 'Helvetica')
                    .fontSize(6.5)
                    .text(row[cIdx], col.x, ry + 2, { width: col.w, align: col.align, lineBreak: false });
            }
            doc.y = ry + 12;
        }

        const estMissedKwh = Math.round(totalSolarKwh * (70 / 230));
        const estMissedUsd = (estMissedKwh * 0.17).toFixed(2);
        const noteY = doc.y + 2;
        doc.rect(startX, noteY, contentW, 16).fill('#fffbeb');
        doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(6.5)
            .text('NOTA TÉCNICA — IMPACTO INVERSOR I05 APAGADO (70 kW / 175 PANELES DE 400 W): ', startX + 5, noteY + 4, { continued: true })
            .font('Helvetica')
            .text(`De haber operado I05 en ${monthLabel} (+30.4% sobre los 230 kW activos), se habrían generado ~${estMissedKwh.toLocaleString('en-US')} kWh adicionales (~$ ${estMissedUsd} extra de ahorro).`);
        doc.y = noteY + 21;
    }

    // 3. Detalle Diario del Mes
    doc.rect(startX, doc.y, contentW, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(`3. DETALLE DIARIO DE GENERACIÓN SOLAR, POTENCIA PICO, BATERÍAS Y AHORRO — ${monthLabel.toUpperCase()}`, startX + 6, doc.y + 3.5);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, doc.y + 14).lineTo(startX + contentW, doc.y + 14).stroke();
    doc.y += 16;

    const dayCols = [
        { label: 'FECHA', x: startX + 4, w: 62, align: 'left' },
        { label: 'GEN. SOLAR (kWh)', x: startX + 68, w: 72, align: 'right' },
        { label: 'PICO SOLAR (kW)', x: startX + 144, w: 66, align: 'right' },
        { label: 'CARGA BESS (kWh)', x: startX + 215, w: 76, align: 'right' },
        { label: 'DESCARGA PICO (kWh)', x: startX + 296, w: 84, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 385, w: 78, align: 'right' },
        { label: 'AHORRO TOTAL ($)', x: startX + 468, w: 78, align: 'right' }
    ];

    const renderDailyHeader = () => {
        const hy = doc.y;
        doc.rect(startX, hy, contentW, 13).fill('#e2e8f0');
        for (const c of dayCols) {
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5)
                .text(c.label, c.x, hy + 3, { width: c.w, align: c.align, lineBreak: false });
        }
        doc.y = hy + 14;
    };

    renderDailyHeader();

    for (let i = 0; i < dailyPoints.length; i++) {
        if (doc.y > 715) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            renderDailyHeader();
        }
        const pt = dailyPoints[i];
        const dbRow = dbByDate.get(pt.date) || {};
        const sKwh = Number(pt.solarKwh || 0);
        const pKw = Number(dbRow.max_solar_power_kw || 0);
        const bChg = Number(dbRow.battery_charged_kwh || 0);
        const sUsd = Number((sKwh * 0.17).toFixed(2));
        const dayTotUsd = Number((sUsd + ((sum.peakSavingsUsd || 0) / Math.max(dailyPoints.length, 1))).toFixed(2));

        const ry = doc.y;
        const isBest = sum.bestDay?.date === pt.date;
        if (isBest) {
            doc.rect(startX, ry - 1, contentW, 11.5).fill('#ecfdf5');
        } else if (i % 2 === 1) {
            doc.rect(startX, ry - 1, contentW, 11.5).fill('#f8fafc');
        }

        const avgChg = dailyPoints.length > 0 ? ((sum.monthChargedKwh || 0) / dailyPoints.length).toFixed(1) : '0.0';
        const rowVals = [
            reportPdfHelper.formatDate(pt.date) + (isBest ? ' (Máx)' : ''),
            `${sKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
            pKw > 0 ? `${pKw.toFixed(1)} kW` : '---',
            bChg > 0 ? `${bChg.toFixed(1)} kWh` : `${avgChg} kWh (Prom)`,
            `${Number(pt.batteryKwh || 0).toFixed(1)} kWh`,
            fmt(sUsd),
            fmt(dayTotUsd)
        ];

        for (let cIdx = 0; cIdx < dayCols.length; cIdx++) {
            const col = dayCols[cIdx];
            doc.fillColor(isBest ? '#065f46' : '#1e293b')
                .font(isBest || cIdx === 0 || cIdx === 6 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.5)
                .text(rowVals[cIdx], col.x, ry + 1.5, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 11.5;
    }

    const totY = doc.y + 1;
    doc.rect(startX, totY, contentW, 14).fill('#e2e8f0');
    const totalRowVals = [
        `TOTAL ${monthLabel.slice(0, 3).toUpperCase()}`,
        `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
        maxPeakKw > 0 ? `Pico: ${maxPeakKw.toFixed(1)} kW` : '---',
        `${Number(sum.monthChargedKwh || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        `${Number(sum.monthDischargedKwh || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        fmt(sum.solarSavingsUsd || 0),
        fmt(sum.totalSavingsUsd || 0)
    ];
    for (let cIdx = 0; cIdx < dayCols.length; cIdx++) {
        const col = dayCols[cIdx];
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(totalRowVals[cIdx], col.x, totY + 3.5, { width: col.w, align: col.align, lineBreak: false });
    }
    doc.y = totY + 18;

    // 4. Comparativa Histórica Mensual del Año
    if (doc.y > 620) {
        doc.addPage();
        reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    doc.rect(startX, doc.y, contentW, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(`4. COMPARATIVA HISTÓRICA MENSUAL DEL AÑO ${targetYear}`, startX + 6, doc.y + 3.5);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, doc.y + 14).lineTo(startX + contentW, doc.y + 14).stroke();
    doc.y += 16;

    const mCols = [
        { label: `MES ${targetYear}`, x: startX + 4, w: 95, align: 'left' },
        { label: 'GENERACIÓN SOLAR (kWh)', x: startX + 105, w: 100, align: 'right' },
        { label: 'GENERACIÓN (MWh)', x: startX + 210, w: 85, align: 'right' },
        { label: 'AHORRO SOLAR DIRECTO ($)', x: startX + 300, w: 105, align: 'right' },
        { label: 'OBSERVACIÓN OPERATIVA', x: startX + 415, w: 132, align: 'left' }
    ];

    const mHeadY = doc.y;
    doc.rect(startX, mHeadY, contentW, 13).fill('#e2e8f0');
    for (const c of mCols) {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5)
            .text(c.label, c.x, mHeadY + 3, { width: c.w, align: c.align, lineBreak: false });
    }
    doc.y = mHeadY + 14;

    const monthlyPts = (yearData.monthlyPoints || []).filter(m => m.solarKwh > 0);
    for (let i = 0; i < monthlyPts.length; i++) {
        const m = monthlyPts[i];
        const isCurrentReportMonth = Number(m.month) === Number(mNum);
        const ry = doc.y;
        if (isCurrentReportMonth) {
            doc.rect(startX, ry - 1, contentW, 12).fill('#eef2ff');
        } else if (i % 2 === 1) {
            doc.rect(startX, ry - 1, contentW, 12).fill('#f8fafc');
        }
        const obs = isCurrentReportMonth
            ? 'MES REPORTADO'
            : Number(m.month) <= 5
            ? '5 inversores activos (300 kW)'
            : Number(m.month) === 6
            ? '19/06 se apaga I05 (70 kW)'
            : '4 inversores activos (230 kW)';

        const vals = [
            `${MONTH_NAMES[Number(m.month) - 1] || m.month} ${targetYear}`,
            `${Number(m.solarKwh).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
            `${Number(m.solarMwh).toFixed(2)} MWh`,
            fmt(Number(m.solarKwh) * 0.17),
            obs
        ];
        for (let cIdx = 0; cIdx < mCols.length; cIdx++) {
            const col = mCols[cIdx];
            doc.fillColor(isCurrentReportMonth ? '#1e3a8a' : '#1e293b')
                .font(isCurrentReportMonth || cIdx === 0 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.5)
                .text(vals[cIdx], col.x, ry + 2, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 12;
    }

    doc.y += 10;
    reportPdfHelper.renderClosingFooter(doc, startX, doc.y, dailyPoints.length, 'Jornadas Diarias del SFV');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    const pdfBuffer = await getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Reporte_SFV_${targetMonth}.pdf"`);
    res.send(pdfBuffer);
}

module.exports = { generateEnergyReport };
