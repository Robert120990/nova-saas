/**
 * DTE API - Main Entry Point
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { authMiddleware, tenantMiddleware } = require('./middlewares/auth');
const dteController = require('./controllers/dteController');
const { startQueueWorker } = require('./queue/transmissionQueue');
const { startContingencyWorker } = require('./jobs/resendContingencyDTE');
const { initValidators } = require('./validators/schemaValidator');

const app = express();
const PORT = process.env.PORT || 4005;

// File logger setup
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logsDir, 'dte-api.log'), { flags: 'a' });
morgan.token('safe-url', (req) => (req.originalUrl || req.url).replace(/([?&])token=[^&]+/g, '$1token=***'));

app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]', { stream: { write: (msg) => logFile.write(msg) } }));

const _log = console.log;
const _error = console.error;
const _warn = console.warn;
console.log = (...args) => { logFile.write(`[${new Date().toISOString()}] [LOG] ${args.join(' ')}\n`); _log.apply(console, args); };
console.error = (...args) => { logFile.write(`[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`); _error.apply(console, args); };
console.warn = (...args) => { logFile.write(`[${new Date().toISOString()}] [WARN] ${args.join(' ')}\n`); _warn.apply(console, args); };

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'));

// Initialization
initValidators();
startQueueWorker(60000); // Process queue every 60s
startContingencyWorker(300000); // Process contingency every 5m

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

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`DTE API is running on port ${PORT}`);
});
