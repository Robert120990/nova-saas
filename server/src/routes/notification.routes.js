const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const notificationController = require('../controllers/notification.controller');

router.use(verifyToken);
router.use(tenantMiddleware);

router.get('/actions', notificationController.getActions);
router.get('/rules/:branchId', notificationController.getRulesByBranch);
router.post('/rules', notificationController.saveRule);
router.put('/rules/:id', notificationController.saveRule);
router.delete('/rules/:id', notificationController.deleteRule);

router.get('/mine', notificationController.getMyNotifications);
router.get('/mine/unread-count', notificationController.getUnreadCount);
router.put('/mine/:id/read', notificationController.markAsRead);
router.put('/mine/read-all', notificationController.markAllAsRead);

module.exports = router;
