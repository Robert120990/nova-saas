const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/select-context', verifyToken, authController.selectContext);
router.get('/me/access', verifyToken, authController.getAccess);

module.exports = router;
