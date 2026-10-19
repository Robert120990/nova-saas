const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const upload = require('../config/upload');
const ticketController = require('../controllers/ticket.controller');

// All ticket routes require authentication
router.use(verifyToken);

// List tickets & stats
router.get('/', ticketController.getTickets);
router.get('/stats', ticketController.getTicketStats);

// AI Prompt Packaging, Auto-Triage & Batch Resolution routes (must be registered before /:id)
router.get('/ai-bundle', ticketController.getAiBundleTickets);
router.post('/ai-bundle/auto-triage', ticketController.autoTriageAiBundle);
router.post('/ai-bundle/generate', ticketController.saveAndGenerateAiBundle);
router.post('/ai-bundle/resolve-batch', ticketController.resolveAiBundleBatch);

// AGY Remote Console Settings & Orchestration routes
router.get('/agy-settings', ticketController.getAgyConfig);
router.put('/agy-settings', ticketController.updateAgyConfig);

// Exclusive creator notification check & acknowledge (like UpdateAvailableModal)
router.get('/pending-resolved', ticketController.getPendingResolvedForCreator);
router.put('/:id/acknowledge', ticketController.acknowledgeResolvedTicket);

// Ticket detail, creation, status updates, AI review notes, and messages
router.get('/:id', ticketController.getTicketDetail);
router.post('/', upload.single('screenshot'), ticketController.createTicket);
router.put('/:id/status', upload.single('attachment'), ticketController.updateStatus);
router.put('/:id/ai-review', ticketController.updateTicketAiReview);
router.post('/:id/messages', upload.single('attachment'), ticketController.addMessage);

// Ticket AGY Plan & Execution flow (+ Telegram HitL)
router.post('/:id/agy/plan', ticketController.approveTicketAndStartAgyPlan);
router.post('/:id/agy/execute', ticketController.approveAndExecuteAgyPlan);
router.post('/:id/agy/reject', ticketController.denyAgyPlan);
router.post('/:id/agy/resend-telegram', ticketController.resendAgyPlanToTelegram);

module.exports = router;
