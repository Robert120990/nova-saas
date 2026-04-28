/**
 * DTE API - Main Entry Point
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { authMiddleware, tenantMiddleware } = require('./middlewares/auth');
const dteController = require('./controllers/dteController');
const { startQueueWorker } = require('./queue/transmissionQueue');
const { startContingencyWorker } = require('./jobs/resendContingencyDTE');
const { initValidators } = require('./validators/schemaValidator');

const app = express();
const PORT = process.env.PORT || 4005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialization
initValidators();
startQueueWorker(60000); // Process queue every 60s
startContingencyWorker(300000); // Process contingency every 5m

// Routes
const router = express.Router();

// Health check
router.get('/health', (req, res) => res.json({ status: 'UP' }));

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

app.use('/api', router);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`DTE API is running on port ${PORT}`);
});
