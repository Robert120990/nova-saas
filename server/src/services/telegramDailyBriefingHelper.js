function getElSalvadorDate(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

function getYesterdayElSalvador(baseDate = new Date()) {
    const todayStr = getElSalvadorDate(baseDate);
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().split('T')[0];
}

function getElSalvadorTime(d = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/El_Salvador',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(d);
    return {
        hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10),
        minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
    };
}

function normalizeDateStr(d) {
    if (!d) return getYesterdayElSalvador();
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function formatDateDDMMYYYY(dateInput) {
    if (!dateInput) return '';
    const str = normalizeDateStr(dateInput);
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
}

function fmtMoney(amount) {
    const n = parseFloat(amount) || 0;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtGln(galones) {
    const n = parseFloat(galones) || 0;
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gln`;
}

function categorizeFuel(desc) {
    const u = (desc || '').toUpperCase();
    if (u.includes('ION') || u.includes('ESPECIAL') || u.includes('V-POWER') || u.includes('PREMIUM DIESEL')) {
        return 'Ion Diesel';
    }
    if (u.includes('DIESEL') || u.includes('MASTER DIESEL')) {
        return 'Diesel';
    }
    if (u.includes('SUPER') || u.includes('SÚPER')) {
        return 'Súper';
    }
    if (u.includes('REGULAR')) {
        return 'Regular';
    }
    return 'Otros';
}

const FUEL_TYPES = ['Diesel', 'Regular', 'Súper', 'Ion Diesel'];

function formatCompanyReportMessage({ companyName, fechaDisplay, branchResults, globalFuels, globalPistaGalones, globalPistaMonto, globalTiendaMonto, granTotal }) {
    let msg = `🌅 *REPORTE DIARIO DE VENTAS — ${fechaDisplay}*\n`;
    msg += `🏢 *${companyName}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const b of branchResults) {
        msg += `📍 *${b.branchName}*\n`;
        if (b.totalSucursal === 0) {
            msg += `  _(Sin ventas registradas en la fecha)_\n\n────────────────────\n\n`;
            continue;
        }

        if (b.subtotalPistaGln > 0) {
            msg += `⛽ *Combustibles (Pista):*\n`;
            for (const ft of FUEL_TYPES) {
                msg += `  • *${ft}:* ${fmtGln(b.fuels[ft].galones)} · ${fmtMoney(b.fuels[ft].monto)}\n`;
            }
            msg += `  ▸ *Subtotal Pista:* ${fmtGln(b.subtotalPistaGln)} · *${fmtMoney(b.subtotalPistaMonto)}*\n`;
        }

        if (b.storeAmount > 0 || b.subtotalPistaGln === 0) {
            msg += `🏪 *Ventas Tienda:* *${fmtMoney(b.storeAmount)}*\n`;
        }
        msg += `💰 *Total Sucursal:* *${fmtMoney(b.totalSucursal)}*\n\n────────────────────\n\n`;
    }

    msg += `📊 *CONSOLIDADO EMPRESA*\n`;
    msg += `⛽ *Combustibles:*\n`;
    for (const ft of FUEL_TYPES) {
        msg += `  • *${ft}:* ${fmtGln(globalFuels[ft].galones)} · ${fmtMoney(globalFuels[ft].monto)}\n`;
    }
    msg += `  ▸ *Total Pista:* *${fmtGln(globalPistaGalones)}* · *${fmtMoney(globalPistaMonto)}*\n`;
    msg += `🏪 *Total Tiendas:* *${fmtMoney(globalTiendaMonto)}*\n`;
    msg += `🏆 *GRAN TOTAL:* *${fmtMoney(granTotal)}*`;

    return msg;
}

function formatGroupSummaryMessage(reports, fechaDisplay) {
    let msg = `🌟 *CONSOLIDADO GENERAL DEL GRUPO — ${fechaDisplay}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    let totalGln = 0;
    let totalPista = 0;
    let totalTienda = 0;

    for (const r of reports) {
        const { globalPistaGalones, globalPistaMonto, globalTiendaMonto, granTotal } = r.totals;
        totalGln += globalPistaGalones;
        totalPista += globalPistaMonto;
        totalTienda += globalTiendaMonto;

        msg += `🏢 *${r.companyName}*\n`;
        msg += `  • Pista: ${fmtGln(globalPistaGalones)} · ${fmtMoney(globalPistaMonto)}\n`;
        if (globalTiendaMonto > 0) {
            msg += `  • Tienda: ${fmtMoney(globalTiendaMonto)}\n`;
        }
        msg += `  • Total: *${fmtMoney(granTotal)}*\n\n`;
    }

    const granTotalGrupo = totalPista + totalTienda;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⛽ *Total Galonaje Grupo:* *${fmtGln(totalGln)}*\n`;
    msg += `💵 *Total Pista Grupo:* *${fmtMoney(totalPista)}*\n`;
    msg += `🏪 *Total Tiendas Grupo:* *${fmtMoney(totalTienda)}*\n`;
    msg += `🏆 *GRAN TOTAL GRUPO:* *${fmtMoney(granTotalGrupo)}*`;

    return msg;
}

module.exports = {
    getElSalvadorDate,
    getYesterdayElSalvador,
    getElSalvadorTime,
    normalizeDateStr,
    formatDateDDMMYYYY,
    fmtMoney,
    fmtGln,
    categorizeFuel,
    FUEL_TYPES,
    formatCompanyReportMessage,
    formatGroupSummaryMessage
};
