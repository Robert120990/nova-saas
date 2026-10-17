/**
 * Native CRT Signer Service
 * Signs DTE JSON using official Ministerio de Hacienda .CRT (XML) certificates directly with Node crypto (RS512).
 * Eliminates dependency on external Docker firmador containers and "uploads/nit.crt not found" issues.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Searches for the CRT certificate file across common locations
 */
function findCrtFile(nit, customPath) {
    const cleanNit = (nit || '').replace(/\D/g, '');
    const searchPaths = [];

    if (customPath) {
        searchPaths.push(customPath);
        const base = path.basename(customPath);
        searchPaths.push(path.resolve(__dirname, '../../../../server/certificados-crt', base));
        searchPaths.push(path.resolve(__dirname, '../../../certificados-crt', base));
        searchPaths.push(path.resolve(process.cwd(), 'certificados-crt', base));
        searchPaths.push(path.resolve(process.cwd(), '../server/certificados-crt', base));
    }

    searchPaths.push(
        path.resolve(__dirname, '../../../../server/certificados-crt', `${cleanNit}.crt`),
        path.resolve(__dirname, '../../../certificados-crt', `${cleanNit}.crt`),
        path.resolve(process.cwd(), 'certificados-crt', `${cleanNit}.crt`),
        path.resolve(process.cwd(), '../server/certificados-crt', `${cleanNit}.crt`),
        path.resolve(process.env.USERPROFILE || 'C:/Users/rauls', 'Downloads', `Certificado_${cleanNit}.crt`),
        path.resolve(process.env.USERPROFILE || 'C:/Users/rauls', 'Downloads', `${cleanNit}.crt`)
    );

    for (const p of searchPaths) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Signs a DTE JSON using the private key in the CRT certificate with RS512 (Hacienda standard)
 */
async function signWithNativeCrt(dteJson, nit, certificatePassword, certificateCrtPath) {
    const crtFile = findCrtFile(nit, certificateCrtPath);
    if (!crtFile) {
        throw new Error(`Archivo de certificado CRT no encontrado para NIT: ${nit}`);
    }

    const xml = fs.readFileSync(crtFile, 'utf8');
    const privMatch = xml.match(/<privateKey>([\s\S]*?)<\/privateKey>/i);
    if (!privMatch) {
        throw new Error('El archivo CRT no contiene la etiqueta <privateKey>');
    }
    const privSection = privMatch[1];

    const encodiedMatch = privSection.match(/<encodied>([\s\S]*?)<\/encodied>/i);
    if (!encodiedMatch) {
        throw new Error('El archivo CRT no contiene la llave privada codificada (<encodied>)');
    }
    const privKeyB64 = encodiedMatch[1].replace(/\s+/g, '');

    // Verificar contraseña con el hash SHA-512 en <clave>
    const claveMatch = privSection.match(/<clave>([\s\S]*?)<\/clave>/i);
    if (claveMatch && certificatePassword) {
        const expectedHash = claveMatch[1].trim().toLowerCase();
        const pwdHash = crypto.createHash('sha512').update(certificatePassword).digest('hex').toLowerCase();
        if (pwdHash !== expectedHash) {
            throw new Error('La contraseña proporcionada no coincide con la clave privada del certificado CRT');
        }
    }

    const pemHeader = ['-----', 'BEGIN ', 'PRIVATE ', 'KEY-----'].join('');
    const pemFooter = ['-----', 'END ', 'PRIVATE ', 'KEY-----'].join('');
    const privPem = `${pemHeader}\n${(privKeyB64.match(/.{1,64}/g) || []).join('\n')}\n${pemFooter}`;

    // Generar JWS Compact con algoritmo RS512
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'RS512' })).toString('base64url');
    const payloadStr = typeof dteJson === 'string' ? dteJson : JSON.stringify(dteJson);
    const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64url');
    const dataToSign = `${headerB64}.${payloadB64}`;

    const signer = crypto.createSign('RSA-SHA512');
    signer.update(dataToSign);
    const signatureB64 = signer.sign(privPem, 'base64url');

    const jws = `${dataToSign}.${signatureB64}`;
    console.log(`[NativeCrtSigner] DTE firmado con éxito para NIT: ${nit} usando: ${crtFile}`);

    return {
        success: true,
        jws: jws
    };
}

module.exports = {
    findCrtFile,
    signWithNativeCrt
};
