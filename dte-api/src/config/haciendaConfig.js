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

/**
 * Gets a Hacienda endpoint based on the company's ambiente
 * @param {string} key Type of endpoint (auth, reception, consult, invalidation, contingency)
 * @param {string} ambiente Company's ambiente
 * @returns {string} The configured URL
 */
function getEndpoint(key, ambiente) {
    const prod = isProduction(ambiente);
    const suffix = prod ? '_PROD' : '_TEST';
    const envVarName = `HACIENDA_${key.toUpperCase()}_URL${suffix}`;
    const url = process.env[envVarName];

    console.log(`[HaciendaConfig-DEBUG] getEndpoint(${key}, "${ambiente}") → isProd=${prod} → ${url}`);

    if (!url) {
        throw new Error(`Endpoint de Hacienda no configurado: ${envVarName}. Verifique su archivo .env`);
    }

    return url;
}

module.exports = { getEndpoint, isProduction, getMHAmbiente };
