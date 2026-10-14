const pool = require('../config/db');
const telegramService = require('./telegram.service');
const { getPuntosVentaTienda } = require('./salesTiendaShift.service');
const {
    getYesterdayElSalvador,
    getElSalvadorTime,
    getElSalvadorDate,
    normalizeDateStr,
    formatDateDDMMYYYY,
    categorizeFuel,
    FUEL_TYPES,
    formatCompanyReportMessage,
    formatGroupSummaryMessage
} = require('./telegramDailyBriefingHelper');

/**
 * Consulta y formatea el reporte de ventas del día anterior para una empresa
 */
async function generateDailyBriefingReport(companyId, targetDate = null) {
    const fechaReporte = normalizeDateStr(targetDate);
    const fechaDisplay = formatDateDDMMYYYY(fechaReporte);

    const [compRows] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
    const companyName = compRows[0]?.razon_social || 'Empresa';

    // 1. Obtener todas las sucursales de la empresa
    const [branches] = await pool.query(
        `SELECT id, nombre FROM branches WHERE company_id = ? ORDER BY nombre`,
        [companyId]
    );

    if (branches.length === 0) return null;

    // 2. Obtener lecturas de combustible de cierres de ese día
    const [fuelRows] = await pool.query(
        `SELECT c.branch_id, r.descripcion_producto,
                COALESCE(SUM(r.diferencia), 0) AS galones,
                COALESCE(SUM(r.monto), 0) AS monto
         FROM gas_station_closeouts c
         JOIN gas_station_closeout_readings r ON r.closeout_id = c.id
         WHERE c.company_id = ? AND c.fecha_turno = ? AND c.estado IN ('cerrado', 'reabierto')
         GROUP BY c.branch_id, r.descripcion_producto`,
        [companyId, fechaReporte]
    );

    const fuelByBranch = new Map();
    for (const row of fuelRows) {
        if (!fuelByBranch.has(row.branch_id)) fuelByBranch.set(row.branch_id, []);
        fuelByBranch.get(row.branch_id).push(row);
    }

    // 3. Consultar ventas por sucursal
    const branchResults = [];
    const globalFuels = {
        'Diesel': { galones: 0, monto: 0 },
        'Regular': { galones: 0, monto: 0 },
        'Súper': { galones: 0, monto: 0 },
        'Ion Diesel': { galones: 0, monto: 0 }
    };
    let globalPistaGalones = 0;
    let globalPistaMonto = 0;
    let globalTiendaMonto = 0;

    for (const br of branches) {
        const branchId = br.id;
        const branchName = br.nombre;

        const fuels = {
            'Diesel': { galones: 0, monto: 0 },
            'Regular': { galones: 0, monto: 0 },
            'Súper': { galones: 0, monto: 0 },
            'Ion Diesel': { galones: 0, monto: 0 }
        };

        const rows = fuelByBranch.get(branchId) || [];
        for (const r of rows) {
            const cat = categorizeFuel(r.descripcion_producto);
            const gln = parseFloat(r.galones) || 0;
            const mto = parseFloat(r.monto) || 0;
            if (fuels[cat]) {
                fuels[cat].galones += gln;
                fuels[cat].monto += mto;
                globalFuels[cat].galones += gln;
                globalFuels[cat].monto += mto;
            }
        }

        const subtotalPistaGln = FUEL_TYPES.reduce((acc, f) => acc + fuels[f].galones, 0);
        const subtotalPistaMonto = FUEL_TYPES.reduce((acc, f) => acc + fuels[f].monto, 0);

        // Ventas de Tienda
        let storeAmount = 0;
        const posIds = await getPuntosVentaTienda(companyId, branchId);
        if (posIds.length > 0) {
            const [storeRows] = await pool.query(
                `SELECT ROUND(COALESCE(SUM(sh.total_pagar), 0), 2) AS monto
                 FROM sales_headers sh
                 WHERE sh.company_id = ? AND sh.branch_id = ?
                   AND sh.fecha_emision = ? AND sh.estado = 'emitido'
                   AND NOT EXISTS (SELECT 1 FROM dtes d WHERE d.venta_id = sh.id AND d.status = 'INVALIDADO')
                   AND sh.pos_id IN (?)`,
                [companyId, branchId, fechaReporte, posIds]
            );
            storeAmount = parseFloat(storeRows[0]?.monto) || 0;
        }

        const totalSucursal = subtotalPistaMonto + storeAmount;

        globalPistaGalones += subtotalPistaGln;
        globalPistaMonto += subtotalPistaMonto;
        globalTiendaMonto += storeAmount;

        branchResults.push({
            branchId,
            branchName,
            fuels,
            subtotalPistaGln,
            subtotalPistaMonto,
            storeAmount,
            totalSucursal
        });
    }

    const granTotal = globalPistaMonto + globalTiendaMonto;

    // 4. Formatear mensaje para Telegram
    const message = formatCompanyReportMessage({
        companyName,
        fechaDisplay,
        branchResults,
        globalFuels,
        globalPistaGalones,
        globalPistaMonto,
        globalTiendaMonto,
        granTotal
    });

    return {
        companyId,
        companyName,
        fechaReporte,
        fechaDisplay,
        message,
        branchResults,
        totals: { globalPistaGalones, globalPistaMonto, globalTiendaMonto, granTotal }
    };
}

async function getAlertChatIds(companyId = null) {
    let query = 'SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE receive_alerts = 1';
    let params = [];
    if (companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
    }
    let [chats] = await pool.query(query, params);
    if (chats.length === 0) {
        const [allAlerts] = await pool.query('SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE receive_alerts = 1');
        chats = allAlerts.length > 0 ? allAlerts : (await pool.query('SELECT DISTINCT chat_id FROM telegram_chat_bindings'))[0];
    }
    return chats.map(c => c.chat_id);
}

/**
 * Envía el reporte a todos los chats autorizados de una empresa
 */
async function sendDailyBriefingForCompany(companyId, { targetDate = null, manual = false } = {}) {
    if (!manual) {
        const [settings] = await pool.query('SELECT daily_briefing_active FROM telegram_settings WHERE id = 1');
        if (settings[0]?.daily_briefing_active === 0) return { skipped: true, reason: 'Configuración inactiva' };
    }

    const report = await generateDailyBriefingReport(companyId, targetDate);
    if (!report?.message) return { success: false, message: 'No se encontraron sucursales para esta empresa.' };

    const chatIds = await getAlertChatIds(companyId);
    if (chatIds.length === 0) return { success: false, message: 'No hay chats de Telegram vinculados.' };

    let sentCount = 0;
    for (const chatId of chatIds) {
        try {
            await telegramService.sendMessage(chatId, report.message, { parse_mode: 'Markdown' });
            sentCount++;
        } catch (err) {
            console.error(`[DailyBriefing] Error enviando a chat ${chatId}:`, err.message);
        }
    }

    return {
        success: true,
        sentCount,
        companyName: report.companyName,
        fecha: report.fechaDisplay,
        message: `Reporte matutino enviado exitosamente a ${sentCount} chat(s) de Telegram.`
    };
}

/**
 * Envía el reporte de TODAS las empresas que operan estaciones de servicio / ventas
 */
async function sendAllDailyBriefings({ targetDate = null, manual = false } = {}) {
    if (!manual) {
        const [settings] = await pool.query('SELECT daily_briefing_active FROM telegram_settings WHERE id = 1');
        if (settings[0]?.daily_briefing_active === 0) {
            console.log('[DailyBriefing] Envío diario desactivado en telegram_settings. Omitiendo.');
            return { skipped: true };
        }
    }

    const [companies] = await pool.query(
        `SELECT DISTINCT c.id, c.razon_social
         FROM companies c
         WHERE EXISTS (SELECT 1 FROM gas_station_closeouts g WHERE g.company_id = c.id)
         ORDER BY c.id`
    );

    const chatIds = await getAlertChatIds();
    if (chatIds.length === 0) return { success: false, message: 'No hay chats configurados para recibir alertas.' };

    console.log(`[DailyBriefing] Enviando reporte diario de ${companies.length} empresas a ${chatIds.length} chat(s)...`);
    const generatedReports = [];

    for (const c of companies) {
        try {
            const report = await generateDailyBriefingReport(c.id, targetDate);
            if (report?.message) {
                generatedReports.push(report);
                for (const chatId of chatIds) {
                    await telegramService.sendMessage(chatId, report.message, { parse_mode: 'Markdown' });
                }
                await new Promise(r => setTimeout(r, 600));
            }
        } catch (err) {
            console.error(`[DailyBriefing] Error procesando empresa ${c.id}:`, err.message);
        }
    }

    // Si hay más de una empresa, enviar Consolidado General del Grupo Empresarial
    if (generatedReports.length > 1) {
        const groupMsg = formatGroupSummaryMessage(generatedReports, generatedReports[0].fechaDisplay);
        for (const chatId of chatIds) {
            await telegramService.sendMessage(chatId, groupMsg, { parse_mode: 'Markdown' });
        }
    }

    return {
        success: true,
        count: generatedReports.length,
        companies: generatedReports.map(r => r.companyName),
        message: `Reportes matutinos de ${generatedReports.length} empresas enviados exitosamente a Telegram.`
    };
}

// ============ Programador Cron (7:00 AM hora El Salvador) ============

let cronInterval = null;
let lastSentDate = null;

function startDailyBriefingCron() {
    if (cronInterval) return;
    console.log('[DailyBriefing] Cron de Reporte Matutino iniciado (7:00 AM El Salvador).');

    cronInterval = setInterval(async () => {
        try {
            const now = new Date();
            const { hour: h, minute: m } = getElSalvadorTime(now);
            const currentDayStr = getElSalvadorDate(now);

            if (h === 7 && m === 0 && lastSentDate !== currentDayStr) {
                lastSentDate = currentDayStr;
                console.log(`[DailyBriefing] 7:00 AM alcanzado. Enviando reporte matutino de todas las empresas...`);
                await sendAllDailyBriefings({ targetDate: getYesterdayElSalvador() });
            }
            if (lastSentDate && lastSentDate !== currentDayStr && h < 7) {
                lastSentDate = null;
            }
        } catch (e) {
            console.error('[DailyBriefing] Error en cron:', e.message);
        }
    }, 30 * 1000);
}

function stopDailyBriefingCron() {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
}

module.exports = {
    generateDailyBriefingReport,
    sendDailyBriefingForCompany,
    sendAllDailyBriefings,
    startDailyBriefingCron,
    stopDailyBriefingCron
};
