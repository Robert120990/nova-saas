const express = require('express');
const router = express.Router();
const retornoController = require('../controllers/retornoController');
const { authMiddleware, tenantMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, tenantMiddleware, retornoController.list);
router.post('/generate', authMiddleware, tenantMiddleware, retornoController.generate);
router.post('/emit', authMiddleware, tenantMiddleware, retornoController.emit);
router.get('/status/:codigoGeneracion', authMiddleware, tenantMiddleware, retornoController.getStatus);

module.exports = router;
