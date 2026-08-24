const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');
const loginRateLimit = require('../services/loginRateLimit.service');

/**
 * Rate-limit de login persistente (BD):
 * - Cuenta SOLO intentos fallidos (el hook 'finish' clasifica por statusCode).
 * - Clave por (ip + username); además techo por IP contra fuerza bruta.
 * - Si la BD falla, deja pasar (fail-open) para no tirar el login a todos.
 */
const loginRateLimiter = (req, res, next) => {
    const ip = loginRateLimit.getClientIp(req);
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    req.loginRate = { ip, username };

    res.on('finish', () => {
        if (res.statusCode === 429) return;
        if (res.statusCode < 400) {
            loginRateLimit.recordSuccess(ip, username).catch(() => {});
        } else {
            loginRateLimit.recordFailure(ip, username).catch(() => {});
        }
    });

    loginRateLimit.checkBlocked(ip, username)
        .then((status) => {
            if (status.blocked) {
                return res.status(429).json({
                    message: `Demasiados intentos fallidos. Intente de nuevo en ${status.minutes} minuto(s).`
                });
            }
            next();
        })
        .catch(() => next());
};

const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'SuperAdmin') return next();
    return res.status(403).json({ message: 'Solo SuperAdmin puede desbloquear accesos' });
};

router.post('/login', loginRateLimiter, authController.login);
router.post('/rate-limit/unlock', verifyToken, superAdminOnly, authController.unlockRateLimit);
router.post('/select-context', verifyToken, authController.selectContext);
router.get('/me/access', verifyToken, authController.getAccess);
router.post('/heartbeat', verifyToken, authController.heartbeat);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
