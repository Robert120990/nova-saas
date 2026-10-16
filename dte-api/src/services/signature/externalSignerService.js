/**
 * External Signer Service (Connects to Hacienda Signer)
 */

const axios = require('axios');
require('dotenv').config();
const { isProduction } = require('../../config/haciendaConfig');

async function signWithExternalSigner(dteJson, nit, certificatePassword, ambiente) {
    const isTest = !isProduction(ambiente);
    const signerUrl = isTest
        ? (process.env.SIGNER_URL_TEST || 'http://localhost:8114/firmardocumento/')
        : (process.env.SIGNER_URL_PROD || 'http://localhost:8113/firmardocumento/');
    
    try {
        console.log('[Signature] Using signer URL:', signerUrl);
        
        const requestBody = {
            nit: nit.replace(/-/g, ''),
            activo: true,
            passwordPri: certificatePassword,
            dteJson: dteJson
        };

        console.log('[Signature] Sending request to signer with NIT:', requestBody.nit);
        
        const response = await axios.post(signerUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('[Signature] Signer raw response:', JSON.stringify(response.data).substring(0, 200));

        if (response.data) {
            if (response.data.status === 'ERROR' || response.data.codigo || (response.data.body && typeof response.data.body === 'object' && response.data.body.codigo)) {
                const errObj = (response.data.body && typeof response.data.body === 'object') ? response.data.body : response.data;
                const errCode = errObj.codigo || response.data.codigo || 'ERROR';
                const errMsg = errObj.mensaje || response.data.mensaje || JSON.stringify(errObj);
                const formattedMsg = Array.isArray(errMsg) ? errMsg.join(', ') : errMsg;
                throw new Error(`${errCode}: ${formattedMsg || 'Error reportado por el firmador externo'}`);
            }
        }

        const jws = typeof response.data === 'string' ? response.data : (response.data.body || response.data);

        if (!jws || typeof jws !== 'string' || !jws.startsWith('eyJ')) {
            const preview = typeof jws === 'string' ? jws.substring(0, 30) : JSON.stringify(jws);
            throw new Error(`El firmador externo no retornó una firma JWS válida (recibido: ${preview})`);
        }

        return {
            success: true,
            jws: jws
        };

    } catch (error) {
        console.error('External Signer Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            throw new Error('El servicio de firma externo está fuera de línea (offline)');
        }
        throw new Error(`Error en firmador externo: ${error.message}`);
    }
}

module.exports = { signWithExternalSigner };
