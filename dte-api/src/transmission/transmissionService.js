/**
 * Hacienda Transmission Service
 */

const axios = require('axios');
const qs = require('qs');
const haciendaConfig = require('../config/haciendaConfig');

async function authenticate(apiUser, apiPassword) {
    const authUrl = haciendaConfig.endpoints.auth;

    try {
        console.log(`[HaciendaAuth] Attempting login for user: ${apiUser}`);
        const response = await axios.post(authUrl, qs.stringify({
            user: apiUser,
            pwd: apiPassword
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000
        });

        if (response.data && response.data.status === 'OK') {
            return {
                success: true,
                token: response.data.body.token
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

async function transmitDTE(token, signedDte, dteInfo) {
    const receptionUrl = haciendaConfig.endpoints.reception;

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
                'Authorization': token, // Token already has 'Bearer ' prefix usually
                'Content-Type': 'application/json'
            }
        });

        return {
            success: true,
            status: response.data.estado,
            selloRecepcion: response.data.selloRecibido,
            fhProcesamiento: response.data.fhProcesamiento,
            data: response.data
        };
    } catch (error) {
        console.error('MH Transmission Error:', error.response ? error.response.data : error.message);
        return {
            success: false,
            error: error.response ? error.response.data : error.message
        };
    }
}

module.exports = { authenticate, transmitDTE };
