const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const energyAnalyticsService = require('./energyAnalytics.service');
const {
    MONTH_NAMES,
    getElSalvadorNow,
    renderSectionBanner,
    renderKpiRows,
    renderTableHeader,
    renderAndelsaInvertersSection
} = require('./energyReportSections.service');

function buildSubtitle(companyId, analytics) {
    if (Number(companyId) === 9) {
        return 'PLANTA SOLAR ANDELSA (GROWATT ID 2410077 / GESS BESS ID 218)';
    }
    const firstPlant = analytics?.availablePlants?.[0]?.name;
    return firstPlant
        ? `PLANTA FOTOVOLTAICA ${String(firstPlant).toUpperCase()}`
        : 'PLANTA FOTOVOLTAICA GROWATT';
}

async function generateMonthlySfvReport({ companyId, company, targetMonth, plantId, format, res }) {
    const nowSv = getElSalvadorNow();
    const targetYear = targetMonth.slice(0, 4);
    const [mYear, mNum] = targetMonth.split('-').map(Number);
    const monthLabel = `${MONTH_NAMES[(mNum || 1) - 1] || targetMonth} ${mYear || nowSv.year}`;
    const refDate = targetMonth === nowSv.month ? nowSv.date : `${targetMonth}-15`;

    const [analytics, yearData, dbDaysResult] = await Promise.all([
        energyAnalyticsService.getAnalyticsData(companyId, {
            period: 'month',
            month: targetMonth,
            date: refDate,
            plantId
        }),
        energyAnalyticsService.getAnalyticsData(companyId, {
            period: 'year',
            year: targetYear,
            plantId
        }),
        pool.query(
            `SELECT summary_date, solar_generated_kwh, battery_charged_kwh, battery_discharged_kwh,
                    peak_savings_usd, solar_savings_usd, total_savings_usd, max_solar_power_kw
             FROM energy_daily_summaries
             WHERE company_id = ? AND DATE_FORMAT(summary_date, '%Y-%m') = ?
             ORDER BY summary_date ASC`,
            [companyId, targetMonth]
        )
    ]);

    const dbDays = dbDaysResult[0] || [];
    const dbByDate = new Map();
    let dbMonthCharged = 0;
    let dbMonthDischarged = 0;
    for (const r of dbDays) {
        const dt = r.summary_date instanceof Date ? r.summary_date.toISOString().slice(0, 10) : String(r.summary_date).slice(0, 10);
        dbByDate.set(dt, r);
        dbMonthCharged += Number(r.battery_charged_kwh || 0);
        dbMonthDischarged += Number(r.battery_discharged_kwh || 0);
    }

    const dailyPoints = analytics.dailyPoints || [];
    const sum = analytics.summary || {};
    const hasBatteries = Boolean(analytics.hasBatteries);
    const solarRate = Number(sum.solarRate || 0.17);
    const totalSolarKwh = Number(sum.totalSolarKwh || 0);
    const monthChargedKwh = hasBatteries ? (Number(sum.monthChargedKwh || 0) || Number(dbMonthCharged.toFixed(1))) : 0;
    const monthDischargedKwh = hasBatteries ? (Number(sum.monthDischargedKwh || 0) || Number(dbMonthDischarged.toFixed(1))) : 0;
    const solarSavingsUsd = Number((sum.solarSavingsUsd ?? (totalSolarKwh * solarRate)).toFixed(2));
    const peakSavingsUsd = hasBatteries
        ? Number((sum.peakSavingsUsd || (monthDischargedKwh * 0.08)).toFixed(2))
        : 0;
    const totalSavingsUsd = Number((solarSavingsUsd + peakSavingsUsd).toFixed(2));

    if (format === 'excel') {
        const columns = [
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Generación Solar (kWh)', key: 'solar_kwh', width: 22 },
            { header: 'Pico Solar (kW)', key: 'pico_kw', width: 17 },
            ...(hasBatteries ? [
                { header: 'Carga Batería BESS (kWh)', key: 'carga_bess', width: 24 },
                { header: 'Descarga Pico BESS (kWh)', key: 'descarga_bess', width: 24 }
            ] : []),
            { header: 'Ahorro Solar ($)', key: 'ahorro_solar', width: 18 },
            { header: 'Ahorro Total ($)', key: 'ahorro_total', width: 18 }
        ];
        const avgChg = dailyPoints.length > 0 ? Number((monthChargedKwh / dailyPoints.length).toFixed(1)) : 0;
        const avgDis = dailyPoints.length > 0 ? Number((monthDischargedKwh / dailyPoints.length).toFixed(1)) : 0;
        const rows = dailyPoints.map((pt) => {
            const dbRow = dbByDate.get(pt.date) || {};
            const sKwh = Number(pt.solarKwh || 0);
            const pKw = Number(dbRow.max_solar_power_kw || 0);
            const bChg = hasBatteries ? Number(dbRow.battery_charged_kwh || avgChg) : 0;
            const bDis = hasBatteries ? Number(dbRow.battery_discharged_kwh || pt.batteryKwh || avgDis) : 0;
            const sUsd = Number((sKwh * solarRate).toFixed(2));
            const totUsd = Number((sUsd + (hasBatteries ? peakSavingsUsd / Math.max(dailyPoints.length, 1) : 0)).toFixed(2));
            return {
                fecha: reportPdfHelper.formatDate(pt.date),
                solar_kwh: sKwh,
                pico_kw: pKw,
                ...(hasBatteries ? { carga_bess: bChg, descarga_bess: bDis } : {}),
                ahorro_solar: sUsd,
                ahorro_total: totUsd
            };
        });
        const buffer = await excelService.createExcelBuffer({
            sheetName: `SFV ${monthLabel}`.slice(0, 31),
            title: `REPORTE MENSUAL DEL SISTEMA FOTOVOLTAICO (SFV) — ${monthLabel.toUpperCase()}`,
            companyName: company?.razon_social || 'SISTEMA ENERGÉTICO',
            columns,
            rows
        });
        return excelService.sendExcelResponse(res, buffer, `Reporte_SFV_Mensual_${targetMonth}.xlsx`);
    }

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const fmt = reportPdfHelper.fmt;
    const isAndelsa = Number(companyId) === 9;
    const title = hasBatteries
        ? 'REPORTE MENSUAL DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV) Y BATERÍAS BESS'
        : 'REPORTE MENSUAL DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV)';
    const periodText = `PERÍODO MENSUAL: ${monthLabel.toUpperCase()} (${targetMonth})`;
    const subtitle = buildSubtitle(companyId, analytics);

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentW = 552;
    doc.y += 4;
    renderSectionBanner(doc, startX, contentW, `1. RESUMEN EJECUTIVO DE OPERACIÓN Y AHORRO ENERGÉTICO — ${monthLabel.toUpperCase()}`);

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
    const co2Kg = (totalSolarKwh * 0.5).toFixed(2);
    const co2Ton = (totalSolarKwh * 0.0005).toFixed(2);

    const kpiRows = [
        ['Generación Solar Total (Inversores Growatt)', `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh (${(totalSolarKwh / 1000).toFixed(2)} MWh)`, 'Disponibilidad Operativa Planta', `${dailyPoints.filter((d) => d.solarKwh > 0).length} de ${dailyPoints.length} días`],
        ['Promedio Diario Generación Fotovoltaica', `${Number(sum.avgDailySolarKwh || 0).toFixed(2)} kWh / día`, 'Potencia Pico Máxima Registrada', maxPeakKw > 0 ? `${maxPeakKw.toFixed(1)} kW (${maxPeakDate})` : 'N/A'],
        [`Mejor Día de Generación Solar (${bestDateStr})`, `${Number(sum.maxDailySolarKwh || 0).toFixed(1)} kWh`, `Día de Menor Generación (${minDay?.date || 'N/A'})`, minDay ? `${Number(minDay.kwh).toFixed(1)} kWh` : 'N/A'],
        ...(hasBatteries ? [
            ['Energía Cargada Baterías BESS (513.6 kWh)', `${monthChargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`, 'Energía Descargada Hora Pico (18-22h)', `${monthDischargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`],
            [`Ahorro por Generación Solar ($${solarRate.toFixed(2)}/kWh)`, fmt(solarSavingsUsd), 'Ahorro por Baterías Hora Punta', fmt(peakSavingsUsd)]
        ] : [
            [`Tarifa de Valorización Solar`, `$${solarRate.toFixed(2)} / kWh`, 'Ahorro por Generación Solar', fmt(solarSavingsUsd)]
        ]),
        [`AHORRO ECONÓMICO TOTAL (${monthLabel.toUpperCase()})`, fmt(totalSavingsUsd), 'Emisiones de CO2 Evitadas en el Mes', `${Number(co2Kg).toLocaleString('en-US')} kg (${co2Ton} Ton CO2)`]
    ];

    renderKpiRows(doc, startX, contentW, kpiRows);

    if (isAndelsa) {
        renderAndelsaInvertersSection(doc, startX, contentW, monthLabel, totalSolarKwh, solarRate);
    } else {
        doc.y += 6;
    }

    const secNumDaily = isAndelsa ? '3' : '2';
    renderSectionBanner(doc, startX, contentW, `${secNumDaily}. DETALLE DIARIO DE GENERACIÓN SOLAR, POTENCIA PICO${hasBatteries ? ', BATERÍAS' : ''} Y AHORRO — ${monthLabel.toUpperCase()}`);

    const dayCols = hasBatteries ? [
        { label: 'FECHA', x: startX + 4, w: 64, align: 'left' },
        { label: 'GEN. SOLAR (kWh)', x: startX + 70, w: 72, align: 'right' },
        { label: 'PICO SOLAR (kW)', x: startX + 146, w: 66, align: 'right' },
        { label: 'CARGA BESS (kWh)', x: startX + 216, w: 76, align: 'right' },
        { label: 'DESCARGA PICO (kWh)', x: startX + 296, w: 84, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 385, w: 78, align: 'right' },
        { label: 'AHORRO TOTAL ($)', x: startX + 468, w: 78, align: 'right' }
    ] : [
        { label: 'FECHA', x: startX + 4, w: 95, align: 'left' },
        { label: 'GEN. SOLAR (kWh)', x: startX + 105, w: 105, align: 'right' },
        { label: 'GENERACIÓN (MWh)', x: startX + 215, w: 95, align: 'right' },
        { label: 'PICO SOLAR (kW)', x: startX + 315, w: 105, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 425, w: 121, align: 'right' }
    ];

    renderTableHeader(doc, startX, contentW, dayCols);
    const avgChgStr = dailyPoints.length > 0 ? (monthChargedKwh / dailyPoints.length).toFixed(1) : '0.0';
    const avgDisStr = dailyPoints.length > 0 ? (monthDischargedKwh / dailyPoints.length).toFixed(1) : '0.0';

    for (let i = 0; i < dailyPoints.length; i++) {
        if (doc.y > 715) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            renderTableHeader(doc, startX, contentW, dayCols);
        }
        const pt = dailyPoints[i];
        const dbRow = dbByDate.get(pt.date) || {};
        const sKwh = Number(pt.solarKwh || 0);
        const pKw = Number(dbRow.max_solar_power_kw || 0);
        const bChg = Number(dbRow.battery_charged_kwh || 0);
        const bDis = Number(dbRow.battery_discharged_kwh || pt.batteryKwh || 0);
        const sUsd = Number((sKwh * solarRate).toFixed(2));
        const dayTotUsd = Number((sUsd + (hasBatteries ? peakSavingsUsd / Math.max(dailyPoints.length, 1) : 0)).toFixed(2));

        const ry = doc.y;
        const isBest = sum.bestDay?.date === pt.date && sKwh > 0;
        if (isBest) {
            doc.rect(startX, ry - 1, contentW, 11.5).fill('#ecfdf5');
        } else if (i % 2 === 1) {
            doc.rect(startX, ry - 1, contentW, 11.5).fill('#f8fafc');
        }

        const rowVals = hasBatteries ? [
            reportPdfHelper.formatDate(pt.date) + (isBest ? ' (Máx)' : ''),
            `${sKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
            pKw > 0 ? `${pKw.toFixed(1)} kW` : '---',
            bChg > 0 ? `${bChg.toFixed(1)} kWh` : `${avgChgStr} kWh (Prom)`,
            bDis > 0 ? `${bDis.toFixed(1)} kWh` : `${avgDisStr} kWh (Prom)`,
            fmt(sUsd),
            fmt(dayTotUsd)
        ] : [
            reportPdfHelper.formatDate(pt.date) + (isBest ? ' (Máx)' : ''),
            `${sKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
            `${(sKwh / 1000).toFixed(3)} MWh`,
            pKw > 0 ? `${pKw.toFixed(1)} kW` : '---',
            fmt(sUsd)
        ];

        for (let cIdx = 0; cIdx < dayCols.length; cIdx++) {
            const col = dayCols[cIdx];
            doc.fillColor(isBest ? '#065f46' : '#1e293b')
                .font(isBest || cIdx === 0 || cIdx === dayCols.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.5)
                .text(rowVals[cIdx], col.x, ry + 1.5, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 11.5;
    }

    const totY = doc.y + 1;
    doc.rect(startX, totY, contentW, 14).fill('#e2e8f0');
    const totalRowVals = hasBatteries ? [
        `TOTAL ${monthLabel.slice(0, 3).toUpperCase()}`,
        `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
        maxPeakKw > 0 ? `Pico: ${maxPeakKw.toFixed(1)} kW` : '---',
        `${monthChargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        `${monthDischargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        fmt(solarSavingsUsd),
        fmt(totalSavingsUsd)
    ] : [
        `TOTAL ${monthLabel.slice(0, 3).toUpperCase()}`,
        `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
        `${(totalSolarKwh / 1000).toFixed(2)} MWh`,
        maxPeakKw > 0 ? `Pico: ${maxPeakKw.toFixed(1)} kW` : '---',
        fmt(solarSavingsUsd)
    ];
    for (let cIdx = 0; cIdx < dayCols.length; cIdx++) {
        const col = dayCols[cIdx];
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(totalRowVals[cIdx], col.x, totY + 3.5, { width: col.w, align: col.align, lineBreak: false });
    }
    doc.y = totY + 18;

    // Comparativa Histórica Mensual del Año
    if (doc.y > 600) {
        doc.addPage();
        reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    const secNumComp = isAndelsa ? '4' : '3';
    renderSectionBanner(doc, startX, contentW, `${secNumComp}. COMPARATIVA HISTÓRICA MENSUAL DEL AÑO ${targetYear}`);

    const mCols = [
        { label: `MES ${targetYear}`, x: startX + 4, w: 95, align: 'left' },
        { label: 'GENERACIÓN SOLAR (kWh)', x: startX + 105, w: 100, align: 'right' },
        { label: 'GENERACIÓN (MWh)', x: startX + 210, w: 85, align: 'right' },
        { label: 'AHORRO SOLAR DIRECTO ($)', x: startX + 300, w: 105, align: 'right' },
        { label: 'OBSERVACIÓN OPERATIVA', x: startX + 415, w: 132, align: 'left' }
    ];
    renderTableHeader(doc, startX, contentW, mCols);

    const monthlyPts = (yearData.monthlyPoints || []).filter((m) => m.solarKwh > 0);
    for (let i = 0; i < monthlyPts.length; i++) {
        if (doc.y > 720) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            renderTableHeader(doc, startX, contentW, mCols);
        }
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
            : isAndelsa
                ? (Number(m.month) <= 5 ? '5 inversores activos (300 kW)' : Number(m.month) === 6 ? '19/06 se apaga I05 (70 kW)' : '4 inversores activos (230 kW)')
                : 'Operación regular';

        const vals = [
            `${MONTH_NAMES[Number(m.month) - 1] || m.month} ${targetYear}`,
            `${Number(m.solarKwh).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
            `${Number(m.solarMwh).toFixed(2)} MWh`,
            fmt(Number(m.solarKwh) * solarRate),
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
    res.setHeader('Content-Disposition', `inline; filename="Reporte_SFV_Mensual_${targetMonth}.pdf"`);
    res.send(pdfBuffer);
}

async function generateAnnualSfvReport({ companyId, company, targetYear, plantId, format, res }) {
    const nowSv = getElSalvadorNow();
    const refDate = String(targetYear) === String(nowSv.year) ? nowSv.date : `${targetYear}-12-31`;

    const [yearData, dbMonthsResult] = await Promise.all([
        energyAnalyticsService.getAnalyticsData(companyId, {
            period: 'year',
            year: String(targetYear),
            date: refDate,
            plantId
        }),
        pool.query(
            `SELECT MONTH(summary_date) AS m,
                    COUNT(*) AS days_recorded,
                    MAX(max_solar_power_kw) AS max_kw,
                    SUM(battery_charged_kwh) AS chg_kwh,
                    SUM(battery_discharged_kwh) AS dis_kwh,
                    SUM(peak_savings_usd) AS peak_usd
             FROM energy_daily_summaries
             WHERE company_id = ? AND YEAR(summary_date) = ?
             GROUP BY MONTH(summary_date)`,
            [companyId, parseInt(targetYear, 10)]
        )
    ]);

    const dbByMonth = new Map();
    let dbYearChg = 0;
    let dbYearDis = 0;
    let maxPeakKw = 0;
    let maxPeakMonthName = '';
    for (const r of dbMonthsResult[0] || []) {
        const mIdx = Number(r.m);
        dbByMonth.set(mIdx, r);
        dbYearChg += Number(r.chg_kwh || 0);
        dbYearDis += Number(r.dis_kwh || 0);
        if (Number(r.max_kw || 0) > maxPeakKw) {
            maxPeakKw = Number(r.max_kw || 0);
            maxPeakMonthName = MONTH_NAMES[mIdx - 1] || `Mes ${mIdx}`;
        }
    }

    const monthlyPoints = yearData.monthlyPoints || [];
    const sum = yearData.summary || {};
    const hasBatteries = Boolean(yearData.hasBatteries);
    const solarRate = Number(sum.solarRate || 0.17);
    const totalSolarKwh = Number(sum.totalSolarKwh || 0);
    const totalSolarMwh = Number((totalSolarKwh / 1000).toFixed(2));
    const activeMonths = monthlyPoints.filter((m) => Number(m.solarKwh) > 0);
    const activeMonthsCount = activeMonths.length;
    const avgMonthlySolarKwh = activeMonthsCount > 0 ? Number((totalSolarKwh / activeMonthsCount).toFixed(2)) : 0;

    const yearChargedKwh = hasBatteries ? (Number(sum.yearChargedKwh || 0) || Number(dbYearChg.toFixed(1))) : 0;
    const yearDischargedKwh = hasBatteries ? (Number(sum.yearDischargedKwh || 0) || Number(dbYearDis.toFixed(1))) : 0;
    const solarSavingsUsd = Number((sum.solarSavingsUsd ?? (totalSolarKwh * solarRate)).toFixed(2));
    const peakSavingsUsd = hasBatteries ? Number((sum.peakSavingsUsd || (yearDischargedKwh * 0.08)).toFixed(2)) : 0;
    const totalSavingsUsd = Number((solarSavingsUsd + peakSavingsUsd).toFixed(2));

    let minMonth = null;
    for (const m of activeMonths) {
        if (!minMonth || Number(m.solarKwh) < Number(minMonth.solarKwh)) minMonth = m;
    }

    const avgMonthChg = activeMonthsCount > 0 ? Number((yearChargedKwh / activeMonthsCount).toFixed(1)) : 0;
    const avgMonthDis = activeMonthsCount > 0 ? Number((yearDischargedKwh / activeMonthsCount).toFixed(1)) : 0;

    if (format === 'excel') {
        const columns = [
            { header: `Mes (${targetYear})`, key: 'mes', width: 18 },
            { header: 'Generación Solar (kWh)', key: 'solar_kwh', width: 22 },
            { header: 'Generación (MWh)', key: 'solar_mwh', width: 18 },
            { header: 'Participación (%)', key: 'share_pct', width: 17 },
            { header: 'Pico Máx (kW)', key: 'pico_kw', width: 16 },
            ...(hasBatteries ? [
                { header: 'Carga BESS (kWh)', key: 'carga_bess', width: 20 },
                { header: 'Descarga Pico (kWh)', key: 'descarga_bess', width: 20 }
            ] : []),
            { header: 'Ahorro Solar ($)', key: 'ahorro_solar', width: 18 },
            { header: 'Ahorro Total ($)', key: 'ahorro_total', width: 18 }
        ];
        const rows = monthlyPoints.map((m) => {
            const dbM = dbByMonth.get(Number(m.month)) || {};
            const sKwh = Number(m.solarKwh || 0);
            const share = totalSolarKwh > 0 ? Number(((sKwh / totalSolarKwh) * 100).toFixed(1)) : 0;
            const bChg = hasBatteries && sKwh > 0 ? Number(dbM.chg_kwh || avgMonthChg) : 0;
            const bDis = hasBatteries && sKwh > 0 ? Number(dbM.dis_kwh || avgMonthDis) : 0;
            const sUsd = Number((sKwh * solarRate).toFixed(2));
            const pUsd = hasBatteries && sKwh > 0 ? Number((peakSavingsUsd / Math.max(activeMonthsCount, 1)).toFixed(2)) : 0;
            return {
                mes: `${m.name} ${targetYear}`,
                solar_kwh: sKwh,
                solar_mwh: Number((sKwh / 1000).toFixed(2)),
                share_pct: share,
                pico_kw: Number(dbM.max_kw || 0),
                ...(hasBatteries ? { carga_bess: bChg, descarga_bess: bDis } : {}),
                ahorro_solar: sUsd,
                ahorro_total: Number((sUsd + pUsd).toFixed(2))
            };
        });
        const buffer = await excelService.createExcelBuffer({
            sheetName: `SFV Anual ${targetYear}`,
            title: `REPORTE ANUAL DEL SISTEMA FOTOVOLTAICO (SFV) — AÑO ${targetYear}`,
            companyName: company?.razon_social || 'SISTEMA ENERGÉTICO',
            columns,
            rows
        });
        return excelService.sendExcelResponse(res, buffer, `Reporte_SFV_Anual_${targetYear}.xlsx`);
    }

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const fmt = reportPdfHelper.fmt;
    const isAndelsa = Number(companyId) === 9;
    const title = hasBatteries
        ? 'REPORTE ANUAL DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV) Y BATERÍAS BESS'
        : 'REPORTE ANUAL DE DESEMPEÑO DEL SISTEMA FOTOVOLTAICO (SFV)';
    const periodText = `PERÍODO ANUAL: ENERO – DICIEMBRE ${targetYear}`;
    const subtitle = buildSubtitle(companyId, yearData);

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentW = 552;
    doc.y += 4;
    renderSectionBanner(doc, startX, contentW, `1. RESUMEN EJECUTIVO ANUAL DE OPERACIÓN Y AHORRO ENERGÉTICO — AÑO ${targetYear}`);

    const co2Kg = (totalSolarKwh * 0.5).toFixed(2);
    const co2Ton = (totalSolarKwh * 0.0005).toFixed(2);
    const bestM = sum.bestMonth;

    const kpiRows = [
        ['Generación Solar Anual Total (Growatt)', `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh (${totalSolarMwh.toFixed(2)} MWh)`, 'Meses con Operación Registrada', `${activeMonthsCount} de 12 meses`],
        ['Promedio Mensual Generación Fotovoltaica', `${avgMonthlySolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh / mes`, 'Potencia Pico Máxima Registrada', maxPeakKw > 0 ? `${maxPeakKw.toFixed(1)} kW (${maxPeakMonthName})` : 'N/A'],
        [`Mejor Mes del Año (${bestM?.name || 'N/A'})`, bestM ? `${Number(bestM.kwh).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh (${(Number(bestM.kwh) / 1000).toFixed(2)} MWh)` : 'N/A', `Mes de Menor Generación (${minMonth?.name || 'N/A'})`, minMonth ? `${Number(minMonth.solarKwh).toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh` : 'N/A'],
        ...(hasBatteries ? [
            ['Energía Anual Cargada Baterías BESS', `${yearChargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`, 'Energía Anual Descargada Hora Pico', `${yearDischargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`],
            [`Ahorro Solar Anual ($${solarRate.toFixed(2)}/kWh)`, fmt(solarSavingsUsd), 'Ahorro Anual Baterías Hora Punta', fmt(peakSavingsUsd)]
        ] : [
            ['Tarifa de Valorización Solar', `$${solarRate.toFixed(2)} / kWh`, 'Ahorro Solar Directo Anual', fmt(solarSavingsUsd)]
        ]),
        [`AHORRO ECONÓMICO TOTAL ANUAL (${targetYear})`, fmt(totalSavingsUsd), 'Emisiones de CO2 Evitadas en el Año', `${Number(co2Kg).toLocaleString('en-US')} kg (${co2Ton} Ton CO2)`]
    ];

    renderKpiRows(doc, startX, contentW, kpiRows);

    if (isAndelsa) {
        const postJuneKwh = monthlyPoints
            .filter((m) => Number(m.month) >= 7)
            .reduce((acc, m) => acc + Number(m.solarKwh || 0), 0);
        renderAndelsaInvertersSection(doc, startX, contentW, `Jul–Dic ${targetYear}`, postJuneKwh, solarRate);
    } else {
        doc.y += 6;
    }

    const secNumTable = isAndelsa ? '3' : '2';
    renderSectionBanner(doc, startX, contentW, `${secNumTable}. DESGLOSE MENSUAL DE GENERACIÓN SOLAR${hasBatteries ? ', BATERÍAS' : ''} Y AHORRO — AÑO ${targetYear}`);

    const cols = hasBatteries ? [
        { label: `MES ${targetYear}`, x: startX + 4, w: 72, align: 'left' },
        { label: 'GEN. SOLAR (kWh)', x: startX + 78, w: 74, align: 'right' },
        { label: 'MWh', x: startX + 154, w: 46, align: 'right' },
        { label: '% AÑO', x: startX + 202, w: 38, align: 'right' },
        { label: 'PICO (kW)', x: startX + 242, w: 50, align: 'right' },
        { label: 'DESCARGA BESS', x: startX + 294, w: 74, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 372, w: 84, align: 'right' },
        { label: 'AHORRO TOTAL ($)', x: startX + 460, w: 86, align: 'right' }
    ] : [
        { label: `MES ${targetYear}`, x: startX + 4, w: 96, align: 'left' },
        { label: 'GEN. SOLAR (kWh)', x: startX + 104, w: 95, align: 'right' },
        { label: 'GENERACIÓN (MWh)', x: startX + 204, w: 82, align: 'right' },
        { label: '% DEL AÑO', x: startX + 290, w: 62, align: 'right' },
        { label: 'PICO MÁX (kW)', x: startX + 356, w: 80, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 440, w: 106, align: 'right' }
    ];

    renderTableHeader(doc, startX, contentW, cols);

    for (let i = 0; i < monthlyPoints.length; i++) {
        if (doc.y > 710) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            renderTableHeader(doc, startX, contentW, cols);
        }
        const m = monthlyPoints[i];
        const dbM = dbByMonth.get(Number(m.month)) || {};
        const sKwh = Number(m.solarKwh || 0);
        const sMwh = Number((sKwh / 1000).toFixed(2));
        const sharePct = totalSolarKwh > 0 ? `${((sKwh / totalSolarKwh) * 100).toFixed(1)}%` : '0.0%';
        const pKw = Number(dbM.max_kw || 0);
        const bDis = hasBatteries && sKwh > 0 ? Number(dbM.dis_kwh || avgMonthDis) : 0;
        const sUsd = Number((sKwh * solarRate).toFixed(2));
        const mTotUsd = Number((sUsd + (hasBatteries && sKwh > 0 ? peakSavingsUsd / Math.max(activeMonthsCount, 1) : 0)).toFixed(2));

        const isBest = bestM && Number(bestM.month) === Number(m.month) && sKwh > 0;
        const ry = doc.y;
        if (isBest) {
            doc.rect(startX, ry - 1, contentW, 13).fill('#ecfdf5');
        } else if (i % 2 === 1) {
            doc.rect(startX, ry - 1, contentW, 13).fill('#f8fafc');
        }

        const vals = hasBatteries ? [
            `${m.name}${isBest ? ' ★' : ''}`,
            sKwh > 0 ? `${sKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh` : '---',
            sKwh > 0 ? `${sMwh.toFixed(2)}` : '---',
            sharePct,
            pKw > 0 ? `${pKw.toFixed(1)} kW` : '---',
            bDis > 0 ? `${bDis.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh` : '---',
            fmt(sUsd),
            fmt(mTotUsd)
        ] : [
            `${m.name}${isBest ? ' ★' : ''}`,
            sKwh > 0 ? `${sKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh` : '---',
            sKwh > 0 ? `${sMwh.toFixed(2)} MWh` : '---',
            sharePct,
            pKw > 0 ? `${pKw.toFixed(1)} kW` : '---',
            fmt(sUsd)
        ];

        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
            const col = cols[cIdx];
            doc.fillColor(isBest ? '#065f46' : sKwh > 0 ? '#1e293b' : '#94a3b8')
                .font(isBest || cIdx === 0 || cIdx === cols.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.6)
                .text(vals[cIdx], col.x, ry + 2.5, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 13;
    }

    const totY = doc.y + 1;
    doc.rect(startX, totY, contentW, 15).fill('#e2e8f0');
    const totalVals = hasBatteries ? [
        `TOTAL ${targetYear}`,
        `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        `${totalSolarMwh.toFixed(2)}`,
        '100.0%',
        maxPeakKw > 0 ? `${maxPeakKw.toFixed(1)} kW` : '---',
        `${yearDischargedKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        fmt(solarSavingsUsd),
        fmt(totalSavingsUsd)
    ] : [
        `TOTAL ${targetYear}`,
        `${totalSolarKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
        `${totalSolarMwh.toFixed(2)} MWh`,
        '100.0%',
        maxPeakKw > 0 ? `${maxPeakKw.toFixed(1)} kW` : '---',
        fmt(solarSavingsUsd)
    ];
    for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const col = cols[cIdx];
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(totalVals[cIdx], col.x, totY + 4, { width: col.w, align: col.align, lineBreak: false });
    }
    doc.y = totY + 20;

    // Consolidado Trimestral (Q1 - Q4)
    if (doc.y > 620) {
        doc.addPage();
        reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    const secNumQ = isAndelsa ? '4' : '3';
    renderSectionBanner(doc, startX, contentW, `${secNumQ}. CONSOLIDADO TRIMESTRAL DE GENERACIÓN Y AHORRO SOLAR — AÑO ${targetYear}`);

    const qCols = [
        { label: 'TRIMESTRE', x: startX + 4, w: 135, align: 'left' },
        { label: 'GENERACIÓN (kWh)', x: startX + 145, w: 105, align: 'right' },
        { label: 'GENERACIÓN (MWh)', x: startX + 255, w: 90, align: 'right' },
        { label: 'PARTICIPACIÓN (%)', x: startX + 350, w: 90, align: 'right' },
        { label: 'AHORRO SOLAR ($)', x: startX + 445, w: 101, align: 'right' }
    ];
    renderTableHeader(doc, startX, contentW, qCols);

    const quarters = [
        { label: `Q1 — Enero a Marzo ${targetYear}`, months: [1, 2, 3] },
        { label: `Q2 — Abril a Junio ${targetYear}`, months: [4, 5, 6] },
        { label: `Q3 — Julio a Septiembre ${targetYear}`, months: [7, 8, 9] },
        { label: `Q4 — Octubre a Diciembre ${targetYear}`, months: [10, 11, 12] }
    ];

    for (let qi = 0; qi < quarters.length; qi++) {
        const q = quarters[qi];
        const qKwh = monthlyPoints
            .filter((m) => q.months.includes(Number(m.month)))
            .reduce((acc, m) => acc + Number(m.solarKwh || 0), 0);
        const qShare = totalSolarKwh > 0 ? `${((qKwh / totalSolarKwh) * 100).toFixed(1)}%` : '0.0%';
        const ry = doc.y;
        if (qi % 2 === 1) doc.rect(startX, ry - 1, contentW, 13).fill('#f8fafc');
        const qVals = [
            q.label,
            `${qKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh`,
            `${(qKwh / 1000).toFixed(2)} MWh`,
            qShare,
            fmt(qKwh * solarRate)
        ];
        for (let cIdx = 0; cIdx < qCols.length; cIdx++) {
            const col = qCols[cIdx];
            doc.fillColor('#1e293b')
                .font(cIdx === 0 || cIdx === qCols.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.6)
                .text(qVals[cIdx], col.x, ry + 2.5, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 13;
    }

    doc.y += 10;
    reportPdfHelper.renderClosingFooter(doc, startX, doc.y, activeMonthsCount, `Meses Operativos del SFV (${targetYear})`);
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    const pdfBuffer = await getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Reporte_SFV_Anual_${targetYear}.pdf"`);
    res.send(pdfBuffer);
}

async function generateEnergyReport(req, res) {
    const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id || 9;
    const nowSv = getElSalvadorNow();
    const { period = 'month', date, month, year, plantId, format } = req.query;

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    if (period === 'year') {
        const targetYear = String(year || (month ? month.slice(0, 4) : nowSv.year));
        return generateAnnualSfvReport({ companyId, company, targetYear, plantId, format, res });
    }

    const targetMonth = (period === 'day' && date)
        ? String(date).slice(0, 7)
        : String(month || nowSv.month);

    return generateMonthlySfvReport({ companyId, company, targetMonth, plantId, format, res });
}

module.exports = { generateEnergyReport };
