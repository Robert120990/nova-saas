/**
 * Hacienda Configuration Module
 * Per-company endpoint selection based on ambiente field
 */

require('dotenv').config();

/**
 * Gets a Hacienda endpoint based on the company's ambiente
 * @param {string} key Type of endpoint (auth, reception, consult, invalidation, contingency)
 * @param {string} ambiente Company's ambiente ('test' | 'produccion')
 * @returns {string} The configured URL
 */
function getEndpoint(key, ambiente) {
    const isProd = ambiente === 'produccion';
    const suffix = isProd ? '_PROD' : '_TEST';
    const envVarName = `HACIENDA_${key.toUpperCase()}_URL${suffix}`;
    const url = process.env[envVarName];

    if (!url) {
        throw new Error(`Endpoint de Hacienda no configurado: ${envVarName}. Verifique su archivo .env`);
    }

    return url;
}

module.exports = { getEndpoint };
