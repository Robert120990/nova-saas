const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const notificationController = require('../controllers/notification.controller');
const telegramController = require('../controllers/telegram.controller');

const notifAdminPerms = ['manage_notifications', 'manage_settings', 'manage_companies'];

router.use(verifyToken);
router.use(tenantMiddleware);

router.get('/actions', checkPermission(notifAdminPerms), notificationController.getActions);
router.get('/rules/:branchId', checkPermission(notifAdminPerms), notificationController.getRulesByBranch);
router.post('/rules', checkPermission(notifAdminPerms), notificationController.saveRule);
router.put('/rules/:id', checkPermission(notifAdminPerms), notificationController.saveRule);
router.delete('/rules/:id', checkPermission(notifAdminPerms), notificationController.deleteRule);

router.get('/telegram/status', checkPermission(notifAdminPerms), telegramController.getStatus);
router.post('/telegram/token', checkPermission(notifAdminPerms), telegramController.saveBotToken);
router.put('/telegram/bindings/:id', checkPermission(notifAdminPerms), telegramController.updateBinding);
router.delete('/telegram/bindings/:id', checkPermission(notifAdminPerms), telegramController.deleteBinding);
router.post('/telegram/invite-tokens', checkPermission(notifAdminPerms), telegramController.createInviteToken);
router.get('/telegram/invite-tokens', checkPermission(notifAdminPerms), telegramController.getPendingInvites);
router.delete('/telegram/invite-tokens/:id', checkPermission(notifAdminPerms), telegramController.deletePendingInvite);
router.post('/telegram/test', checkPermission(notifAdminPerms), telegramController.testConnection);
router.put('/telegram/daily-briefing', checkPermission(notifAdminPerms), telegramController.updateDailyBriefingSetting);
router.post('/telegram/daily-briefing/test', checkPermission(notifAdminPerms), telegramController.testDailyBriefing);
router.put('/telegram/reopen-requests', checkPermission(notifAdminPerms), telegramController.updateReopenRequestsSetting);
router.get('/sale-suspicious-settings', checkPermission(notifAdminPerms), telegramController.getSuspiciousSettings);
router.put('/sale-suspicious-settings', checkPermission(notifAdminPerms), telegramController.saveSuspiciousSettings);

router.get('/mine', notificationController.getMyNotifications);
router.get('/mine/unread-count', notificationController.getUnreadCount);
router.put('/mine/:id/read', notificationController.markAsRead);
router.put('/mine/read-all', notificationController.markAllAsRead);

module.exports = router;
