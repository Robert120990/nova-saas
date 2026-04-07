/**
 * Signature Routes
 */

const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signatureController');
const { authMiddleware, tenantMiddleware } = require('../middlewares/auth');

router.post('/test-internal', authMiddleware, tenantMiddleware, signatureController.testInternal);
router.post('/test-external', authMiddleware, tenantMiddleware, signatureController.testExternal);

module.exports = router;
