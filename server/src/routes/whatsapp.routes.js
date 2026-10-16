const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const whatsappController = require('../controllers/whatsapp.controller');

const whatsappPerms = ['manage_whatsapp', 'manage_notifications', 'manage_settings', 'manage_companies'];

router.use(verifyToken);
router.use(tenantMiddleware);

router.get('/:branchId', checkPermission(whatsappPerms), whatsappController.getSettings);
router.post('/', checkPermission(whatsappPerms), whatsappController.saveSettings);
router.post('/test', checkPermission(whatsappPerms), whatsappController.testConnection);

module.exports = router;
