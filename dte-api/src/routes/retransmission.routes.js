/**
 * Retransmission Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, tenantMiddleware } = require('../middlewares/auth');
const retransmissionController = require('../controllers/retransmissionController');

router.post('/retransmit', authMiddleware, tenantMiddleware, retransmissionController.retransmit);

module.exports = router;
