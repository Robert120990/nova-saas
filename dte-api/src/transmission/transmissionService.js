/**
 * Hacienda Transmission Service
 */

const axios = require('axios');
const qs = require('qs');
const haciendaConfig = require('../config/haciendaConfig');

async function authenticate(apiUser, apiPassword) {
    const authUrl = haciendaConfig.endpoints.auth;

    try {
        const response = await axios.post(authUrl, qs.stringify({
            user: apiUser,
            pwd: apiPassword
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data && response.data.status === 'OK') {
            return {
                success: true,
                token: response.data.body.token
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'Error de autenticación con MH'
            };
        }
    } catch (error) {
        console.error('MH Auth Error:', error.response ? error.response.data : error.message);
        return {
            success: false,
            message: `Error de conexión con MH Auth: ${error.message}`
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

        const response = await axios.post(receptionUrl, payload, {
            headers: {
                'Authorization': token, // Token already has 'Bearer ' prefix usually or needs it
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
