const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/select-context', verifyToken, authController.selectContext);
router.get('/me/access', verifyToken, authController.getAccess);
router.post('/heartbeat', verifyToken, authController.heartbeat);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
