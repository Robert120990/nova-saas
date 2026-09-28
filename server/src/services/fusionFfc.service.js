const https = require('https');
const pool = require('../config/db');
const fusionAgent = require('./fusionAgent.service');

let cachedToken = null;
let tokenExpiresAt = 0;

function isPrivateHost(hostStr) {
    if (!hostStr) return false;
    return /^(https?:\/\/)?(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.)/i.test(hostStr);
}

function ffcRequest(urlStr, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlStr);
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
                rejectUnauthorized: false,
                timeout: options.timeout || 10000
            };

            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed = data;
                    try { parsed = JSON.parse(data); } catch { /* ignore */ }
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
                    } else {
                        const err = new Error(parsed?.message || `Fusion status ${res.statusCode}`);
                        err.status = res.statusCode;
                        err.data = parsed;
                        reject(err);
                    }
                });
            });

            req.on('error', (err) => {
                const isConn = ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND'].includes(err.code);
                let msg;
                if (isConn) {
                    if (isPrivateHost(url.hostname)) {
                        msg = `No se pudo conectar a la IP privada de Fusion (${url.hostname}) desde este servidor. Inicie el Conector Local de Estación en la gasolinera.`;
                    } else {
                        msg = `No se pudo conectar con Fusion (${url.hostname}). Verifique la red local.`;
                    }
                } else {
                    msg = `Error de red con Fusion: ${err.message}`;
                }
                const error = new Error(msg);
                error.originalError = err;
                reject(error);
            });
            req.on('timeout', () => {
                const hint = isPrivateHost(url.hostname) ? ' Asegúrese de tener activo el Conector Local de Estación.' : '';
                req.destroy(new Error(`Tiempo agotado conectando con Fusion (${url.hostname}).${hint}`));
            });
            if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

function sanitizeHost(raw) {
    if (!raw) return 'https://10.19.4.15';
    let h = raw.trim();
    if (!h.startsWith('http://') && !h.startsWith('https://')) h = `https://${h}`;
    try {
        const u = new URL(h);
        return `${u.protocol}//${u.host}`;
    } catch {
        return h;
    }
}

async function getFusionConfig(companyId, branchId) {
    let host = process.env.FUSION_HOST || 'https://10.19.4.15';
    let username = process.env.FUSION_USER || 'MANAGER';
    let password = process.env.FUSION_PASSWORD || 'MANAGER';

    if (companyId) {
        try {
            const [rows] = await pool.query(
                `SELECT setting_key, setting_value FROM gas_station_settings 
                 WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL) 
                   AND setting_key IN ('fusion_host', 'fusion_user', 'fusion_password')`,
                [companyId, branchId || 0]
            );
            for (const r of rows) {
                if (r.setting_key === 'fusion_host' && r.setting_value) host = r.setting_value.trim();
                if (r.setting_key === 'fusion_user' && r.setting_value) username = r.setting_value.trim();
                if (r.setting_key === 'fusion_password' && r.setting_value) password = r.setting_value.trim();
            }
        } catch (err) {
            console.warn('[Fusion] Advertencia leyendo gas_station_settings:', err.message);
        }
    }
    host = sanitizeHost(host);
    return { host, username, password };
}

async function getFusionToken(config, forceNew = false) {
    const now = Date.now();
    if (!forceNew && cachedToken && tokenExpiresAt > now + 60000) return cachedToken;

    const host = sanitizeHost(config.host);
    const uName = (config.username || '').trim();
    const pwd = (config.password || '').trim();

    try {
        const loginRes = await ffcRequest(`${host}/fusion/login`, { method: 'POST' }, {
            userName: uName,
            password: pwd
        });
        const token = loginRes.data?.accessToken;
        if (!token) throw new Error('Autenticación en Fusion no devolvió accessToken');
        cachedToken = token;
        tokenExpiresAt = now + (15 * 60 * 1000);
        return token;
    } catch (err) {
        // Si falló por 401 y el usuario tenía minúsculas, reintentar automáticamente con MAYÚSCULAS
        if ((err.status === 401 || err.status === 403) && uName !== uName.toUpperCase()) {
            try {
                const retryRes = await ffcRequest(`${host}/fusion/login`, { method: 'POST' }, {
                    userName: uName.toUpperCase(),
                    password: pwd
                });
                const token = retryRes.data?.accessToken;
                if (token) {
                    cachedToken = token;
                    tokenExpiresAt = now + (15 * 60 * 1000);
                    return token;
                }
            } catch {
                // conservar error original
            }
        }
        throw err;
    }
}

async function ffcAuthedRequest(endpoint, config, method = 'GET', body = null) {
    const host = sanitizeHost(config.host);
    let token = await getFusionToken(config);
    try {
        return await ffcRequest(`${host}${endpoint}`, { method, headers: { Authorization: token } }, body);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            token = await getFusionToken(config, true);
            return await ffcRequest(`${host}${endpoint}`, { method, headers: { Authorization: token } }, body);
        }
        throw err;
    }
}

const fmtD = (d) => (!d || d.length !== 8 ? '' : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
const fmtT = (t) => (!t || t.length !== 6 ? '' : `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`);
const fmtDT = (d, t) => {
    if (!d || d.length !== 8) return '';
    const time = t && t.length === 6 ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : '00:00:00';
    return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${time}`;
};

async function getShiftPeriods(config, companyId = null, branchId = null) {
    if (companyId && branchId && fusionAgent.isAgentConnected(companyId, branchId)) {
        console.log(`[Fusion] Consultando turnos a través del Conector Local (Empresa #${companyId}, Estación #${branchId})`);
        return await fusionAgent.callAgent(companyId, branchId, 'getShiftPeriods', { config });
    }
    const res = await ffcAuthedRequest('/fusion/period/list/shift', config);
    const rawList = res.data?.list || res.data || [];
    const periods = rawList.map(p => {
        const isClosed = Boolean(p.endDate && p.endDate.trim() && p.endTime && p.endTime.trim());
        return {
            id: p.id,
            parentId: p.parentId,
            periodType: p.periodType || 'Shift',
            startDate: p.startDate,
            startTime: p.startTime,
            endDate: p.endDate || null,
            endTime: p.endTime || null,
            isClosed,
            estado: isClosed ? 'cerrado' : 'abierto',
            startFormatted: fmtDT(p.startDate, p.startTime),
            endFormatted: isClosed ? fmtDT(p.endDate, p.endTime) : 'En curso',
            transationStart: p.transationStart,
            transationEnd: p.transationEnd,
            transationCount: p.transationCount || 0
        };
    });
    periods.sort((a, b) => b.id - a.id);
    return periods;
}

async function getPeriodTotalizers(periodId, config, companyId = null, branchId = null) {
    if (companyId && branchId && fusionAgent.isAgentConnected(companyId, branchId)) {
        console.log(`[Fusion] Consultando totalizadores del turno #${periodId} a través del Conector Local (Empresa #${companyId}, Estación #${branchId})`);
        return await fusionAgent.callAgent(companyId, branchId, 'getPeriodTotalizers', { periodId, config });
    }
    const infoRes = await ffcAuthedRequest(`/fusion/period/info/shift/${periodId}`, config);
    const info = infoRes.data;
    if (!info) throw new Error(`No se encontró información para el turno ${periodId} en Fusion.`);

    let dateStart = fmtD(info.startDate);
    let timeStart = fmtT(info.startTime);
    let dateEnd = fmtD(info.endDate);
    let timeEnd = fmtT(info.endTime);

    if (!dateEnd || !timeEnd) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        dateEnd = `${y}-${m}-${d}`;
        timeEnd = `${hh}:${mm}:${ss}`;
    }

    const payload = {
        dateStart, timeStart, dateEnd, timeEnd,
        genericNumber1: Number(periodId),
        genericNumber2: info.transationStart || 0,
        genericNumber3: info.transationEnd || info.transationStart || 0,
        genericString1: 'S'
    };

    // 1. Obtener Totalizadores de Pistolas (Others)
    const totRes = await ffcAuthedRequest('/fusion/data/periodOthersTotalizer', config, 'POST', payload);
    const rawRows = totRes.data?.data || [];
    const totalizers = rawRows.map((r, index) => {
        const obj = {};
        for (const col of (r.row || [])) obj[col.name] = col.value;
        return {
            index,
            pumpId: Number(obj.pumpId),
            hoseId: Number(obj.hoseId),
            gradeId: Number(obj.gradeId),
            initialVolume: parseFloat(obj.initialVolume) || 0,
            finalVolume: parseFloat(obj.finalVolume) || 0,
            turnAround: parseFloat(obj.turnAround) || 0
        };
    });

    // 2. Obtener Ventas de Bombas de la Pestaña "Sales" (Pump Sales)
    let pumpSales = { totalMoney: 0, totalVolume: 0, grades: [] };
    try {
        const salesRes = await ffcAuthedRequest('/fusion/data/periodSalesByProductPumpSale', config, 'POST', payload);
        const salesRows = salesRes.data?.data || [];
        let sumMoney = 0;
        let sumVolume = 0;
        const grades = salesRows.map(r => {
            const obj = {};
            for (const col of (r.row || [])) obj[col.name] = col.value;
            const volume = parseFloat(obj.totalVolume) || 0;
            const money = parseFloat(obj.totalMoney) || 0;
            sumMoney += money;
            sumVolume += volume;
            return {
                grade: obj.gradeId || '',
                volume: Number(volume.toFixed(3)),
                amount: Number(money.toFixed(2))
            };
        });
        pumpSales = {
            totalMoney: Number(sumMoney.toFixed(2)),
            totalVolume: Number(sumVolume.toFixed(3)),
            grades
        };
    } catch (e) {
        console.warn('[Fusion] Advertencia obteniendo periodSalesByProductPumpSale:', e.message);
    }

    return {
        periodInfo: {
            id: Number(periodId),
            startDate: info.startDate,
            startTime: info.startTime,
            endDate: info.endDate,
            endTime: info.endTime,
            isClosed: Boolean(info.endDate && info.endTime),
            startFormatted: fmtDT(info.startDate, info.startTime),
            endFormatted: info.endDate ? fmtDT(info.endDate, info.endTime) : 'En curso',
            transationCount: info.transationCount || 0
        },
        totalizers,
        pumpSales
    };
}

async function testConnection(config, companyId = null, branchId = null) {
    if (companyId && branchId && fusionAgent.isAgentConnected(companyId, branchId)) {
        const res = await fusionAgent.callAgent(companyId, branchId, 'testConnection', { config });
        return { ...res, via: 'agent' };
    }
    const token = await getFusionToken(config, true);
    return { success: true, host: config.host, token: token ? 'OK' : 'FAIL', via: 'direct' };
}

module.exports = {
    getFusionConfig,
    getShiftPeriods,
    getPeriodTotalizers,
    testConnection
};
