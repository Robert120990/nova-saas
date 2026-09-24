/**
 * Hacienda Transmission Service
 */

const axios = require('axios');
const qs = require('querystring');
const { getEndpoint } = require('../config/haciendaConfig');
const cache = require('../config/cache');

/**
 * Autentica contra la API de Hacienda o devuelve el token en caché si sigue vigente.
 * El token oficial de Hacienda tiene vigencia de 24 horas; se reutiliza durante 23.5 horas.
 */
async function authenticate(apiUser, apiPassword, ambiente, forceRefresh = false) {
    const cacheKey = `mh:token:${apiUser}:${ambiente}`;

    if (!forceRefresh) {
        const cachedToken = await cache.get(cacheKey);
        if (cachedToken) {
            return {
                success: true,
                token: cachedToken,
                cached: true
            };
        }
    }

    const authUrl = getEndpoint('auth', ambiente);

    try {
        console.log(`[HaciendaAuth] Solicitando nuevo token a MH para usuario: ${apiUser} (${ambiente})`);
        const response = await axios.post(authUrl, qs.stringify({
            user: apiUser,
            pwd: apiPassword
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 5000
        });

        if (response.data && response.data.status === 'OK') {
            const token = response.data.body.token;
            // Token válido por 24 horas en MH. Guardar en caché por 23.5 horas (84,600 segundos)
            await cache.set(cacheKey, token, 84600);

            return {
                success: true,
                token: token
            };
        } else {
            const msg = response.data?.message || response.data?.body?.mensaje || 'Respuesta de autenticación no reconocida';
            return {
                success: false,
                message: msg
            };
        }
    } catch (error) {
        const errorData = error.response ? error.response.data : null;
        console.error('MH Auth Error Details:', errorData || error.message);
        
        let msg = 'Error de conexión con MH Auth';
        if (errorData) {
            msg = errorData.message || errorData.body?.mensaje || errorData.descripcion || JSON.stringify(errorData);
        } else if (error.message) {
            msg = error.message;
        }

        return {
            success: false,
            message: msg
        };
    }
}

async function invalidateToken(apiUser, ambiente) {
    if (!apiUser) {
        await cache.delByPattern('mh:token:*');
        console.log('[HaciendaAuth] Caché de tokens de Hacienda limpiada globalmente.');
        return;
    }
    const cacheKey = `mh:token:${apiUser}:${ambiente}`;
    await cache.del(cacheKey);
    console.log(`[HaciendaAuth] Token en caché invalidado para ${cacheKey}`);
}

async function transmitDTE(token, signedDte, dteInfo) {
    const receptionUrl = getEndpoint('recepcion', dteInfo.ambiente);

    try {
        const payload = {
            ambiente: dteInfo.ambiente,
            idEnvio: dteInfo.idEnvio || 1,
            version: dteInfo.version || 3,
            tipoDte: dteInfo.tipoDte,
            documento: signedDte,
            codigoGeneracion: dteInfo.codigoGeneracion
        };

        console.log(`[MH-Transmission] Sending payload for DTE ${dteInfo.tipoDte} version ${payload.version} ambiente ${payload.ambiente}...`);
        
        const response = await axios.post(receptionUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        return {
            success: true,
            status: response.data.estado,
            selloRecepcion: response.data.selloRecibido,
            fhProcesamiento: response.data.fhProcesamiento,
            data: response.data
        };
    } catch (error) {
        const statusCode = error.response ? error.response.status : null;
        const isAuthError = statusCode === 401;
        console.error('MH Transmission Error:', error.response ? error.response.data : error.message);
        
        if (isAuthError && dteInfo.apiUser) {
            console.warn(`[MH-Transmission] Token rechazado con 401 por MH. Purgando caché para ${dteInfo.apiUser}...`);
            await invalidateToken(dteInfo.apiUser, dteInfo.ambiente);
        }

        return {
            success: false,
            statusCode,
            isAuthError,
            error: error.response ? error.response.data : error.message
        };
    }
}

async function consultDTE(token, dteInfo, ambiente) {
    const consultUrl = getEndpoint('consult', ambiente);

    try {
        const payload = {
            nitEmisor: dteInfo.nitEmisor,
            tdte: dteInfo.tipoDte,
            codigoGeneracion: dteInfo.codigoGeneracion
        };

        console.log(`[MH-Consult] Verificando estado de DTE ${dteInfo.codigoGeneracion} (${dteInfo.tipoDte}) en MH...`);

        const response = await axios.post(consultUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            timeout: 4000
        });

        const isProcessed = response.data && (response.data.estado === 'PROCESADO' || Boolean(response.data.selloRecibido));

        return {
            success: true,
            processed: isProcessed,
            status: response.data?.estado,
            selloRecepcion: response.data?.selloRecibido || null,
            fhProcesamiento: response.data?.fhProcesamiento || null,
            data: response.data
        };
    } catch (error) {
        const statusCode = error.response ? error.response.status : null;
        const isAuthError = statusCode === 401;
        console.warn(`[MH-Consult] Consulta de DTE ${dteInfo.codigoGeneracion} no exitosa:`, error.response ? error.response.data : error.message);

        if (isAuthError && dteInfo.apiUser) {
            console.warn(`[MH-Consult] Token rechazado con 401 por MH en consulta. Purgando caché para ${dteInfo.apiUser}...`);
            invalidateToken(dteInfo.apiUser, ambiente);
        }

        return {
            success: false,
            processed: false,
            statusCode,
            isAuthError,
            error: error.response ? error.response.data : error.message
        };
    }
}

module.exports = { authenticate, transmitDTE, consultDTE, invalidateToken };
