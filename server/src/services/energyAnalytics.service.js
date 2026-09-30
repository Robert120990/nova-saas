const crypto = require('crypto');
const pool = require('../config/db');
const { decrypt } = require('../utils/crypto');
const energySystemService = require('./energySystem.service');

function safeDecrypt(val) {
    if (!val || typeof val !== 'string') return '';
    const parts = val.split(':');
    if (parts.length === 3) {
        const dec = decrypt(val);
        return dec || val;
    }
    return val;
}

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

    const user = creds.growatt_username;
    const pass = creds.growatt_password_decrypted || safeDecrypt(creds.growatt_password);
    const pwdMd5 = crypto.createHash('md5').update(pass).digest('hex');
    const baseUrl = creds.growatt_url.replace(/\/+$/, '');

    const form = new URLSearchParams();
    form.append('account', user);
    form.append('passwordCrc', pwdMd5);
    form.append('password', '');
    form.append('validateCode', '');
    form.append('isReadPact', '0');

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
        throw new Error('Credenciales inválidas en Growatt');
    }

    const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

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

    // Obtener lista de plantas
    const listRes = await post('/selectPlant/getPlantList', {
        currPage: '1',
        plantType: '-1',
        orderType: '2',
        plantName: ''
    });

    const plants = (listRes?.datas || []).map(p => ({
        id: String(p.id),
        name: p.plantName,
        nominalPower: parseFloat(p.nominalPower) || 0
    }));

    return { post, plants, baseUrl };
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

    const loginRes = await fetch(`${baseUrl}UserServlet?action=login&account=${account}&passwd=${pwdSha1}`);
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
            }
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

    const [growattClient, gessClient] = await Promise.all([
        createGrowattClient(creds).catch(err => {
            console.error('[EnergyAnalytics] Error connecting to Growatt:', err.message);
            return null;
        }),
        hasBatteries ? createGessClient(creds).catch(err => {
            console.error('[EnergyAnalytics] Error connecting to GESS:', err.message);
            return null;
        }) : Promise.resolve(null)
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
            plantCurves.push({
                id: pl.id,
                name: pl.name,
                pac: dayPac
            });
        }

        // Combinar los 288 intervalos de 5 minutos
        const curvePoints = Array.from({ length: 288 }, (_, i) => {
            const totalMinutes = i * 5;
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const isPeak = h >= peakStartHour && h < peakEndHour;

            let totalKw = 0;
            const plantValues = {};

            for (const pc of plantCurves) {
                const rawVal = pc.pac[i];
                const numVal = (rawVal !== null && rawVal !== undefined)
                    ? (typeof rawVal === 'number' ? rawVal : parseFloat(rawVal))
                    : 0;
                // Convertir W a kW si viene en W (> 500)
                const kw = numVal > 1000 ? numVal / 1000 : (numVal > 0 ? numVal : 0);
                plantValues[pc.id] = parseFloat(kw.toFixed(2));
                totalKw += kw;
            }

            return {
                index: i,
                time: timeLabel,
                hour: h,
                minute: m,
                isPeak,
                kw: parseFloat(totalKw.toFixed(2)),
                plantValues
            };
        });

        // Consultar estadísticas de batería GESS para ese día (solo si la localidad tiene baterías)
        let gessDayStats = null;
        if (hasBatteries && gessClient) {
            try {
                const statRes = await gessClient.oper('MonitorServlet', `&action=plantStorageStatistic&date=${targetDate}`);
                if (statRes?.dat) {
                    gessDayStats = statRes.dat;
                }
            } catch (e) {
                console.error('[EnergyAnalytics] Error fetching GESS day stats:', e.message);
            }
        }

        // Calcular kWh solar del día (suma de potencias medias por intervalo de 5 min: kW * 5/60)
        const solarGeneratedKwh = parseFloat(
            curvePoints.reduce((sum, pt) => sum + (pt.kw * (5 / 60)), 0).toFixed(2)
        );
        const maxSolarPowerKw = parseFloat(
            Math.max(...curvePoints.map(p => p.kw), 0).toFixed(2)
        );

        const batteryChargedKwh = (hasBatteries && gessDayStats) ? (parseFloat(gessDayStats.dayCharged) || 0) : 0;
        const batteryDischargedKwh = (hasBatteries && gessDayStats) ? (parseFloat(gessDayStats.dayDischarged) || 0) : 0;
        const socPct = (hasBatteries && gessDayStats) ? (parseFloat(gessDayStats.soc) || 0) : 0;

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
                socPct,
                nominalCapacityKwh: hasBatteries ? 513.6 : 0,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd,
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

        // Consultar estadísticas de batería GESS para ese mes (solo si tiene baterías)
        let gessMonthStats = null;
        if (hasBatteries && gessClient) {
            try {
                // Último día del mes o fecha de hoy si es el mes actual
                const queryDate = targetMonth === nowParts.monthStr
                    ? nowParts.dateStr
                    : `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;
                const statRes = await gessClient.oper('MonitorServlet', `&action=plantStorageStatistic&date=${queryDate}`);
                if (statRes?.dat) {
                    gessMonthStats = statRes.dat;
                }
            } catch (e) {
                console.error('[EnergyAnalytics] Error fetching GESS month stats:', e.message);
            }
        }

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
                savingsUsd: daySavings,
                plantValues
            });
        }

        totalSolarKwh = parseFloat(totalSolarKwh.toFixed(2));
        const activeDays = dailyPoints.filter(p => p.solarKwh > 0).length || 1;
        const avgDailySolarKwh = parseFloat((totalSolarKwh / activeDays).toFixed(2));

        const monthChargedKwh = (hasBatteries && gessMonthStats) ? (parseFloat(gessMonthStats.monthCharged) || 0) : 0;
        const monthDischargedKwh = (hasBatteries && gessMonthStats) ? (parseFloat(gessMonthStats.monthDischarged) || 0) : 0;

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
                monthChargedKwh,
                monthDischargedKwh,
                avgDailySolarKwh,
                maxDailySolarKwh: maxDayKwh,
                bestDay,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd
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

        // Consultar estadísticas anuales en GESS (solo si tiene baterías)
        let gessYearStats = null;
        if (hasBatteries && gessClient) {
            try {
                const queryDate = targetYear === nowParts.yearStr ? nowParts.dateStr : `${targetYear}-12-31`;
                const statRes = await gessClient.oper('MonitorServlet', `&action=plantStorageStatistic&date=${queryDate}`);
                if (statRes?.dat) {
                    gessYearStats = statRes.dat;
                }
            } catch (e) {
                console.error('[EnergyAnalytics] Error fetching GESS year stats:', e.message);
            }
        }

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
                savingsUsd: parseFloat((monthKwh * solarRate).toFixed(2)),
                plantValues
            });
        }

        totalSolarKwh = parseFloat(totalSolarKwh.toFixed(2));
        const activeMonths = monthlyPoints.filter(p => p.solarKwh > 0).length || 1;
        const avgMonthlySolarKwh = parseFloat((totalSolarKwh / activeMonths).toFixed(2));

        const yearChargedKwh = (hasBatteries && gessYearStats) ? (parseFloat(gessYearStats.yearCharged) || 0) : 0;
        const yearDischargedKwh = (hasBatteries && gessYearStats) ? (parseFloat(gessYearStats.yearDischarged) || 0) : 0;

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
                yearChargedKwh,
                yearDischargedKwh,
                avgMonthlySolarKwh,
                maxMonthlySolarKwh: maxMonthKwh,
                bestMonth,
                solarSavingsUsd,
                peakSavingsUsd,
                totalSavingsUsd
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
