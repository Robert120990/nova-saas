const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
    const secret = process.env.JWT_SECRET || 'nova_saas_secret_fallback_2026';
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
    try {
        const [ivB64, tagB64, dataB64] = parts;
        const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
        return dec.toString('utf8');
    } catch (e) {
        return '';
    }
}

module.exports = { encrypt, decrypt };