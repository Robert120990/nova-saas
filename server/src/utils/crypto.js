const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';

function getEnvSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            for (const line of content.split('\n')) {
                const match = line.match(/^\s*JWT_SECRET\s*=\s*(.*)\s*$/);
                if (match) {
                    process.env.JWT_SECRET = match[1].trim().replace(/^["']|["']$/g, '');
                    return process.env.JWT_SECRET;
                }
            }
        }
    } catch {}
    return 'nova_saas_secret_fallback_2026';
}

function getKey(customSecret) {
    const secret = customSecret || getEnvSecret();
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

    // 1. Clave de entorno activa
    let result = tryDecryptWith(getKey());
    if (result !== null) return result;

    // 2. Fallback de migración
    result = tryDecryptWith(getKey('nova_saas_secret_fallback_2026'));
    if (result !== null) return result;

    // 3. Fallback de servidor saas
    result = tryDecryptWith(getKey('supersecretjwtkey123'));
    if (result !== null) return result;

    return '';
}

module.exports = { encrypt, decrypt };