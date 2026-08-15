const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginRateLimiter(req, res, next) {
    const ip = req.headers['x-client-public-ip']
        || (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim()
        || req.socket.remoteAddress
        || req.ip;
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (!record || now - record.resetAt > LOGIN_WINDOW_MS) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return next();
    }
    if (record.count >= LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({ message: 'Demasiados intentos. Intente de nuevo en 15 minutos.' });
    }
    record.count += 1;
    next();
}

router.post('/login', loginRateLimiter, authController.login);
router.post('/select-context', verifyToken, authController.selectContext);
router.get('/me/access', verifyToken, authController.getAccess);
router.post('/heartbeat', verifyToken, authController.heartbeat);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
