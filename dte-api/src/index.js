/**
 * DTE API - Main Entry Point
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initSentry, setupSentryErrorHandler } = require('./config/sentry');
const { logger, httpLogger } = require('./utils/logger');
const { authMiddleware, tenantMiddleware } = require('./middlewares/auth');
const dteController = require('./controllers/dteController');
const { startContingencyWorker } = require('./jobs/resendContingencyDTE');
const { startAutoCloseWorker } = require('./jobs/autoCloseContingency');
const { initValidators } = require('./validators/schemaValidator');
const { contingencyQueue } = require('./queue');

const app = express();
const PORT = process.env.PORT || 4005;

// Initialize Sentry error tracking
initSentry(app);

// File logger fallback setup
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logsDir, 'dte-api.log'), { flags: 'a' });

const _log = console.log;
const _error = console.error;
const _warn = console.warn;
console.log = (...args) => { logFile.write(`[${new Date().toISOString()}] [LOG] ${args.join(' ')}\n`); _log.apply(console, args); };
console.error = (...args) => { logFile.write(`[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`); _error.apply(console, args); };
console.warn = (...args) => { logFile.write(`[${new Date().toISOString()}] [WARN] ${args.join(' ')}\n`); _warn.apply(console, args); };

// Middleware
app.use(httpLogger);
app.use(cors());
app.use(express.json());

// Initialization
initValidators();
// Reconciliación pasiva de contingencia cada 30m (el reenvío principal es reactivo inmediato vía BullMQ)
startContingencyWorker(1800000);
startAutoCloseWorker(300000); // Check auto-recovery every 5m

// Routes
const router = express.Router();
router.use(require('./middlewares/audit'));

// Health check
router.get('/health', (req, res) => res.json({ status: 'UP' }));

// Reinicio seguro (requiere restart_key del .env)
router.post('/restart', (req, res) => {
    const key = req.body?.restart_key || req.headers['x-restart-key'];
    if (!key || key !== process.env.RESTART_KEY) {
        return res.status(401).json({ success: false, message: 'restart_key inválida' });
    }
    console.log('[Restart] Solicitado — reiniciando en 500ms...');
    res.json({ success: true, message: 'Reiniciando servicio DTE...' });
    setTimeout(() => process.exit(0), 500);
});

// DTE Endpoints
router.post('/dte/emit', authMiddleware, tenantMiddleware, dteController.emit);
router.post('/dte/generate', authMiddleware, tenantMiddleware, dteController.generate);
router.post('/dte/validate', authMiddleware, tenantMiddleware, dteController.validate);
router.post('/dte/sign', authMiddleware, tenantMiddleware, dteController.sign);
router.post('/dte/transmit', authMiddleware, tenantMiddleware, dteController.transmit);
router.get('/dte/status/:codigoGeneracion', authMiddleware, tenantMiddleware, dteController.getStatus);
router.get('/dte/:codigoGeneracion', authMiddleware, tenantMiddleware, dteController.getDTE);

router.get('/dte/pdf/:codigoGeneracion', authMiddleware, tenantMiddleware, dteController.generatePDF);

// New Modules
router.use('/signature', require('./routes/signature.routes'));
router.use('/invalidation', require('./routes/invalidation.routes'));
router.use('/contingency', require('./routes/contingency.routes'));
router.use('/retransmission', require('./routes/retransmission.routes'));
router.use('/retorno', require('./routes/retorno.routes'));

app.use('/api', router);

// Sentry express error handler
setupSentryErrorHandler(app);

// Error handling
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error({ err, path: req.path, method: req.method }, `[DTE-API ERROR] ${err.message}`);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const gracefulShutdown = async () => {
    logger.info('[DTE-API] Iniciando cierre ordenado...');
    try {
        await contingencyQueue.close();
    } catch (e) {
        logger.error({ err: e.message }, '[DTE-API] Error cerrando contingencyQueue');
    }
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(PORT, () => {
    logger.info(`DTE API corriendo en puerto ${PORT}`);
});
