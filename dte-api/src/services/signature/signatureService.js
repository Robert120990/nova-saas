/**
 * Unified Signature Service Router
 */

const { signWithInternalSigner } = require('./internalSignerService');
const { signWithExternalSigner } = require('./externalSignerService');
const { signWithNativeCrt, findCrtFile } = require('./nativeCrtSigner');
require('dotenv').config();

/**
 * Routes the signature request to the appropriate service based on SIGNATURE_MODE
 * @param {Object} dteJson The JSON to sign
 * @param {Object} options Options including certificate details
 * @returns {Promise<Object>}
 */
async function signDTE(dteJson, options = {}) {
    const { certificatePath, certificateCrtPath, certificatePassword, nit, ambiente } = options;
    const mode = process.env.SIGNATURE_MODE || 'internal';
    
    console.log(`[Signature] Using mode: ${mode}`);
    
    try {
        if (mode === 'internal') {
            const hasCrt = findCrtFile(nit, certificateCrtPath);
            if (hasCrt) {
                return await signWithNativeCrt(dteJson, nit, certificatePassword, certificateCrtPath);
            }
            return await signWithInternalSigner(dteJson, certificatePath, certificatePassword);
        } else if (mode === 'external') {
            try {
                return await signWithExternalSigner(dteJson, nit, certificatePassword, ambiente || 'test');
            } catch (externalErr) {
                console.warn('[Signature] Falló firmador externo:', externalErr.message);
                const hasCrt = findCrtFile(nit, certificateCrtPath);
                if (hasCrt) {
                    console.log(`[Signature] Ejecutando firma nativa CRT de respaldo para NIT: ${nit}...`);
                    return await signWithNativeCrt(dteJson, nit, certificatePassword, certificateCrtPath);
                }
                throw externalErr;
            }
        } else if (mode === 'mock') {
            console.log('[Signature] Using MOCK mode... returning dummy JWS');
            return {
                success: true,
                jws: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXUyIsIng1YyI6WyJNSUlCcFRDQ0FSMmdBd0lCQWdJ...MOCK_SIGNATURE'
            };
        } else {
            throw new Error(`SIGNATURE_MODE no válido: ${mode}. Use 'internal', 'external' o 'mock'.`);
        }
    } catch (error) {
        console.error(`[Signature] Error in ${mode} mode:`, error.message);
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = { signDTE };
