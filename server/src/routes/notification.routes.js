const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const notificationController = require('../controllers/notification.controller');
const telegramController = require('../controllers/telegram.controller');

router.use(verifyToken);
router.use(tenantMiddleware);

router.get('/actions', notificationController.getActions);
router.get('/rules/:branchId', notificationController.getRulesByBranch);
router.post('/rules', notificationController.saveRule);
router.put('/rules/:id', notificationController.saveRule);
router.delete('/rules/:id', notificationController.deleteRule);

router.get('/telegram/status', telegramController.getStatus);
router.put('/telegram/bindings/:id', telegramController.updateBinding);
router.post('/telegram/test', telegramController.testConnection);
router.get('/sale-suspicious-settings', telegramController.getSuspiciousSettings);
router.put('/sale-suspicious-settings', telegramController.saveSuspiciousSettings);

router.get('/mine', notificationController.getMyNotifications);
router.get('/mine/unread-count', notificationController.getUnreadCount);
router.put('/mine/:id/read', notificationController.markAsRead);
router.put('/mine/read-all', notificationController.markAllAsRead);

module.exports = router;
