const express = require('express');
const router = express.Router();
const eggController = require('../controllers/eggIndustrial.controller');

// 1. Recepción de Materia Prima
router.get('/raw-materials', eggController.getRawMaterials);
router.post('/raw-materials', eggController.createRawMaterial);
router.put('/raw-materials/:id', eggController.updateRawMaterial);
router.put('/raw-materials/:id/void', eggController.voidRawMaterial);

// 2. CIP (Clean In Place)
router.get('/cip', eggController.getCipLogs);
router.post('/cip', eggController.createCipLog);

// 3. Lotes de Producción
router.get('/batches', eggController.getProductionBatches);
router.post('/batches', eggController.createProductionBatch);
router.put('/batches/:id/complete', eggController.completeProductionBatch);

// 4. Pasteurización
router.post('/pasteurize', eggController.createPasteurizationLog);

// 5. Holding y Cold Chain
router.get('/holding-temps', eggController.getHoldingTemperatures);
router.post('/holding-temps', eggController.createHoldingTemperature);

// 6. Empaque Final
router.get('/packaging', eggController.getPackagingRecords);
router.post('/packaging', eggController.createPackagingRecord);
router.put('/packaging/:id', eggController.updatePackagingRecord);
router.delete('/packaging/:id', eggController.deletePackagingRecord);

// 7. Blast Freezer
router.get('/blast-freezer', eggController.getBlastFreezerLogs);
router.post('/blast-freezer', eggController.createBlastFreezerLog);

// 8. Mantenimiento de Maquinaria
router.get('/maintenance', eggController.getMaintenanceLogs);
router.post('/maintenance', eggController.createMaintenanceLog);

// 9. Costos Operativos Industriales
router.get('/costs', eggController.getIndustrialCosts);
router.post('/costs', eggController.createIndustrialCosts);

// 10. Forecasting
router.get('/forecast', eggController.getForecasting);

// 11. Trazabilidad Bidireccional 360
router.get('/trace/:code', eggController.getTraceability);

// 12. Bitácora de Eventos de Auditoría
router.get('/events', eggController.getIndustrialEvents);

// 13. Configuración de Productos
router.get('/product-config', eggController.getProductConfig);
router.put('/product-config', eggController.updateProductConfig);

// 14. Conceptos de Costos
router.get('/cost-concepts', eggController.getCostConcepts);
router.post('/cost-concepts', eggController.saveCostConcept);
router.put('/cost-concepts/:id', eggController.saveCostConcept);
router.delete('/cost-concepts/:id', eggController.deleteCostConcept);

// 15. Costos Variables por Lote
router.get('/batches/:batchId/variable-costs', eggController.getBatchVariableCosts);
router.post('/batches/:batchId/variable-costs', eggController.saveBatchVariableCost);
router.delete('/variable-costs/:id', eggController.deleteBatchVariableCost);

module.exports = router;
