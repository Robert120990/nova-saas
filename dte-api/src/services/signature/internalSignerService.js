/**
 * Internal Signer Service (Existing Jose/Forge implementation)
 */

const forge = require('node-forge');
const jose = require('jose');
const fs = require('fs');

async function signWithInternalSigner(dteJson, certificatePath, certificatePassword) {
    try {
        if (!fs.existsSync(certificatePath)) {
            throw new Error(`Archivo de certificado no encontrado en: ${certificatePath}`);
        }

        // 1. Load and parse the .p12 file
        const p12Buffer = fs.readFileSync(certificatePath);
        const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certificatePassword);

        // 2. Extract the private key
        let keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
        if (!keyBag || keyBag.length === 0) {
            keyBag = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
        }

        if (!keyBag || keyBag.length === 0) {
            throw new Error('No se encontró la llave privada en el certificado');
        }

        const privateKey = keyBag[0].key;
        const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

        // 3. Extract the certificate
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
        let x5c = [];
        if (certBags && certBags.length > 0) {
            x5c = certBags.map(bag => {
                const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes();
                return Buffer.from(certDer, 'binary').toString('base64');
            });
        }

        // 4. Import key to jose and sign
        const alg = 'ES256';
        let signingKey;
        
        try {
            signingKey = await jose.importPKCS8(privateKeyPem, alg);
        } catch (err) {
            throw new Error(`Error al importar llave para ${alg}: ${err.message}. Verifique que el certificado sea compatible con EC.`);
        }

        // 5. Generate JWS
        const jws = await new jose.CompactSign(
            new TextEncoder().encode(JSON.stringify(dteJson))
        )
            .setProtectedHeader({ 
                alg, 
                typ: 'JWS',
                x5c: x5c.length > 0 ? x5c : undefined
            })
            .sign(signingKey);

        return {
            success: true,
            jws: jws
        };
    } catch (error) {
        console.error('Internal Signature Error:', error.message);
        throw new Error(`Firma interna fallida: ${error.message}`);
    }
}

module.exports = { signWithInternalSigner };
