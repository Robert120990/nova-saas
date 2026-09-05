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

const eggCosteoController = require('../controllers/eggCosteoLibra.controller');

// 16. Costeo por Libra y Simulador Comercial (Oficial ANDELSA)
router.get('/costeo-libra/config', eggCosteoController.getCostingConfig);
router.put('/costeo-libra/config', eggCosteoController.updateCostingConfig);

router.get('/costeo-libra/cip-items', eggCosteoController.getCipItems);
router.post('/costeo-libra/cip-items', eggCosteoController.saveCipItem);
router.delete('/costeo-libra/cip-items/:id', eggCosteoController.deleteCipItem);

router.get('/costeo-libra/packaging-items', eggCosteoController.getPackagingItems);
router.post('/costeo-libra/packaging-items', eggCosteoController.savePackagingItem);
router.delete('/costeo-libra/packaging-items/:id', eggCosteoController.deletePackagingItem);

router.get('/costeo-libra/customer-agreements', eggCosteoController.getCustomerAgreements);
router.post('/costeo-libra/customer-agreements', eggCosteoController.saveCustomerAgreement);
router.delete('/costeo-libra/customer-agreements/:id', eggCosteoController.deleteCustomerAgreement);

router.post('/costeo-libra/calculate', eggCosteoController.calculateDynamicCost);

router.get('/costeo-libra/scenarios', eggCosteoController.getScenarios);
router.post('/costeo-libra/scenarios', eggCosteoController.saveScenario);
router.delete('/costeo-libra/scenarios/:id', eggCosteoController.deleteScenario);

router.get('/costeo-libra/history', eggCosteoController.getCostingHistory);

// 17. Laboratorio y Calidad Microbiológica LAB-004
router.get('/lab/logs', eggController.getLabLogs);
router.post('/lab/logs', eggController.createLabLog);
router.get('/lab/solids-calc', eggController.getSolidsCalculation);

// 18. Control de Retornables (Cubetas y Tapaderas)
router.get('/returnables/balances', eggController.getReturnableBalances);
router.post('/returnables/customers', eggController.saveReturnableCustomer);
router.post('/returnables/movements', eggController.registerReturnableMovement);

module.exports = router;
