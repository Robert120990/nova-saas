/**
 * Contingency Routes
 */

const express = require('express');
const router = express.Router();
const contingencyController = require('../controllers/contingencyController');
const { authMiddleware, tenantMiddleware } = require('../middlewares/auth');

router.post('/start', authMiddleware, tenantMiddleware, contingencyController.start);
router.post('/stop/:id', authMiddleware, tenantMiddleware, contingencyController.stop);
router.post('/report', authMiddleware, tenantMiddleware, contingencyController.reportDocument);
router.get('/status', authMiddleware, tenantMiddleware, contingencyController.getStatus);

module.exports = router;
