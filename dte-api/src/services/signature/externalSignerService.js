/**
 * External Signer Service (Connects to Hacienda Signer)
 */

const axios = require('axios');
require('dotenv').config();

async function signWithExternalSigner(dteJson, nit, certificatePassword) {
    const signerUrl = process.env.SIGNER_URL || 'http://localhost:8113/firmardocumento/';
    
    try {
        console.log('Signing with EXTERNAL signer...');
        
        const response = await axios.post(signerUrl, {
            nit: nit.replace(/-/g, ''),
            activo: true,
            passwordPri: certificatePassword,
            dteJson: dteJson
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 seconds timeout for local service
        });

        // The external signer returns just the JWS string or a body with it
        // Depending on the version, sometimes it returns { status: 'OK', body: 'JWS' }
        // or just the string.
        const jws = typeof response.data === 'string' ? response.data : response.data.body || response.data;

        if (!jws) {
            throw new Error('El firmador externo no retornó una firma válida');
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
