/**
 * Invalidation Routes
 */

const express = require('express');
const router = express.Router();
const invalidationController = require('../controllers/invalidationController');
const { authMiddleware, tenantMiddleware } = require('../middlewares/auth');

router.post('/invalidate', authMiddleware, tenantMiddleware, invalidationController.invalidate);
router.get('/invalidation-status/:codigoGeneracion', authMiddleware, tenantMiddleware, invalidationController.getStatus);

module.exports = router;
