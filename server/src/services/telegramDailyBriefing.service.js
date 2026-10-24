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
    getAlertChatIds
} = require('./telegramDailyBriefingHelper');

/**
 * Consulta y formatea el reporte de ventas del día anterior para una empresa
 */
async function generateDailyBriefingReport(companyId, targetDate = null, isUpdate = false) {
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

    // 2. Obtener información de turnos registrados para la fecha
    const [closeoutRows] = await pool.query(
        `SELECT id, branch_id, numero_turno, estado
         FROM gas_station_closeouts
         WHERE company_id = ? AND fecha_turno = ?
         ORDER BY branch_id, CAST(numero_turno AS UNSIGNED) ASC`,
        [companyId, fechaReporte]
    );

    const closeoutsByBranch = new Map();
    for (const c of closeoutRows) {
        if (!closeoutsByBranch.has(c.branch_id)) closeoutsByBranch.set(c.branch_id, []);
        closeoutsByBranch.get(c.branch_id).push(c);
    }

    // 3. Obtener lecturas de combustible de cierres de ese día (tanto cerrados/reabiertos como abiertos con lecturas)
    const [fuelRows] = await pool.query(
        `SELECT c.branch_id, r.descripcion_producto, p.tipo_combustible,
                COALESCE(SUM(r.diferencia), 0) AS galones,
                COALESCE(SUM(r.monto), 0) AS monto
         FROM gas_station_closeouts c
         JOIN gas_station_closeout_readings r ON r.closeout_id = c.id
         LEFT JOIN products p ON p.id = r.product_id
         WHERE c.company_id = ? AND c.fecha_turno = ?
         GROUP BY c.branch_id, r.descripcion_producto, p.tipo_combustible`,
        [companyId, fechaReporte]
    );

    const fuelByBranch = new Map();
    for (const row of fuelRows) {
        if (!fuelByBranch.has(row.branch_id)) fuelByBranch.set(row.branch_id, []);
        fuelByBranch.get(row.branch_id).push(row);
    }

    // 4. Consultar ventas por sucursal
    const branchResults = [];
    const emptyFuels = () => ({ 'Diesel': { galones: 0, monto: 0 }, 'Regular': { galones: 0, monto: 0 }, 'Súper': { galones: 0, monto: 0 }, 'Ion Diesel': { galones: 0, monto: 0 }, 'Otros': { galones: 0, monto: 0 } });
    const globalFuels = emptyFuels();
    let globalPistaGalones = 0, globalPistaMonto = 0, globalTiendaMonto = 0;

    for (const br of branches) {
        const branchId = br.id;
        const branchName = br.nombre;
        const fuels = emptyFuels();

        const rows = fuelByBranch.get(branchId) || [];
        for (const r of rows) {
            const cat = categorizeFuel(r.descripcion_producto, r.tipo_combustible);
            const gln = parseFloat(r.galones) || 0;
            const mto = parseFloat(r.monto) || 0;
            if (fuels[cat]) {
                fuels[cat].galones += gln;
                fuels[cat].monto += mto;
                if (globalFuels[cat]) {
                    globalFuels[cat].galones += gln;
                    globalFuels[cat].monto += mto;
                }
            }
        }

        const subtotalPistaGln = Object.values(fuels).reduce((acc, f) => acc + f.galones, 0);
        const subtotalPistaMonto = Object.values(fuels).reduce((acc, f) => acc + f.monto, 0);

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

        // Resumen de estado de turnos de la sucursal
        const bCloseouts = closeoutsByBranch.get(branchId) || [];
        let shiftsSummary = null;
        if (bCloseouts.length > 0) {
            const openCount = bCloseouts.filter(x => x.estado === 'abierto').length;
            const turnosList = bCloseouts.map(x => `T${x.numero_turno}${x.estado === 'abierto' ? ' (Abierto)' : ''}`).join(', ');

            if (openCount > 0) {
                shiftsSummary = `📋 *Turnos:* ${turnosList} · ⚠️ _(${openCount} turno(s) aún abierto(s))_`;
            } else {
                shiftsSummary = `📋 *Turnos cerrados:* ${bCloseouts.length} (${turnosList})`;
            }
        }

        branchResults.push({
            branchId,
            branchName,
            fuels,
            subtotalPistaGln,
            subtotalPistaMonto,
            storeAmount,
            totalSucursal,
            shiftsSummary
        });
    }

    const granTotal = globalPistaMonto + globalTiendaMonto;

    // 5. Formatear mensaje para Telegram
    const message = formatCompanyReportMessage({
        companyName,
        fechaDisplay,
        branchResults,
        globalFuels,
        globalPistaGalones,
        globalPistaMonto,
        globalTiendaMonto,
        granTotal,
        isUpdate
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

/**
 * Envía el reporte a todos los chats autorizados de una empresa
 */
async function sendDailyBriefingForCompany(companyId, { targetDate = null, manual = false, specificChatId = null, isUpdate = false } = {}) {
    if (!manual) {
        const [settings] = await pool.query('SELECT daily_briefing_active FROM telegram_settings WHERE id = 1');
        if (settings[0]?.daily_briefing_active === 0) return { skipped: true, reason: 'Configuración inactiva' };
    }

    const report = await generateDailyBriefingReport(companyId, targetDate, isUpdate);
    if (!report?.message) return { success: false, message: 'No se encontraron sucursales para esta empresa.' };

    const chatIds = specificChatId ? [specificChatId] : await getAlertChatIds(pool, companyId);
    if (chatIds.length === 0) return { success: false, message: 'No hay chats de Telegram vinculados a esta empresa.' };

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
async function sendAllDailyBriefings({ targetDate = null, manual = false, isUpdate = false } = {}) {
    if (!manual) {
        const [settings] = await pool.query('SELECT daily_briefing_active, daily_briefing_last_sent_date FROM telegram_settings WHERE id = 1');
        if (settings[0]?.daily_briefing_active === 0) {
            console.log('[DailyBriefing] Envío diario desactivado en telegram_settings. Omitiendo.');
            return { skipped: true, reason: 'Configuración inactiva' };
        }

        // Bloqueo distribuido atómico en MySQL para evitar envíos duplicados entre múltiples instancias/servidores
        const executionDate = getElSalvadorDate(new Date());
        const [lockResult] = await pool.query(
            `UPDATE telegram_settings
             SET daily_briefing_last_sent_date = ?
             WHERE id = 1 AND (daily_briefing_last_sent_date IS NULL OR daily_briefing_last_sent_date != ?)`,
            [executionDate, executionDate]
        );

        if (lockResult.affectedRows === 0) {
            console.log(`[DailyBriefing] El reporte matutino de la fecha ${executionDate} ya fue procesado o enviado por otra instancia. Omitiendo.`);
            return { skipped: true, reason: 'Already sent today' };
        }
    }

    const [companies] = await pool.query(
        `SELECT DISTINCT c.id, c.razon_social
         FROM companies c
         WHERE EXISTS (SELECT 1 FROM gas_station_closeouts g WHERE g.company_id = c.id)
         ORDER BY c.id`
    );

    console.log(`[DailyBriefing] Procesando reporte diario de ${companies.length} empresas...`);
    const generatedReports = [];

    for (const c of companies) {
        try {
            const report = await generateDailyBriefingReport(c.id, targetDate, isUpdate);
            if (report?.message) {
                generatedReports.push(report);
                const companyChats = await getAlertChatIds(pool, c.id);
                for (const chatId of companyChats) {
                    try {
                        await telegramService.sendMessage(chatId, report.message, { parse_mode: 'Markdown' });
                    } catch (err) {
                        console.error(`[DailyBriefing] Error enviando a chat ${chatId}:`, err.message);
                    }
                }
                await new Promise(r => setTimeout(r, 400));
            }
        } catch (err) {
            console.error(`[DailyBriefing] Error procesando empresa ${c.id}:`, err.message);
        }
    }

    return {
        success: true,
        count: generatedReports.length,
        companies: generatedReports.map(r => r.companyName),
        message: `Reportes matutinos de ${generatedReports.length} empresas procesados exitosamente.`
    };
}

/**
 * Revisa si alguna empresa tuvo cierres nocturnos finalizados tarde y envía la actualización
 */
async function checkAndSendFollowUpBriefings(targetDate = null) {
    const fecha = normalizeDateStr(targetDate);
    const [companiesWithLateCloseouts] = await pool.query(`
        SELECT DISTINCT c.id, c.razon_social
        FROM companies c
        JOIN gas_station_closeouts co ON co.company_id = c.id
        WHERE co.fecha_turno = ? AND co.closed_at >= CONCAT(CURDATE(), ' 08:00:00')
    `, [fecha]);

    for (const c of companiesWithLateCloseouts) {
        try {
            await sendDailyBriefingForCompany(c.id, { targetDate: fecha, manual: true, isUpdate: true });
            await new Promise(r => setTimeout(r, 400));
        } catch (e) {
            console.error(`[DailyBriefing] Error en follow-up empresa ${c.id}:`, e.message);
        }
    }
}

// ============ Programador Cron (8:00 AM y seguimiento 9:30 AM hora El Salvador) ============
let cronInterval = null;
let lastSentDate = null;
let lastFollowUpDate = null;

function startDailyBriefingCron() {
    if (process.env.NODE_ENV !== 'production' && process.env.TELEGRAM_DEV_CRON !== 'true') {
        console.log('[DailyBriefing] Cron desactivado en local (usar TELEGRAM_DEV_CRON=true si se desea probar).');
        return;
    }
    if (cronInterval) return;
    console.log('[DailyBriefing] Cron de Reporte Matutino iniciado (8:00 AM y seguimiento 9:30 AM El Salvador).');

    cronInterval = setInterval(async () => {
        try {
            const now = new Date();
            const { hour: h, minute: m } = getElSalvadorTime(now);
            const currentDayStr = getElSalvadorDate(now);

            // 8:00 AM: Envío matutino principal
            if (h === 8 && m === 0 && lastSentDate !== currentDayStr) {
                lastSentDate = currentDayStr;
                console.log(`[DailyBriefing] 8:00 AM alcanzado. Enviando reporte matutino de todas las empresas...`);
                await sendAllDailyBriefings({ targetDate: getYesterdayElSalvador() });
            }

            // 9:30 AM: Seguimiento automático para turnos nocturnos cerrados tarde
            if (h === 9 && m === 30 && lastFollowUpDate !== currentDayStr) {
                lastFollowUpDate = currentDayStr;
                console.log(`[DailyBriefing] 9:30 AM alcanzado. Verificando turnos cerrados tarde...`);
                await checkAndSendFollowUpBriefings(getYesterdayElSalvador());
            }

            if (lastSentDate && lastSentDate !== currentDayStr && h < 8) {
                lastSentDate = null;
                lastFollowUpDate = null;
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
    checkAndSendFollowUpBriefings,
    startDailyBriefingCron,
    stopDailyBriefingCron
};
