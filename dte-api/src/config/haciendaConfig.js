/**
 * Hacienda Configuration Module
 * Per-company endpoint selection based on ambiente field
 */

require('dotenv').config();

/**
 * Normalizes ambiente across all formats:
 *   'produccion', '01', '2', 2 → production
 *   'test', '00', '1', 1        → test
 */
function isProduction(ambiente) {
    return ambiente === 'produccion' || ambiente === '01' || String(ambiente) === '2';
}

function getMHAmbiente(ambiente) {
    return isProduction(ambiente) ? '01' : '00';
}

let simulatedOutage = false;

async function initHaciendaConfig() {
    try {
        const pool = require('./db');
        const [rows] = await pool.query('SELECT flag_value FROM system_runtime_flags WHERE flag_key = "simulated_outage" LIMIT 1');
        if (rows.length > 0) {
            simulatedOutage = rows[0].flag_value === 'true' || rows[0].flag_value === '1';
            console.log(`[HaciendaConfig] Estado de simulación recuperado de BD: ${simulatedOutage ? 'ACTIVADA' : 'DESACTIVADA'}`);
        }
    } catch (_) {}
}

// Sincronización inicial
initHaciendaConfig();

async function setSimulatedOutage(enabled) {
    simulatedOutage = Boolean(enabled);
    try {
        const pool = require('./db');
        await pool.query(
            'INSERT INTO system_runtime_flags (flag_key, flag_value) VALUES ("simulated_outage", ?) ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value)',
            [simulatedOutage ? 'true' : 'false']
        );
    } catch (err) {
        console.warn('[HaciendaConfig] Error guardando flag en BD:', err.message);
    }
    try {
        const cache = require('./cache');
        cache.set('simulated_outage', simulatedOutage);
    } catch (_) {}
    console.log(`[HaciendaConfig] Simulación de corte con Hacienda: ${simulatedOutage ? 'ACTIVADA' : 'DESACTIVADA'}`);
}

function isSimulatedOutage() {
    return simulatedOutage;
}

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const OFFICIAL_MH_ENDPOINTS = {
    test: {
        auth: 'https://apitest.dtes.mh.gob.sv/seguridad/auth',
        recepcion: 'https://apitest.dtes.mh.gob.sv/fesv/recepciondte',
        consult: 'https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte/',
        invalidacion: 'https://apitest.dtes.mh.gob.sv/fesv/anulardte',
        contingencia: 'https://apitest.dtes.mh.gob.sv/fesv/contingencia'
    },
    prod: {
        auth: 'https://api.dtes.mh.gob.sv/seguridad/auth',
        recepcion: 'https://api.dtes.mh.gob.sv/fesv/recepciondte',
        consult: 'https://api.dtes.mh.gob.sv/fesv/recepcion/consultadte/',
        invalidacion: 'https://api.dtes.mh.gob.sv/fesv/anulardte',
        contingencia: 'https://api.dtes.mh.gob.sv/fesv/contingencia'
    }
};

/**
 * Gets a Hacienda endpoint based on the company's ambiente
 * @param {string} key Type of endpoint (auth, recepcion, consult, invalidacion, contingencia)
 * @param {string} ambiente Company's ambiente
 * @returns {string} The configured URL
 */
function getEndpoint(key, ambiente) {
    if (isSimulatedOutage() && (key === 'recepcion' || key === 'auth')) {
        // Devuelve una URL inaccesible con puerto muerto para forzar error de conectividad / red inmediata (ECONNREFUSED / timeout)
        return 'http://127.0.0.1:59999/fesv/' + key;
    }

    const prod = isProduction(ambiente);
    const suffix = prod ? '_PROD' : '_TEST';
    const envVarName = `HACIENDA_${key.toUpperCase()}_URL${suffix}`;
    const envUrl = process.env[envVarName];

    if (envUrl) {
        return envUrl;
    }

    const fallbackEnv = prod ? 'prod' : 'test';
    const fallbackUrl = OFFICIAL_MH_ENDPOINTS[fallbackEnv]?.[key.toLowerCase()];
    if (fallbackUrl) {
        return fallbackUrl;
    }

    throw new Error(`Endpoint de Hacienda no configurado: ${envVarName}. Verifique su archivo .env`);
}

module.exports = { getEndpoint, isProduction, getMHAmbiente, setSimulatedOutage, isSimulatedOutage, initHaciendaConfig };
