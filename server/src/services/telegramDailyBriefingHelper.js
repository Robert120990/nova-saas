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

function categorizeFuel(desc, tipo = null) {
    const t = Number(tipo);
    if (t === 4) return 'Ion Diesel';
    if (t === 1) return 'Regular';
    if (t === 2) return 'Súper';
    if (t === 3 || t === 5) return 'Diesel';

    const u = (desc || '').toUpperCase();
    if (u.includes('ION') || u.includes('V-POWER') || u.includes('PREMIUM DIESEL')) {
        return 'Ion Diesel';
    }
    if (u.includes('DIESEL') || u.includes('MASTER')) {
        return 'Diesel';
    }
    if (u.includes('SUPER') || u.includes('SÚPER') || u.includes('ESPECIAL')) {
        return 'Súper';
    }
    if (u.includes('REGULAR')) {
        return 'Regular';
    }
    return 'Otros';
}

const FUEL_TYPES = ['Diesel', 'Regular', 'Súper', 'Ion Diesel'];

function formatCompanyReportMessage({ companyName, fechaDisplay, branchResults, isUpdate = false }) {
    let msg = isUpdate
        ? `🔄 *ACTUALIZACIÓN DE VENTAS — ${fechaDisplay}*\n`
        : `🌅 *REPORTE DIARIO DE VENTAS — ${fechaDisplay}*\n`;
    msg += `🏢 *${companyName}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < branchResults.length; i++) {
        const b = branchResults[i];
        msg += `📍 *${b.branchName}*\n`;
        if (b.shiftsSummary) {
            msg += `  ${b.shiftsSummary}\n`;
        }
        if (b.totalSucursal === 0 && !b.shiftsSummary) {
            msg += `  _(Sin ventas registradas en la fecha)_\n\n`;
            if (i < branchResults.length - 1) msg += `────────────────────\n\n`;
            continue;
        }

        if (b.subtotalPistaGln > 0) {
            msg += `⛽ *Combustibles (Pista):*\n`;
            for (const ft of FUEL_TYPES) {
                if (b.fuels[ft]) {
                    if (ft === 'Ion Diesel' && b.fuels[ft].galones === 0 && b.fuels[ft].monto === 0) {
                        continue;
                    }
                    msg += `  • *${ft}:* ${fmtGln(b.fuels[ft].galones)} · ${fmtMoney(b.fuels[ft].monto)}\n`;
                }
            }
            if (b.fuels['Otros']?.galones > 0 || b.fuels['Otros']?.monto > 0) {
                msg += `  • *Otros:* ${fmtGln(b.fuels['Otros'].galones)} · ${fmtMoney(b.fuels['Otros'].monto)}\n`;
            }
            msg += `  ▸ *Subtotal Pista:* ${fmtGln(b.subtotalPistaGln)} · *${fmtMoney(b.subtotalPistaMonto)}*\n`;
        }

        if (b.storeAmount > 0 || b.subtotalPistaGln === 0) {
            msg += `🏪 *Ventas Tienda:* *${fmtMoney(b.storeAmount)}*\n`;
        }
        msg += `💰 *Total Sucursal:* *${fmtMoney(b.totalSucursal)}*\n\n`;
        if (i < branchResults.length - 1) msg += `────────────────────\n\n`;
    }

    return msg.trimEnd();
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

async function getAlertChatIds(pool, companyId = null) {
    if (companyId) {
        const [chats] = await pool.query(
            'SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE receive_alerts = 1 AND (company_id = ? OR company_id IS NULL)',
            [companyId]
        );
        return chats.map(c => c.chat_id);
    }
    const [globalChats] = await pool.query(
        'SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE receive_alerts = 1 AND company_id IS NULL'
    );
    return globalChats.map(c => c.chat_id);
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
    formatGroupSummaryMessage,
    getAlertChatIds
};
