const storeShiftService = require('./salesTiendaShift.service');

/**
 * Builds analytical comparison between Shift Arqueos and DTE sales.
 */
function buildComparisonData(reportData) {
    const dailyMap = {};
    const shiftList = [];

    let sumArqueos = 0;
    let sumDtes = 0;
    let sumContado = 0;
    let sumCredito = 0;
    let totalDtesCount = 0;
    let exactDaysCount = 0;

    (reportData.posGroups || []).forEach(pos => {
        (pos.shifts || []).forEach(shift => {
            const startDate = shift.start_time ? new Date(shift.start_time) : (shift.shift_date ? new Date(shift.shift_date) : null);
            // Format YYYY-MM-DD avoiding UTC day shift
            let dateStr = '---';
            if (shift.start_time && typeof shift.start_time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(shift.start_time)) {
                dateStr = shift.start_time.slice(0, 10);
            } else if (startDate && !isNaN(startDate.getTime())) {
                const y = startDate.getFullYear();
                const m = String(startDate.getMonth() + 1).padStart(2, '0');
                const d = String(startDate.getDate()).padStart(2, '0');
                dateStr = `${y}-${m}-${d}`;
            }

            const arqueoSales = Number(shift.total_sales || 0);
            const dteSales = Number(shift.total_shift || 0);
            const shiftContado = Number(shift.total_contado || 0);
            const shiftCredito = Number(shift.total_credito || 0);
            const dteCount = (shift.sales || []).length;
            const diff = arqueoSales - dteSales;

            let shiftStatus = 'EXACTO';
            if (Math.abs(diff) >= 0.01) {
                shiftStatus = diff > 0 ? 'SOBRANTE_EFECTIVO' : 'DIFERENCIA_NEGATIVA';
            }

            shiftList.push({
                shift_id: shift.shift_id,
                shift_number: shift.shift_number || shift.shift_id,
                pos_id: pos.pos_id,
                pos_name: pos.pos_name,
                branch_name: pos.branch_name,
                fecha_str: dateStr,
                start_time: shift.start_time,
                end_time: shift.end_time,
                status: shift.status || 'closed',
                seller_name: shift.seller_name || 'Sin Asignar',
                arqueo_sales: arqueoSales,
                cash_sales: Number(shift.cash_sales || 0),
                card_sales: Number(shift.card_sales || 0),
                dte_sales: dteSales,
                dte_contado: shiftContado,
                dte_credito: shiftCredito,
                dte_count: dteCount,
                difference: diff,
                match_status: shiftStatus
            });

            if (!dailyMap[dateStr]) {
                dailyMap[dateStr] = {
                    fecha: dateStr,
                    total_arqueo: 0,
                    total_dtes: 0,
                    total_contado: 0,
                    total_credito: 0,
                    shifts_count: 0,
                    dtes_count: 0
                };
            }

            dailyMap[dateStr].total_arqueo += arqueoSales;
            dailyMap[dateStr].total_dtes += dteSales;
            dailyMap[dateStr].total_contado += shiftContado;
            dailyMap[dateStr].total_credito += shiftCredito;
            dailyMap[dateStr].shifts_count += 1;
            dailyMap[dateStr].dtes_count += dteCount;

            sumArqueos += arqueoSales;
            sumDtes += dteSales;
            sumContado += shiftContado;
            sumCredito += shiftCredito;
            totalDtesCount += dteCount;
        });
    });

    const days = Object.values(dailyMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

    days.forEach(d => {
        d.difference = d.total_arqueo - d.total_dtes;
        if (Math.abs(d.difference) < 0.01) {
            d.match_status = 'EXACTO';
            exactDaysCount++;
        } else if (d.difference > 0) {
            d.match_status = 'SOBRANTE_EFECTIVO';
        } else {
            d.match_status = 'DIFERENCIA_NEGATIVA';
        }
    });

    return {
        days,
        shifts: shiftList.sort((a, b) => a.start_time > b.start_time ? 1 : -1),
        summary: {
            total_arqueos: sumArqueos,
            total_dtes: sumDtes,
            total_contado: sumContado,
            total_credito: sumCredito,
            total_difference: sumArqueos - sumDtes,
            total_shifts: shiftList.length,
            total_dtes_count: totalDtesCount,
            exact_days_count: exactDaysCount,
            total_days: days.length
        }
    };
}

/**
 * High-level service: Fetches store shifts/sales and generates comparative breakdown.
 */
async function fetchStoreSalesComparison(companyId, branchId, startDate, endDate, shiftId = null) {
    const baseData = await storeShiftService.fetchStoreSalesByShiftData(companyId, branchId, startDate, endDate, shiftId);
    const comparison = buildComparisonData(baseData);
    return {
        posIds: baseData.posIds,
        posGroups: baseData.posGroups,
        totals: baseData.totals,
        comparison
    };
}

module.exports = {
    buildComparisonData,
    fetchStoreSalesComparison
};
