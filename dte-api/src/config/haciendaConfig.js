/**
 * Hacienda Configuration Module
 */

require('dotenv').config();

const env = process.env.HACIENDA_ENV || 'test';
const isProd = env === 'production';

/**
 * Gets a Hacienda endpoint based on current environment
 * @param {string} key Type of endpoint (auth, reception, consult, invalidation, contingency)
 * @returns {string} The configured URL
 */
function getEndpoint(key) {
    const suffix = isProd ? '_PROD' : '_TEST';
    const envVarName = `HACIENDA_${key.toUpperCase()}_URL${suffix}`;
    const url = process.env[envVarName];

    if (!url) {
        throw new Error(`Endpoint de Hacienda no configurado: ${envVarName}. Verifique su archivo .env`);
    }

    return url;
}

const config = {
    env,
    isProd,
    endpoints: {
        auth: getEndpoint('auth'),
        reception: getEndpoint('recepcion'),
        consult: getEndpoint('consult'),
        invalidation: getEndpoint('invalidacion'),
        contingency: getEndpoint('contingencia')
    }
};

module.exports = config;
