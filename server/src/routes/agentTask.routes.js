const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const agentTaskController = require('../controllers/agentTask.controller');

// All agent-tasks routes require JWT authentication, tenant isolation and manage_ai_tasks permission
router.use(verifyToken);
router.use(tenantMiddleware);
router.use(checkPermission(['manage_ai_tasks', 'ai_assistant_access']));

// List and Create
router.get('/', agentTaskController.getTasks);
router.post('/', agentTaskController.createTask);

// Detail and SSE progress stream
router.get('/:id', agentTaskController.getTaskById);
router.put('/:id', agentTaskController.updateTask);
router.get('/:id/stream', agentTaskController.streamTaskProgress);

// Actions
router.put('/:id/cancel', agentTaskController.cancelTask);
router.post('/:id/retry', agentTaskController.retryTask);

module.exports = router;
