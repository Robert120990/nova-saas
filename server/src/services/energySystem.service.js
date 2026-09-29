const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Utilidades de fecha y hora local de El Salvador (UTC-6)
 */
function getElSalvadorDateTimeParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);

    const get = (type) => parts.find(p => p.type === type)?.value || '';
    const yyyy = get('year');
    const mm = get('month');
    const dd = get('day');
    const hh = get('hour');
    const min = get('minute');
    const ss = get('second');

    return {
        dateStr: `${yyyy}-${mm}-${dd}`,
        timeStr: `${hh}:${min}:${ss}`,
        dateTimeStr: `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`,
        hour: parseInt(hh, 10),
        minute: parseInt(min, 10)
    };
}

/**
 * Cliente de integración para inversores Growatt
 */
async function fetchGrowatt(creds) {
    if (!creds.growatt_enabled) {
        return { enabled: false, error: null, plants: [], total: null };
    }

    try {
        const user = creds.growatt_username;
        const pass = creds.growatt_password;
        const pwdMd5 = crypto.createHash('md5').update(pass).digest('hex');

        const form = new URLSearchParams();
        form.append('account', user);
        form.append('passwordCrc', pwdMd5);
        form.append('password', '');
        form.append('validateCode', '');
        form.append('isReadPact', '0');

        const baseUrl = creds.growatt_url.replace(/\/+$/, '');
        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: form.toString()
        });

        const loginJson = await loginRes.json();
        if (loginJson.result !== 1) {
            return { enabled: true, success: false, error: 'Credenciales inválidas en Growatt' };
        }

        const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

        // Helper para POST con cookies
        const post = async (path, bodyObj = {}, extraCookies = '') => {
            const f = new URLSearchParams();
            for (const [k, v] of Object.entries(bodyObj)) f.append(k, v);
            const r = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': extraCookies ? `${cookieHeader}; ${extraCookies}` : cookieHeader
                },
                body: f.toString()
            });
            return await r.json();
        };

        // Totales globales
        const totalRes = await post('/selectPlant/getPlantTotal');
        const plantTotal = totalRes?.obj || {};

        // Lista de plantas
        const listRes = await post('/selectPlant/getPlantList', {
            currPage: '1',
            plantType: '-1',
            orderType: '2',
            plantName: ''
        });

        const plants = [];
        const rawDatas = listRes?.datas || [];
        const { dateStr } = getElSalvadorDateTimeParts();

        for (const item of rawDatas) {
            const plantId = item.id;
            let invTotal = null;
            let dayChart = null;

            try {
                const plantCookies = `selectedPlantId=${plantId}; b2SelectedPlantId=${plantId}`;
                const tRes = await post('/indexbC/inv/getInvTotalData', { plantId }, plantCookies);
                invTotal = tRes?.obj || null;

                const cRes = await post('/indexbC/inv/getInvEnergyDayChart', { plantId, date: dateStr }, plantCookies);
                dayChart = cRes?.obj?.pac || null;
            } catch (err) {
                // Silencioso por planta
            }

            const currentPac = invTotal?.pac ? parseFloat(invTotal.pac) : (parseFloat(item.currentPac) || 0);
            const eToday = invTotal?.epvToday ? parseFloat(invTotal.epvToday) : (parseFloat(item.eToday) || 0);
            const eTotal = invTotal?.epvTotal ? parseFloat(invTotal.epvTotal) : 0;

            plants.push({
                id: plantId,
                name: item.plantName,
                accountName: item.accountName,
                onlineNum: parseInt(item.onlineNum, 10) || 0,
                currentPacKw: currentPac,
                eTodayKwh: eToday,
                eTotalKwh: eTotal,
                plantImg: item.plantImg ? `${baseUrl}/plantimg/${item.plantImg}` : null,
                dayCurve: dayChart
            });
        }

        const totalPacKw = plants.reduce((sum, p) => sum + (p.currentPacKw || 0), 0);
        const totalTodayKwh = plants.reduce((sum, p) => sum + (p.eTodayKwh || 0), 0);
        const totalKwh = plantTotal.eTotalSum ? parseFloat(plantTotal.eTotalSum) : plants.reduce((sum, p) => sum + (p.eTotalKwh || 0), 0);

        return {
            enabled: true,
            success: true,
            totalNominalKw: parseFloat(plantTotal.nominalPower) || 340,
            totalRevenueUsd: parseFloat(plantTotal.etotalMoneyText) || 0,
            totalPacKw: parseFloat(totalPacKw.toFixed(2)),
            totalTodayKwh: parseFloat(totalTodayKwh.toFixed(2)),
            totalKwh: parseFloat(totalKwh.toFixed(2)),
            plants
        };
    } catch (err) {
        return { enabled: true, success: false, error: err.message };
    }
}

/**
 * Cliente de integración para banco de baterías y EMS (GESS SolarWeb)
 */
async function fetchGess(creds) {
    if (!creds.gess_enabled) {
        return { enabled: false, error: null, storage: null, devices: [] };
    }

    try {
        const user = creds.gess_username;
        const pass = creds.gess_password;
        const pwdSha1 = crypto.createHash('sha1').update(pass).digest('hex');
        const account = encodeURI(encodeURI(user));
        const baseUrl = creds.gess_url.replace(/\/+$/, '') + '/';

        const loginRes = await fetch(`${baseUrl}UserServlet?action=login&account=${account}&passwd=${pwdSha1}`);
        const loginJson = await loginRes.json();
        if (loginJson.err !== 0) {
            return { enabled: true, success: false, error: 'Credenciales inválidas en GESS SolarWeb' };
        }

        const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
        const jsession = (setCookie || []).find(c => c && c.includes('JSESSIONID'))?.split(';')[0] || '';

        const cookieHeader = [
            jsession,
            `HTTP_INTERFACE_USER=${user}`,
            `HTTP_INTERFACE_ROLE=${loginJson.dat.role}`,
            `HTTP_INTERFACE_ROLENAME=${encodeURIComponent(loginJson.dat.rolename || '')}`,
            `HTTP_INTERFACE_PWDSHA1=${pwdSha1}`,
            `HTTP_INTERFACE_AUTH_TOKEN=${loginJson.dat.token}`,
            `HTTP_STATUS_FLAG=1`
        ].filter(Boolean).join('; ');

        const oper = async (prefix, action) => {
            const salt = Date.now().toString();
            const sign = crypto.createHash('sha1').update(salt + pwdSha1 + action).digest('hex');
            const url = `${baseUrl}${prefix}?sign=${sign}&salt=${salt}${action}&callback=success_jsonpCallback`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Cookie': cookieHeader,
                    'Referer': `${baseUrl}main.jsp`
                }
            });
            const text = await res.text();
            const match = text.match(/success_jsonpCallback\(([\s\S]*)\)\s*;?$/);
            if (match) {
                try {
                    return JSON.parse(match[1]);
                } catch {
                    // eslint-disable-next-line no-eval
                    return eval('(' + match[1] + ')');
                }
            }
            return null;
        };

        const { dateStr } = getElSalvadorDateTimeParts();
        const statRes = await oper('MonitorServlet', `&action=plantStorageStatistic&date=${dateStr}`);
        const st = statRes?.dat || {};

        const plantId = creds.gess_plant_id || 218;
        const devRes = await oper('ConfigServlet', `&action=plantDevice&id=${plantId}`);
        const devices = devRes?.dat?.[0]?.deviceList || [];

        return {
            enabled: true,
            success: true,
            plantId,
            plantName: devRes?.dat?.[0]?.name || 'ANDELSA',
            batteryPowerKw: parseFloat(st.batteryPower) || 0,
            gridPowerKw: parseFloat(st.gridPower) || 0,
            pvPowerKw: parseFloat(st.pvPower) || 0,
            loadPowerKw: parseFloat(st.loadPower) || 0,
            socPct: parseFloat(st.soc) || 0,
            nominalCap: parseFloat(st.nominal) || 513,
            dayChargedKwh: parseFloat(st.dayCharged) || 0,
            dayDischargedKwh: parseFloat(st.dayDischarged) || 0,
            monthChargedKwh: parseFloat(st.monthCharged) || 0,
            monthDischargedKwh: parseFloat(st.monthDischarged) || 0,
            totalChargedKwh: parseFloat(st.totalCharged) || 0,
            totalDischargedKwh: parseFloat(st.totalDischarged) || 0,
            devices: devices.map(d => ({
                id: d.deviceId,
                name: d.devname,
                model: d.deviceModel,
                type: d.deviceType,
                status: d.status === 1 ? 'online' : 'offline'
            }))
        };
    } catch (err) {
        return { enabled: true, success: false, error: err.message };
    }
}

/**
 * Obtener credenciales de la empresa
 */
async function getCredentials(companyId) {
    const [rows] = await pool.query(
        'SELECT * FROM energy_credentials WHERE company_id = ? LIMIT 1',
        [companyId]
    );
    if (rows.length > 0) return rows[0];

    // Valores por defecto
    return {
        company_id: companyId,
        growatt_url: 'https://server.growatt.com/',
        growatt_username: 'Raul_Sosa',
        growatt_password: '1234567',
        growatt_enabled: 1,
        gess_url: 'http://gess.net.cn/SolarWeb/',
        gess_username: 'proyectos',
        gess_password: '123456',
        gess_plant_id: 218,
        gess_enabled: 1,
        sync_interval_hours: 4,
        peak_start_time: '18:00:00',
        peak_end_time: '22:00:00',
        peak_kwh_rate: 0.2200,
        offpeak_kwh_rate: 0.1400,
        solar_kwh_value: 0.1700
    };
}

/**
 * Telemetría en vivo combinada (Growatt + GESS SolarWeb)
 */
async function getLiveTelemetry(companyId) {
    const creds = await getCredentials(companyId);

    // Consulta paralela a ambos servicios
    const [growatt, gess] = await Promise.all([
        fetchGrowatt(creds),
        fetchGess(creds)
    ]);

    const { timeStr, dateTimeStr, hour } = getElSalvadorDateTimeParts();

    // Verificación de ventana de hora pico (18:00 a 22:00 por defecto)
    const peakStartHour = parseInt(creds.peak_start_time?.split(':')[0] || '18', 10);
    const peakEndHour = parseInt(creds.peak_end_time?.split(':')[0] || '22', 10);
    const isPeakHour = hour >= peakStartHour && hour < peakEndHour;

    // Métricas combinadas
    const solarPowerKw = growatt.success ? growatt.totalPacKw : (gess.success ? gess.pvPowerKw : 0);
    const batteryPowerKw = gess.success ? gess.batteryPowerKw : 0;
    const gridPowerKw = gess.success ? gess.gridPowerKw : 0;
    const loadPowerKw = gess.success ? gess.loadPowerKw : 0;
    const socPct = gess.success ? gess.socPct : 0;

    // Estado del flujo de batería
    let batteryState = 'idle';
    if (batteryPowerKw > 0.5) batteryState = 'charging';
    else if (batteryPowerKw < -0.5) batteryState = 'discharging';

    // Ahorro estimado diario ($)
    const peakRate = parseFloat(creds.peak_kwh_rate) || 0.22;
    const solarRate = parseFloat(creds.solar_kwh_value) || 0.17;
    const dischargedToday = gess.success ? gess.dayDischargedKwh : 0;
    const solarToday = growatt.success ? growatt.totalTodayKwh : (gess.success ? (gess.dayChargedKwh * 0.5) : 0);

    const savingsFromBatteryPeak = dischargedToday * peakRate;
    const savingsFromSolar = solarToday * solarRate;
    const totalEstimatedSavings = parseFloat((savingsFromBatteryPeak + savingsFromSolar).toFixed(2));

    return {
        timestamp: dateTimeStr,
        localTime: timeStr,
        isPeakHour,
        config: {
            peakStartTime: creds.peak_start_time,
            peakEndTime: creds.peak_end_time,
            peakRate,
            offpeakRate: parseFloat(creds.offpeak_kwh_rate) || 0.14,
            solarRate
        },
        summary: {
            solarPowerKw,
            batteryPowerKw,
            gridPowerKw,
            loadPowerKw,
            socPct,
            batteryState,
            solarTodayKwh: solarToday,
            batteryChargedTodayKwh: gess.success ? gess.dayChargedKwh : 0,
            batteryDischargedTodayKwh: dischargedToday,
            totalEstimatedSavingsUsd: totalEstimatedSavings,
            savingsFromBatteryPeakUsd: parseFloat(savingsFromBatteryPeak.toFixed(2)),
            savingsFromSolarUsd: parseFloat(savingsFromSolar.toFixed(2))
        },
        growatt,
        gess
    };
}

/**
 * Guarda una lectura en la base de datos y actualiza el resumen del día
 */
async function recordReading(companyId, source = 'auto') {
    const creds = await getCredentials(companyId);
    const live = await getLiveTelemetry(companyId);
    const { dateStr, dateTimeStr } = getElSalvadorDateTimeParts();

    const gPac = live.growatt?.totalPacKw || 0;
    const gToday = live.growatt?.totalTodayKwh || 0;
    const gTotal = live.growatt?.totalKwh || 0;
    const gPlants = JSON.stringify(live.growatt?.plants || []);

    const sSoc = live.gess?.socPct || 0;
    const sBatPow = live.gess?.batteryPowerKw || 0;
    const sGridPow = live.gess?.gridPowerKw || 0;
    const sPvPow = live.gess?.pvPowerKw || 0;
    const sLoadPow = live.gess?.loadPowerKw || 0;
    const sDayCh = live.gess?.dayChargedKwh || 0;
    const sDayDis = live.gess?.dayDischargedKwh || 0;
    const sTotCh = live.gess?.totalChargedKwh || 0;
    const sTotDis = live.gess?.totalDischargedKwh || 0;

    const [res] = await pool.query(`
        INSERT INTO energy_readings 
        (company_id, reading_time, source, growatt_pac_kw, growatt_today_kwh, growatt_total_kwh,
         growatt_plants_data, gess_soc_pct, gess_battery_power_kw, gess_grid_power_kw, gess_pv_power_kw,
         gess_load_power_kw, gess_day_charged_kwh, gess_day_discharged_kwh, gess_total_charged_kwh,
         gess_total_discharged_kwh, is_peak_hour, estimated_savings_today_usd, status_notes, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        companyId,
        dateTimeStr,
        source,
        gPac,
        gToday,
        gTotal,
        gPlants,
        sSoc,
        sBatPow,
        sGridPow,
        sPvPow,
        sLoadPow,
        sDayCh,
        sDayDis,
        sTotCh,
        sTotDis,
        live.isPeakHour ? 1 : 0,
        live.summary.totalEstimatedSavingsUsd,
        `Sincronización ${source}`,
        JSON.stringify({ growatt: live.growatt, gess: live.gess })
    ]);

    // Actualizar last_sync_at en credentials
    await pool.query(
        'UPDATE energy_credentials SET last_sync_at = ? WHERE company_id = ?',
        [dateTimeStr, companyId]
    );

    // Upsert en resumen diario
    const peakSavings = live.summary.savingsFromBatteryPeakUsd;
    const solarSavings = live.summary.savingsFromSolarUsd;
    const totalSavings = live.summary.totalEstimatedSavingsUsd;
    const co2Kg = parseFloat((gToday * 0.5).toFixed(2));
    const efficiency = sDayCh > 0 ? parseFloat(((sDayDis / sDayCh) * 100).toFixed(1)) : 0;

    await pool.query(`
        INSERT INTO energy_daily_summaries
        (company_id, summary_date, solar_generated_kwh, battery_charged_kwh, battery_discharged_kwh,
         battery_efficiency_pct, peak_savings_usd, solar_savings_usd, total_savings_usd, co2_avoided_kg,
         max_solar_power_kw, max_load_power_kw, min_battery_soc, max_battery_soc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            solar_generated_kwh = VALUES(solar_generated_kwh),
            battery_charged_kwh = VALUES(battery_charged_kwh),
            battery_discharged_kwh = VALUES(battery_discharged_kwh),
            battery_efficiency_pct = VALUES(battery_efficiency_pct),
            peak_savings_usd = VALUES(peak_savings_usd),
            solar_savings_usd = VALUES(solar_savings_usd),
            total_savings_usd = VALUES(total_savings_usd),
            co2_avoided_kg = VALUES(co2_avoided_kg),
            max_solar_power_kw = GREATEST(max_solar_power_kw, VALUES(max_solar_power_kw)),
            max_load_power_kw = GREATEST(max_load_power_kw, VALUES(max_load_power_kw)),
            min_battery_soc = LEAST(min_battery_soc, VALUES(min_battery_soc)),
            max_battery_soc = GREATEST(max_battery_soc, VALUES(max_battery_soc)),
            updated_at = CURRENT_TIMESTAMP
    `, [
        companyId,
        dateStr,
        gToday,
        sDayCh,
        sDayDis,
        efficiency,
        peakSavings,
        solarSavings,
        totalSavings,
        co2Kg,
        gPac,
        sLoadPow,
        sSoc,
        sSoc
    ]);

    return { readingId: res.insertId, live };
}

/**
 * Consulta de historial de lecturas con filtros
 */
async function getReadingsHistory(companyId, { startDate, endDate, limit = 50, page = 1 }) {
    const offset = (page - 1) * limit;
    let where = 'WHERE company_id = ?';
    const params = [companyId];

    if (startDate) {
        where += ' AND DATE(reading_time) >= ?';
        params.push(startDate);
    }
    if (endDate) {
        where += ' AND DATE(reading_time) <= ?';
        params.push(endDate);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM energy_readings ${where}`, params);
    const total = countRows[0]?.total || 0;

    const [rows] = await pool.query(`
        SELECT id, reading_time, source, growatt_pac_kw, growatt_today_kwh, growatt_total_kwh,
               gess_soc_pct, gess_battery_power_kw, gess_grid_power_kw, gess_pv_power_kw,
               gess_load_power_kw, gess_day_charged_kwh, gess_day_discharged_kwh,
               is_peak_hour, estimated_savings_today_usd, status_notes, created_at
        FROM energy_readings
        ${where}
        ORDER BY reading_time DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
        data: rows,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Consulta de resúmenes diarios (para gráficos y analítica)
 */
async function getDailySummaries(companyId, { startDate, endDate, limit = 30 }) {
    let where = 'WHERE company_id = ?';
    const params = [companyId];

    if (startDate) {
        where += ' AND summary_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        where += ' AND summary_date <= ?';
        params.push(endDate);
    }

    const [rows] = await pool.query(`
        SELECT * FROM energy_daily_summaries
        ${where}
        ORDER BY summary_date DESC
        LIMIT ?
    `, [...params, parseInt(limit, 10)]);

    return rows.reverse();
}

/**
 * Actualizar credenciales y configuración
 */
async function updateCredentials(companyId, data) {
    await pool.query(`
        INSERT INTO energy_credentials
        (company_id, growatt_url, growatt_username, growatt_password, growatt_enabled,
         gess_url, gess_username, gess_password, gess_plant_id, gess_enabled,
         sync_interval_hours, peak_start_time, peak_end_time, peak_kwh_rate, offpeak_kwh_rate, solar_kwh_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            growatt_url = VALUES(growatt_url),
            growatt_username = VALUES(growatt_username),
            growatt_password = VALUES(growatt_password),
            growatt_enabled = VALUES(growatt_enabled),
            gess_url = VALUES(gess_url),
            gess_username = VALUES(gess_username),
            gess_password = VALUES(gess_password),
            gess_plant_id = VALUES(gess_plant_id),
            gess_enabled = VALUES(gess_enabled),
            sync_interval_hours = VALUES(sync_interval_hours),
            peak_start_time = VALUES(peak_start_time),
            peak_end_time = VALUES(peak_end_time),
            peak_kwh_rate = VALUES(peak_kwh_rate),
            offpeak_kwh_rate = VALUES(offpeak_kwh_rate),
            solar_kwh_value = VALUES(solar_kwh_value),
            updated_at = CURRENT_TIMESTAMP
    `, [
        companyId,
        data.growatt_url || 'https://server.growatt.com/',
        data.growatt_username || 'Raul_Sosa',
        data.growatt_password || '1234567',
        data.growatt_enabled ? 1 : 0,
        data.gess_url || 'http://gess.net.cn/SolarWeb/',
        data.gess_username || 'proyectos',
        data.gess_password || '123456',
        parseInt(data.gess_plant_id, 10) || 218,
        data.gess_enabled ? 1 : 0,
        parseInt(data.sync_interval_hours, 10) || 4,
        data.peak_start_time || '18:00:00',
        data.peak_end_time || '22:00:00',
        data.peak_kwh_rate || 0.2200,
        data.offpeak_kwh_rate || 0.1400,
        data.solar_kwh_value || 0.1700
    ]);

    return await getCredentials(companyId);
}

/**
 * Runner del Cron de auto-sincronización energética
 */
let energyCronInterval = null;

function startEnergyAutoSyncCron() {
    if (energyCronInterval) return;

    console.log('[EnergyAutoSync] Iniciando monitor en segundo plano para Sistema Energético...');

    // Verifica cada 10 minutos si toca sincronizar
    energyCronInterval = setInterval(async () => {
        try {
            const [configs] = await pool.query(`
                SELECT company_id, sync_interval_hours, last_sync_at
                FROM energy_credentials
                WHERE growatt_enabled = 1 OR gess_enabled = 1
            `);

            const now = new Date();

            for (const cfg of configs) {
                const intervalMs = (cfg.sync_interval_hours || 4) * 60 * 60 * 1000;
                const lastSync = cfg.last_sync_at ? new Date(cfg.last_sync_at) : new Date(0);

                if (now.getTime() - lastSync.getTime() >= intervalMs) {
                    console.log(`[EnergyAutoSync] Ejecutando sincronización automática para empresa ${cfg.company_id}...`);
                    await recordReading(cfg.company_id, 'auto');
                }
            }
        } catch (e) {
            console.error('[EnergyAutoSync] Error en ciclo de auto-sincronización:', e.message);
        }
    }, 10 * 60 * 1000); // cada 10 minutos
}

module.exports = {
    getCredentials,
    updateCredentials,
    fetchGrowatt,
    fetchGess,
    getLiveTelemetry,
    recordReading,
    getReadingsHistory,
    getDailySummaries,
    startEnergyAutoSyncCron,
    getElSalvadorDateTimeParts
};
