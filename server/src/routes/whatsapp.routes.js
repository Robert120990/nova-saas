const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const whatsappController = require('../controllers/whatsapp.controller');

router.use(verifyToken);
router.use(tenantMiddleware);

router.get('/:branchId', whatsappController.getSettings);
router.post('/', whatsappController.saveSettings);
router.post('/test', whatsappController.testConnection);

module.exports = router;
