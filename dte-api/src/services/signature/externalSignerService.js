/**
 * External Signer Service (Connects to Hacienda Signer)
 */

const axios = require('axios');
require('dotenv').config();

async function signWithExternalSigner(dteJson, nit, certificatePassword) {
    const signerUrl = process.env.SIGNER_URL || 'http://localhost:8113/firmardocumento/';
    
    try {
        console.log('Signing with EXTERNAL signer...');
        
        const requestBody = {
            nit: nit.replace(/-/g, ''), // Back to digits only to avoid 809 format error
            activo: true,
            passwordPri: certificatePassword,
            dteJson: dteJson
        };

        console.log('[Signature] Sending request to signer with NIT:', requestBody.nit);
        
        const response = await axios.post(signerUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 seconds timeout for local service
        });

        console.log('[Signature] Signer raw response:', JSON.stringify(response.data).substring(0, 200));

        // The external signer returns just the JWS string or a body with it
        // Check for common error structures from Hacienda signer (like { codigo: '809', ... })
        if (response.data && response.data.codigo) {
            const errorMsg = Array.isArray(response.data.mensaje) ? response.data.mensaje.join(', ') : response.data.mensaje;
            throw new Error(`${response.data.codigo}: ${errorMsg || 'Error desconocido del firmador'}`);
        }

        const jws = typeof response.data === 'string' ? response.data : response.data.body || response.data;

        if (!jws || typeof jws !== 'string' || !jws.startsWith('eyJ')) {
            throw new Error(`El firmador externo no retornó una firma JWS válida (recibido: ${typeof jws === 'string' ? jws.substring(0, 20) : 'objeto'})`);
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
