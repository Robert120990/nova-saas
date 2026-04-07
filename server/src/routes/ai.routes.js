const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { verifyToken, checkPermission } = require('../middlewares/auth');

// POST /api/ai/chat
// Require token and a specific permission for AI
router.post('/chat', verifyToken, checkPermission('ai_assistant_access'), aiController.chat);

module.exports = router;
