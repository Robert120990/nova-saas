const express = require('express');
const router = express.Router();
const integrationContractController = require('../controllers/integrationContract.controller');

// GET /api/integration/contract - Metadata del contrato vivo SIPE y verificación anti-drift
router.get('/contract', integrationContractController.getIntegrationContract);

// POST /api/integration/coldroom-billing - Emisión / registro de facturación Cuarto Frío Inversiones LIL
router.post('/coldroom-billing', integrationContractController.createColdroomBilling);

module.exports = router;
