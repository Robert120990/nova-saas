const crypto = require('crypto');
const pool = require('../config/db');
const { decrypt } = require('../utils/crypto');
const energySystemService = require('./energySystem.service');

function safeDecrypt(val, fallback = '1234567') {
    if (!val || typeof val !== 'string') return fallback;
    const parts = val.split(':');
    if (parts.length === 3) {
        try {
            const dec = decrypt(val);
            if (dec && dec.length > 0) return dec;
        } catch (e) {
            console.warn('[safeDecrypt] Error desencriptando credenciales:', e.message);
        }
        return fallback;
    }
    return val;
}

// Memoria caché para sesiones y estados de limitación de Growatt
const growattSessions = new Map();
const growattLockouts = new Map();

/**
 * Fecha y hora en zona horaria de El Salvador (UTC-6)
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

    return {
        dateStr: `${yyyy}-${mm}-${dd}`,
        monthStr: `${yyyy}-${mm}`,
        yearStr: yyyy,
        hour: parseInt(hh, 10),
        minute: parseInt(min, 10)
    };
}

/**
 * Autenticación y cliente Growatt para llamadas analíticas
 */
async function createGrowattClient(creds) {
    if (!creds.growatt_enabled) return null;

    const user = creds.growatt_username || 'Raul_Sosa';
    const pass = creds.growatt_password_decrypted || safeDecrypt(creds.growatt_password, '1234567');
    const baseUrl = creds.growatt_url.replace(/\/+$/, '');

    // Verificar si está en cooldown por rate-limit
    const cooldownUntil = growattLockouts.get(user);
    if (cooldownUntil && Date.now() < cooldownUntil) {
        return null; // En cooldown: delegar a telemetría en base de datos
    }

    let cookieHeader = null;
    const cached = growattSessions.get(user);
    if (cached && Date.now() < cached.expiresAt) {
        cookieHeader = cached.cookieHeader;
    }

    const post = async (path, bodyObj = {}, extraCookies = '') => {
        const f = new URLSearchParams();
        for (const [k, v] of Object.entries(bodyObj)) f.append(k, v);
        const r = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': extraCookies ? `${cookieHeader}; ${extraCookies}` : (cookieHeader || '')
            },
            body: f.toString(),
            signal: AbortSignal.timeout(10000)
        });
        return await r.json();
    };

    if (!cookieHeader) {
        try {
            const pwdMd5 = crypto.createHash('md5').update(pass).digest('hex');
            const form = new URLSearchParams();
            form.append('account', user);
            form.append('passwordCrc', pwdMd5);
            form.append('password', '');
            form.append('validateCode', '');
            form.append('isReadPact', '0');

            const loginRes = await fetch(`${baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: form.toString(),
                signal: AbortSignal.timeout(10000)
            });

            const loginJson = await loginRes.json();
            if (loginJson.result === -5) {
                growattLockouts.set(user, Date.now() + 20 * 60 * 1000);
                return null;
            }
            if (loginJson.result !== 1) {
                return null;
            }

            const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
            cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

            growattSessions.set(user, {
                cookieHeader,
                expiresAt: Date.now() + 25 * 60 * 1000
            });
            growattLockouts.delete(user);
        } catch {
            return null;
        }
    }

    try {
        // Obtener lista de plantas
        const listRes = await post('/selectPlant/getPlantList', {
            currPage: '1',
            plantType: '-1',
            orderType: '2',
            plantName: ''
        });

        if (listRes?.result === -1) {
            growattSessions.delete(user);
            return null;
        }

        const plants = (listRes?.datas || []).map(p => ({
            id: String(p.id),
            name: p.plantName,
            nominalPower: parseFloat(p.nominalPower) || 0
        }));

        return { post, plants, baseUrl };
    } catch {
        return null;
    }
}

/**
 * Autenticación y cliente GESS SolarWeb para llamadas analíticas
 */
async function createGessClient(creds) {
    if (!creds.gess_enabled || !creds.gess_plant_id) return null;

    const user = creds.gess_username;
    const pass = creds.gess_password_decrypted || safeDecrypt(creds.gess_password);
    const pwdSha1 = crypto.createHash('sha1').update(pass).digest('hex');
    const account = encodeURI(encodeURI(user));
    const baseUrl = creds.gess_url.replace(/\/+$/, '') + '/';

    const loginRes = await fetch(`${baseUrl}UserServlet?action=login&account=${account}&passwd=${pwdSha1}`, {
        signal: AbortSignal.timeout(10000)
    });
    const loginJson = await loginRes.json();
    if (loginJson.err !== 0) {
        throw new Error('Credenciales inválidas en GESS SolarWeb');
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
            },
            signal: AbortSignal.timeout(10000)
        });
        const text = await res.text();
        const match = text.match(/success_jsonpCallback\(([\s\S]*)\)\s*;?$/);
        if (match) {
            try { return JSON.parse(match[1]); } catch { return eval('(' + match[1] + ')'); }
        }
        return null;
    };

    return { oper, baseUrl, plantId: creds.gess_plant_id || 218 };
}

/**
 * Consulta de analítica histórica por Día, Mes o Año
 */
async function getAnalyticsData(companyId, params = {}) {
    const creds = await energySystemService.getCredentials(companyId);
    const isSanMartin = String(companyId) === '1';

    const period = params.period || 'day'; // 'day' | 'month' | 'year'
    const plantFilter = params.plantId || 'all';
    const nowParts = getElSalvadorDateTimeParts();

    const peakRate = parseFloat(creds.peak_kwh_rate) || 0.22;
    const offpeakRate = parseFloat(creds.offpeak_kwh_rate) || 0.14;
    const solarRate = parseFloat(creds.solar_kwh_value) || 0.17;
    const peakStartHour = parseInt(creds.peak_start_time?.split(':')[0] || '18', 10);
    const peakEndHour = parseInt(creds.peak_end_time?.split(':')[0] || '22', 10);

    const hasBatteries = !!(creds.gess_enabled && creds.gess_plant_id);

    // Consulta en paralelo: Growatt (inversores) y GESS (baterías, solo si la localidad tiene BESS)
    const [growattClient, gessStats] = await Promise.all([
        createGrowattClient(creds).catch(err => {
            console.error('[EnergyAnalytics] Error connecting to Growatt:', err.message);
            return null;
        }),
        hasBatteries ? (async () => {
            try {
                const gClient = await createGessClient(creds);
                if (!gClient) return null;
                const targetDate = params.date || nowParts.dateStr;
                const statRes = await gClient.oper('MonitorServlet', `&action=plantStorageStatistic&date=${targetDate}`);
                return statRes?.dat || null;
            } catch (err) {
                console.warn('[EnergyAnalytics] GESS no disponible:', err.message);
                return null;
            }
        })() : Promise.resolve(null)
    ]);

    let availablePlants = growattClient?.plants || [
        { id: '2410077', name: 'Andelsa' },
        { id: '2604519', name: 'Puma San Martín II' }
    ];

    // Si la empresa tiene una planta específica asignada, filtrar las disponibles exclusivamente para ella
    const companyPlantId = creds.growatt_plant_id || (isSanMartin ? '2604519' : '2410077');
    if (companyPlantId && companyPlantId !== 'all') {
        availablePlants = availablePlants.filter(p => String(p.id) === String(companyPlantId));
    }

    const effectivePlantFilter = companyPlantId && companyPlantId !== 'all'
        ? companyPlantId
        : plantFilter;

    // ==========================================
    // MODO DÍA: Curva de 5 minutos (288 intervalos)
    // ==========================================
    if (period === 'day') {
        const targetDate = params.date || nowParts.dateStr;

        // Consultar Growatt para cada planta requerida
        const plantsToQuery = effectivePlantFilter === 'all'
            ? availablePlants
            : availablePlants.filter(p => p.id === String(effectivePlantFilter));

        const plantCurves = [];
        for (const pl of plantsToQuery) {
            let dayPac = [];
            if (growattClient) {
                try {
                    const cRes = await growattClient.post(
                        '/indexbC/inv/getInvEnergyDayChart',
                        { plantId: pl.id, date: targetDate },
                        `selectedPlantId=${pl.id}; b2SelectedPlantId=${pl.id}`
                    );
                    dayPac = cRes?.obj?.pac || [];
                } catch (e) {
                    console.error(`[EnergyAnalytics] Error fetching day chart for ${pl.name}:`, e.message);
                }
            }
            if (dayPac.length === 0) {
                try {
                    const [fbRows] = await pool.query(`
                        SELECT growatt_plants_data 
                        FROM energy_readings 
                        WHERE growatt_plants_data IS NOT NULL AND growatt_plants_data != '[]' AND growatt_today_kwh > 0
                        ORDER BY id DESC LIMIT 1
                    `);
                    if (fbRows.length > 0) {
                        const rawPlants = typeof fbRows[0].growatt_plants_data === 'string'
                            ? JSON.parse(fbRows[0].growatt_plants_data)
                            : (fbRows[0].growatt_plants_data || []);
                        const match = rawPlants.find(p => String(p.id) === String(pl.id));
                        if (match?.dayCurve && Array.isArray(match.dayCurve)) {
                            dayPac = match.dayCurve;
                        }
                    }
                } catch {
                    // Silencioso
                }
            }
            plantCurves.push({
                id: pl.id,
                name: pl.name,
                pac: dayPac
            });
        }

        const peakHoursCount = Math.max(peakEndHour - peakStartHour, 1);
        const batteryDischargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.dayDischarged) || 0) : 0;
        const batteryChargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.dayCharged) || 0) : 0;
        const batteryDischargeKw = (hasBatteries && batteryDischargedKwh > 0)
            ? parseFloat((batteryDischargedKwh / peakHoursCount).toFixed(2))
            : 0;

        // Combinar los 288 intervalos de 5 minutos
        const curvePoints = Array.from({ length: 288 }, (_, i) => {
            const totalMinutes = i * 5;
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const isPeak = h >= peakStartHour && h < peakEndHour;

            let solarKw = 0;
            const plantValues = {};

            for (const pc of plantCurves) {
                const rawVal = pc.pac[i];
                const numVal = (rawVal !== null && rawVal !== undefined)
                    ? (typeof rawVal === 'number' ? rawVal : parseFloat(rawVal))
                    : 0;
                // Growatt entrega pac en Watts (W) -> convertir a kW (kW = W / 1000)
                const kw = numVal > 0 ? numVal / 1000 : 0;
                plantValues[pc.id] = parseFloat(kw.toFixed(2));
                solarKw += kw;
            }

            const activeBatteryKw = isPeak ? batteryDischargeKw : 0;

            return {
                index: i,
                time: timeLabel,
                hour: h,
                minute: m,
                isPeak,
                solarKw: parseFloat(solarKw.toFixed(2)),
                batteryKw: activeBatteryKw,
                kw: parseFloat(solarKw.toFixed(2)), // retrocompatibilidad
                totalKw: parseFloat((solarKw + activeBatteryKw).toFixed(2)),
                plantValues
            };
        });

        // Calcular kWh solar del día (suma de potencias medias por intervalo de 5 min: kW * 5/60)
        const solarGeneratedKwh = parseFloat(
            curvePoints.reduce((sum, pt) => sum + (pt.solarKw * (5 / 60)), 0).toFixed(2)
        );
        const maxSolarPowerKw = parseFloat(
            Math.max(...curvePoints.map(p => p.solarKw), 0).toFixed(2)
        );

        const solarSavingsUsd = parseFloat((solarGeneratedKwh * solarRate).toFixed(2));
        const peakSavingsUsd = hasBatteries ? parseFloat((batteryDischargedKwh * (peakRate - offpeakRate)).toFixed(2)) : 0;
        const totalSavingsUsd = parseFloat((solarSavingsUsd + peakSavingsUsd).toFixed(2));

        return {
            period: 'day',
            date: targetDate,
            plantId: effectivePlantFilter,
            hasBatteries,
            availablePlants,
            curvePoints,
            summary: {
                hasBatteries,
                solarGeneratedKwh,
                maxSolarPowerKw,
                batteryChargedKwh,
                batteryDischargedKwh,
                batteryDischargeKw,
                socPct: hasBatteries && gessStats ? (parseFloat(gessStats.soc) || 0) : 0,
                nominalCapacityKwh: hasBatteries ? 513.6 : 0,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd,
                solarRate,
                peakRate,
                offpeakRate,
                peakStartTime: creds.peak_start_time?.slice(0, 5) || '18:00',
                peakEndTime: creds.peak_end_time?.slice(0, 5) || '22:00'
            }
        };
    }

    // ==========================================
    // MODO MES: Generación día a día (1..N)
    // ==========================================
    if (period === 'month') {
        const targetMonth = params.month || nowParts.monthStr; // 'YYYY-MM'
        const [yearNum, monthNum] = targetMonth.split('-').map(Number);
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

        const plantsToQuery = effectivePlantFilter === 'all'
            ? availablePlants
            : availablePlants.filter(p => p.id === String(effectivePlantFilter));

        const plantMonthData = [];
        for (const pl of plantsToQuery) {
            let energyArray = [];
            if (growattClient) {
                try {
                    const mRes = await growattClient.post(
                        '/indexbC/inv/getInvEnergyMonthChart',
                        { plantId: pl.id, date: targetMonth },
                        `selectedPlantId=${pl.id}; b2SelectedPlantId=${pl.id}`
                    );
                    energyArray = mRes?.obj?.energy || [];
                } catch (e) {
                    console.error(`[EnergyAnalytics] Error fetching month chart for ${pl.name}:`, e.message);
                }
            }
            plantMonthData.push({
                id: pl.id,
                name: pl.name,
                energy: energyArray
            });
        }

        const monthChargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.monthCharged) || 0) : 0;
        const monthDischargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.monthDischarged) || 0) : 0;
        const avgDailyBatteryKwh = (hasBatteries && daysInMonth > 0)
            ? parseFloat((monthDischargedKwh / daysInMonth).toFixed(1))
            : 0;

        const dailyPoints = [];
        let totalSolarKwh = 0;
        let maxDayKwh = 0;
        let bestDay = null;

        for (let d = 1; d <= daysInMonth; d++) {
            const idx = d - 1;
            const dayDate = `${targetMonth}-${String(d).padStart(2, '0')}`;
            let dayTotalKw = 0;
            const plantValues = {};

            for (const pm of plantMonthData) {
                const val = pm.energy[idx];
                const numVal = (val !== null && val !== undefined) ? (typeof val === 'number' ? val : parseFloat(val)) : 0;
                plantValues[pm.id] = parseFloat(numVal.toFixed(2));
                dayTotalKw += numVal;
            }

            const dayKwh = parseFloat(dayTotalKw.toFixed(2));
            totalSolarKwh += dayKwh;
            if (dayKwh > maxDayKwh) {
                maxDayKwh = dayKwh;
                bestDay = { day: d, date: dayDate, kwh: dayKwh };
            }

            const daySavings = parseFloat((dayKwh * solarRate).toFixed(2));

            dailyPoints.push({
                day: d,
                date: dayDate,
                solarKwh: dayKwh,
                batteryKwh: avgDailyBatteryKwh,
                totalKwh: parseFloat((dayKwh + avgDailyBatteryKwh).toFixed(2)),
                savingsUsd: daySavings,
                plantValues
            });
        }

        if (totalSolarKwh === 0) {
            try {
                const [summaryRows] = await pool.query(`
                    SELECT summary_date, solar_generated_kwh, battery_discharged_kwh, battery_charged_kwh
                    FROM energy_daily_summaries
                    WHERE company_id = ? AND summary_date LIKE ?
                `, [companyId, `${targetMonth}%`]);
                if (summaryRows.length > 0) {
                    summaryRows.forEach(sr => {
                        const dateStr = typeof sr.summary_date === 'string'
                            ? sr.summary_date.slice(0, 10)
                            : new Date(sr.summary_date).toISOString().slice(0, 10);
                        const dNum = parseInt(dateStr.split('-')[2], 10);
                        const pt = dailyPoints.find(p => p.day === dNum);
                        if (pt) {
                            pt.solarKwh = parseFloat(sr.solar_generated_kwh) || 0;
                            pt.totalKwh = parseFloat((pt.solarKwh + pt.batteryKwh).toFixed(2));
                            pt.savingsUsd = parseFloat((pt.solarKwh * solarRate).toFixed(2));
                            if (effectivePlantFilter !== 'all') {
                                pt.plantValues[effectivePlantFilter] = pt.solarKwh;
                            }
                        }
                    });
                    totalSolarKwh = parseFloat(dailyPoints.reduce((sum, p) => sum + p.solarKwh, 0).toFixed(2));
                    maxDayKwh = Math.max(...dailyPoints.map(p => p.solarKwh), 0);
                    const bDay = dailyPoints.find(p => p.solarKwh === maxDayKwh);
                    if (bDay) bestDay = { day: bDay.day, date: bDay.date, kwh: bDay.solarKwh };
                }
            } catch {
                // Silencioso
            }
        }

        totalSolarKwh = parseFloat(totalSolarKwh.toFixed(2));
        const activeDays = dailyPoints.filter(p => p.solarKwh > 0).length || 1;
        const avgDailySolarKwh = parseFloat((totalSolarKwh / activeDays).toFixed(2));
        const solarSavingsUsd = parseFloat((totalSolarKwh * solarRate).toFixed(2));
        const peakSavingsUsd = hasBatteries ? parseFloat((monthDischargedKwh * (peakRate - offpeakRate)).toFixed(2)) : 0;
        const totalSavingsUsd = parseFloat((solarSavingsUsd + peakSavingsUsd).toFixed(2));

        return {
            period: 'month',
            month: targetMonth,
            daysInMonth,
            plantId: effectivePlantFilter,
            hasBatteries,
            availablePlants,
            dailyPoints,
            summary: {
                hasBatteries,
                totalSolarKwh,
                totalSolarMwh: parseFloat((totalSolarKwh / 1000).toFixed(2)),
                totalBatteryKwh: monthDischargedKwh,
                totalBatteryMwh: parseFloat((monthDischargedKwh / 1000).toFixed(2)),
                monthChargedKwh,
                monthDischargedKwh,
                avgDailySolarKwh,
                avgDailyBatteryKwh,
                maxDailySolarKwh: maxDayKwh,
                bestDay,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd,
                solarRate
            }
        };
    }

    // ==========================================
    // MODO AÑO: Generación mes a mes (Ene..Dic)
    // ==========================================
    if (period === 'year') {
        const targetYear = params.year || nowParts.yearStr; // 'YYYY'
        const plantsToQuery = effectivePlantFilter === 'all'
            ? availablePlants
            : availablePlants.filter(p => p.id === String(effectivePlantFilter));

        const plantYearData = [];
        for (const pl of plantsToQuery) {
            let yearArray = [];
            if (growattClient) {
                try {
                    const yRes = await growattClient.post(
                        '/indexbC/getYearEnergyChart',
                        { plantId: pl.id, year: targetYear, date: targetYear },
                        `selectedPlantId=${pl.id}; b2SelectedPlantId=${pl.id}`
                    );
                    yearArray = yRes?.obj?.charts?.['0'] || [];
                } catch (e) {
                    console.error(`[EnergyAnalytics] Error fetching year chart for ${pl.name}:`, e.message);
                }
            }
            plantYearData.push({
                id: pl.id,
                name: pl.name,
                energy: yearArray
            });
        }

        const yearChargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.yearCharged) || 0) : 0;
        const yearDischargedKwh = hasBatteries && gessStats ? (parseFloat(gessStats.yearDischarged) || 0) : 0;
        const avgMonthlyBatteryKwh = hasBatteries ? parseFloat((yearDischargedKwh / 12).toFixed(1)) : 0;

        const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const monthlyPoints = [];
        let totalSolarKwh = 0;
        let maxMonthKwh = 0;
        let bestMonth = null;

        for (let m = 0; m < 12; m++) {
            const monthCode = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
            let monthTotalKw = 0;
            const plantValues = {};

            for (const py of plantYearData) {
                const val = py.energy[m];
                const numVal = (val !== null && val !== undefined) ? (typeof val === 'number' ? val : parseFloat(val)) : 0;
                plantValues[py.id] = parseFloat(numVal.toFixed(2));
                monthTotalKw += numVal;
            }

            const monthKwh = parseFloat(monthTotalKw.toFixed(2));
            totalSolarKwh += monthKwh;

            if (monthKwh > maxMonthKwh) {
                maxMonthKwh = monthKwh;
                bestMonth = { month: m + 1, name: monthsNames[m], kwh: monthKwh };
            }

            monthlyPoints.push({
                month: m + 1,
                name: monthsNames[m],
                shortName: monthsShort[m],
                monthCode,
                solarKwh: monthKwh,
                solarMwh: parseFloat((monthKwh / 1000).toFixed(2)),
                batteryKwh: avgMonthlyBatteryKwh,
                batteryMwh: parseFloat((avgMonthlyBatteryKwh / 1000).toFixed(2)),
                totalKwh: parseFloat((monthKwh + avgMonthlyBatteryKwh).toFixed(2)),
                savingsUsd: parseFloat((monthKwh * solarRate).toFixed(2)),
                plantValues
            });
        }

        if (totalSolarKwh === 0) {
            try {
                const [yearSummaryRows] = await pool.query(`
                    SELECT MONTH(summary_date) as m, SUM(solar_generated_kwh) as solar_kwh
                    FROM energy_daily_summaries
                    WHERE company_id = ? AND YEAR(summary_date) = ?
                    GROUP BY MONTH(summary_date)
                `, [companyId, parseInt(targetYear, 10)]);
                if (yearSummaryRows.length > 0) {
                    yearSummaryRows.forEach(yr => {
                        const mIdx = yr.m - 1;
                        if (monthlyPoints[mIdx]) {
                            const kwh = parseFloat(yr.solar_kwh) || 0;
                            monthlyPoints[mIdx].solarKwh = kwh;
                            monthlyPoints[mIdx].solarMwh = parseFloat((kwh / 1000).toFixed(2));
                            monthlyPoints[mIdx].totalKwh = parseFloat((kwh + monthlyPoints[mIdx].batteryKwh).toFixed(2));
                            monthlyPoints[mIdx].savingsUsd = parseFloat((kwh * solarRate).toFixed(2));
                            if (effectivePlantFilter !== 'all') {
                                monthlyPoints[mIdx].plantValues[effectivePlantFilter] = kwh;
                            }
                        }
                    });
                    totalSolarKwh = parseFloat(monthlyPoints.reduce((sum, p) => sum + p.solarKwh, 0).toFixed(2));
                    maxMonthKwh = Math.max(...monthlyPoints.map(p => p.solarKwh), 0);
                    const bMonth = monthlyPoints.find(p => p.solarKwh === maxMonthKwh);
                    if (bMonth) bestMonth = { month: bMonth.month, name: bMonth.name, kwh: bMonth.solarKwh };
                }
            } catch {
                // Silencioso
            }
        }

        totalSolarKwh = parseFloat(totalSolarKwh.toFixed(2));
        const activeMonths = monthlyPoints.filter(p => p.solarKwh > 0).length || 1;
        const avgMonthlySolarKwh = parseFloat((totalSolarKwh / activeMonths).toFixed(2));
        const solarSavingsUsd = parseFloat((totalSolarKwh * solarRate).toFixed(2));
        const peakSavingsUsd = hasBatteries ? parseFloat((yearDischargedKwh * (peakRate - offpeakRate)).toFixed(2)) : 0;
        const totalSavingsUsd = parseFloat((solarSavingsUsd + peakSavingsUsd).toFixed(2));

        return {
            period: 'year',
            year: targetYear,
            plantId: effectivePlantFilter,
            hasBatteries,
            availablePlants,
            monthlyPoints,
            summary: {
                hasBatteries,
                totalSolarKwh,
                totalSolarMwh: parseFloat((totalSolarKwh / 1000).toFixed(2)),
                totalBatteryKwh: yearDischargedKwh,
                totalBatteryMwh: parseFloat((yearDischargedKwh / 1000).toFixed(2)),
                yearChargedKwh,
                yearDischargedKwh,
                avgMonthlySolarKwh,
                avgMonthlyBatteryKwh,
                maxMonthlySolarKwh: maxMonthKwh,
                bestMonth,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd,
                solarRate
            }
        };
    }

    throw new Error(`Período '${period}' no soportado. Use 'day', 'month' o 'year'.`);
}

module.exports = {
    getAnalyticsData,
    createGrowattClient,
    createGessClient
};
