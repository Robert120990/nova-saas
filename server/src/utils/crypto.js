const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';

function getEnvSecret() {
    if (process.env.CRYPTO_SECRET) return process.env.CRYPTO_SECRET;
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            for (const line of content.split('\n')) {
                const cryptoMatch = line.match(/^\s*CRYPTO_SECRET\s*=\s*(.*)\s*$/);
                if (cryptoMatch && !process.env.CRYPTO_SECRET) {
                    process.env.CRYPTO_SECRET = cryptoMatch[1].trim().replace(/^["']|["']$/g, '');
                }
                const jwtMatch = line.match(/^\s*JWT_SECRET\s*=\s*(.*)\s*$/);
                if (jwtMatch && !process.env.JWT_SECRET) {
                    process.env.JWT_SECRET = jwtMatch[1].trim().replace(/^["']|["']$/g, '');
                }
                const legacyMatch = line.match(/^\s*CRYPTO_LEGACY_KEYS\s*=\s*(.*)\s*$/);
                if (legacyMatch && !process.env.CRYPTO_LEGACY_KEYS) {
                    process.env.CRYPTO_LEGACY_KEYS = legacyMatch[1].trim().replace(/^["']|["']$/g, '');
                }
            }
            if (process.env.CRYPTO_SECRET) return process.env.CRYPTO_SECRET;
            if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
        }
    } catch {}
    return '';
}

function getKey(customSecret) {
    const secret = customSecret || getEnvSecret();
    if (!secret) {
        throw new Error('CRYPTO_SECRET o JWT_SECRET no configurado en las variables de entorno');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text) {
    if (text === null || text === undefined || text === '') return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(payload) {
    if (!payload) return '';
    const parts = String(payload).split(':');
    if (parts.length !== 3) return '';

    const tryDecryptWith = (secretKey) => {
        try {
            const [ivB64, tagB64, dataB64] = parts;
            const decipher = crypto.createDecipheriv(ALGO, secretKey, Buffer.from(ivB64, 'base64'));
            decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
            const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
            return dec.toString('utf8');
        } catch {
            return null;
        }
    };

    const primarySecret = getEnvSecret();
    const candidateSecrets = [
        primarySecret,
        process.env.JWT_SECRET,
        ...(process.env.CRYPTO_LEGACY_KEYS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
    ].filter(Boolean);

    for (const secret of new Set(candidateSecrets)) {
        const result = tryDecryptWith(getKey(secret));
        if (result !== null) return result;
    }

    return '';
}

module.exports = { encrypt, decrypt };