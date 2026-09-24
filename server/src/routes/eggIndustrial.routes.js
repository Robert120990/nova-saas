const express = require('express');
const router = express.Router();
const eggController = require('../controllers/eggIndustrial.controller');

// 1. Recepción de Materia Prima
router.get('/raw-materials', eggController.getRawMaterials);
router.post('/raw-materials', eggController.createRawMaterial);
router.put('/raw-materials/:id', eggController.updateRawMaterial);
router.put('/raw-materials/:id/quality-classification', eggController.saveQualityClassification);
router.put('/raw-materials/:id/approve', eggController.approveRawMaterial);
router.get('/raw-materials/:id/lab-001-pdf', eggController.getRawMaterialLab001Pdf);
router.post('/raw-materials/:id/lab-001-pdf', eggController.getRawMaterialLab001Pdf);
router.get('/raw-materials/:id/origin-certificate', eggController.getOriginCertificate);
router.post('/raw-materials/:id/origin-certificate', eggController.getOriginCertificate);
router.put('/raw-materials/:id/void', eggController.voidRawMaterial);
router.delete('/raw-materials/:id', eggController.deleteRawMaterial);

// 2. CIP (Clean In Place)
router.get('/cip', eggController.getCipLogs);
router.post('/cip', eggController.createCipLog);
router.post('/cip/quick-sanitize', eggController.quickSanitizeCip);

// 3. Lotes de Producción
router.get('/batches', eggController.getProductionBatches);
router.post('/batches', eggController.createProductionBatch);
router.put('/batches/:id', eggController.updateProductionBatch);
router.delete('/batches/:id', eggController.deleteProductionBatch);
router.put('/batches/:id/complete', eggController.completeProductionBatch);
router.get('/batches/:id/stages', eggController.getBatchStages);
router.post('/batches/:id/tarimas', eggController.addTarimasToBatch);
router.post('/batches/:id/add-tarimas', eggController.addTarimasToBatch);
router.post('/batches/:id/close-packaging', eggController.closeBatchPackaging);
router.get('/batches/:id/export-summary', eggController.exportBatchSummary);

// 3.1 Mermas de Producción (Soporte dual /mermas y /wastes)
router.get('/batches/:id/mermas', eggController.getBatchWastes);
router.post('/batches/:id/mermas', eggController.createBatchWaste);
router.put('/batches/:id/mermas/:wasteId', eggController.updateBatchWaste);
router.delete('/mermas/:id', eggController.deleteBatchWaste);
router.get('/batches/:id/wastes', eggController.getBatchWastes);
router.post('/batches/:id/wastes', eggController.createBatchWaste);
router.put('/batches/:id/wastes/:wasteId', eggController.updateBatchWaste);
router.put('/wastes/:id', eggController.updateBatchWaste);
router.delete('/batches/:id/wastes/:wasteId', eggController.deleteBatchWaste);
router.delete('/wastes/:id', eggController.deleteBatchWaste);

// 3.2 Remanentes y Reprocesos
router.get('/batches/:id/remanentes', eggController.getBatchRemanentes);
router.get('/remanentes/available', eggController.getAvailableRemanentes);
router.post('/batches/:id/remanentes', eggController.createBatchRemanente);
router.put('/remanentes/:id', eggController.updateBatchRemanente);
router.put('/batches/:id/remanentes/:remanenteId', eggController.updateBatchRemanente);
router.delete('/remanentes/:id', eggController.deleteBatchRemanente);
router.delete('/batches/:id/remanentes/:remanenteId', eggController.deleteBatchRemanente);

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
router.delete('/blast-freezer/:id', eggController.deleteBlastFreezerLog);

// 8. Mantenimiento de Maquinaria
router.get('/maintenance', eggController.getMaintenanceLogs);
router.post('/maintenance', eggController.createMaintenanceLog);

// 9. Costos Operativos Industriales
router.get('/costs', eggController.getIndustrialCosts);
router.post('/costs', eggController.createIndustrialCosts);
router.get('/costs/system-sources', eggController.getCostsSystemSources);
router.post('/costs/sync-system-sources', eggController.syncCostsSystemSources);

// 10. Forecasting
router.get('/forecast', eggController.getForecasting);

// 11. Trazabilidad Bidireccional 360
router.get('/traceability-360', eggController.getTraceability360List);
router.get('/traceability-360/stats', eggController.getTraceability360Stats);
router.get('/traceability-360/detail/:type/:id', eggController.getTraceability360Detail);
router.get('/traceability-360/available-lots', eggController.getAvailableSalesLots);
router.get('/traceability-360/batch/:batchId/origin-certificate', eggController.getOriginCertificateByBatch);
router.post('/traceability-360/batch/:batchId/origin-certificate', eggController.getOriginCertificateByBatch);
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

// 14.1 Parametrización de Prefijos de Lote por Proveedor
router.get('/provider-lot-configs', eggController.getProviderLotConfigs);
router.post('/provider-lot-configs', eggController.saveProviderLotConfig);
router.delete('/provider-lot-configs/:id', eggController.deleteProviderLotConfig);
router.get('/providers/:providerId/lot-intelligence', eggController.getProviderLotIntelligence);

// 15. Costos Variables por Lote
router.get('/batches/:batchId/variable-costs', eggController.getBatchVariableCosts);
router.post('/batches/:batchId/variable-costs', eggController.saveBatchVariableCost);
router.delete('/variable-costs/:id', eggController.deleteBatchVariableCost);

const eggCosteoController = require('../controllers/eggCosteoLibra.controller');

// 16. Costeo por Libra y Simulador Comercial (Oficial ANDELSA)
router.get('/costeo-libra/actual-operational-cost', eggCosteoController.getActualOperationalCost);
router.get('/costeo-libra/config', eggCosteoController.getCostingConfig);
router.put('/costeo-libra/config', eggCosteoController.updateCostingConfig);

router.get('/costeo-libra/cip-items', eggCosteoController.getCipItems);
router.post('/costeo-libra/cip-items', eggCosteoController.saveCipItem);
router.delete('/costeo-libra/cip-items/:id', eggCosteoController.deleteCipItem);

router.get('/costeo-libra/products-lookup', eggCosteoController.getCostingProductsLookup);
router.post('/costeo-libra/sync-purchases', eggCosteoController.syncPurchasesWithInvoices);
router.get('/costeo-libra/packaging-items', eggCosteoController.getPackagingItems);
router.get('/costeo-libra/packaging', eggCosteoController.getPackagingItems);
router.post('/costeo-libra/packaging-items', eggCosteoController.savePackagingItem);
router.post('/costeo-libra/packaging', eggCosteoController.savePackagingItem);
router.delete('/costeo-libra/packaging-items/:id', eggCosteoController.deletePackagingItem);
router.delete('/costeo-libra/packaging/:id', eggCosteoController.deletePackagingItem);

router.get('/costeo-libra/customer-agreements', eggCosteoController.getCustomerAgreements);
router.get('/costeo-libra/customer-agreements/history', eggCosteoController.getAgreementHistory);
router.get('/costeo-libra/customer-agreements/:id/history', eggCosteoController.getAgreementHistory);
router.post('/costeo-libra/customer-agreements', eggCosteoController.saveCustomerAgreement);
router.delete('/costeo-libra/customer-agreements/:id', eggCosteoController.deleteCustomerAgreement);

router.post('/costeo-libra/calculate', eggCosteoController.calculateDynamicCost);

router.get('/costeo-libra/scenarios', eggCosteoController.getScenarios);
router.post('/costeo-libra/scenarios', eggCosteoController.saveScenario);
router.delete('/costeo-libra/scenarios/:id', eggCosteoController.deleteScenario);

router.get('/costeo-libra/history', eggCosteoController.getCostingHistory);

// 17. Laboratorio y Calidad Microbiológica LAB-004
router.get('/quality-parameters', eggController.getQualityParameters);
router.post('/quality-parameters', eggController.saveQualityParameter);
router.put('/quality-parameters/:id', eggController.saveQualityParameter);
router.delete('/quality-parameters/:id', eggController.deleteQualityParameter);
router.get('/lab/logs', eggController.getLabLogs);
router.get('/lab/quality-letter/:batchId/export', eggController.exportQualityLetter);
router.post('/lab/logs', eggController.createLabLog);
router.put('/lab/logs/:id', eggController.updateLabLog);
router.post('/lab/send-unified-email', eggController.sendUnifiedCoaEmail);
router.get('/lab/solids-calc', eggController.getSolidsCalculation);

// 18. Control de Retornables (Cubetas y Tapaderas)
router.get('/returnables/balances', eggController.getReturnableBalances);
router.post('/returnables/customers', eggController.saveReturnableCustomer);
router.post('/returnables/movements', eggController.registerReturnableMovement);

// 19. Calendario de Producción y Roles de Planta
router.get('/calendar', eggController.getScheduledProductions);
router.post('/calendar', eggController.createScheduledProduction);
router.put('/calendar/:id', eggController.updateScheduledProduction);
router.patch('/calendar/:id/move', eggController.moveScheduledProduction);
router.delete('/calendar/:id', eggController.deleteScheduledProduction);
router.post('/calendar/:id/start-batch', eggController.startBatchFromSchedule);
router.patch('/calendar/tasks/:taskId/toggle', eggController.toggleTaskStatus);
router.get('/calendar/suggestions', eggController.getProductionSuggestions);
router.get('/calendar/monthly-suggestions', eggController.getMonthlyProductionSuggestions);
router.post('/calendar/apply-monthly-plan', eggController.applyMonthlyPlan);
router.post('/calendar/:id/convert-julian', eggController.convertLotToJulian);

// 19.1 Planificador de Materia Prima e Insumos (MRP)
router.get('/raw-materials/planner', eggController.getRawMaterialPlanning);

// 20. Pedidos de Clientes de Ovoproductos
router.get('/orders', eggController.getEggCustomerOrders);
router.post('/orders', eggController.saveEggCustomerOrder);
router.put('/orders/:id', eggController.saveEggCustomerOrder);
router.delete('/orders/:id', eggController.deleteEggCustomerOrder);
router.get('/orders/customer-pricing', eggController.getCustomerPricingForOrder);
router.get('/orders/:id/delivery-receipt', eggController.getOrderDeliveryReceipt);

// 21. Usuarios de Planta para Roles
router.get('/factory-users', eggController.getFactoryUsers);

// 22. Despachos, Rutas, Flota y Mantenimientos de Vehículos
const eggDispatchController = require('../controllers/eggDispatch.controller');

// 22.1 Flota de Vehículos
router.get('/dispatch/vehicles', eggDispatchController.getVehicles);
router.post('/dispatch/vehicles', eggDispatchController.saveVehicle);
router.put('/dispatch/vehicles/:id', eggDispatchController.saveVehicle);
router.delete('/dispatch/vehicles/:id', eggDispatchController.deleteVehicle);

// 22.2 Mantenimiento de Vehículos
router.get('/dispatch/maintenance', eggDispatchController.getMaintenanceLogs);
router.post('/dispatch/maintenance', eggDispatchController.saveMaintenanceLog);
router.put('/dispatch/maintenance/:id', eggDispatchController.saveMaintenanceLog);
router.delete('/dispatch/maintenance/:id', eggDispatchController.deleteMaintenanceLog);

// 22.3 Rutas de Despacho y Paradas
router.get('/dispatch/routes', eggDispatchController.getDispatchRoutes);
router.get('/dispatch/routes/:id', eggDispatchController.getDispatchRouteDetail);
router.get('/dispatch/routes/:id/manifest-pdf', eggDispatchController.getDispatchRouteManifestPdf);
router.post('/dispatch/routes', eggDispatchController.saveDispatchRoute);
router.put('/dispatch/routes/:id', eggDispatchController.saveDispatchRoute);
router.delete('/dispatch/routes/:id', eggDispatchController.deleteDispatchRoute);
router.put('/dispatch/routes/:id/reorder', eggDispatchController.reorderRouteStops);
router.post('/dispatch/routes/:id/optimize', eggDispatchController.optimizeRouteStops);
router.delete('/dispatch/routes/:id/stops/:stop_id', eggDispatchController.removeStopFromRoute);
router.post('/dispatch/routes/:id/auto-invoice', eggDispatchController.autoInvoiceDispatchRoute);

// 22.4 Modo Motorista, DTE y Confirmación de Entregas con GPS
router.get('/dispatch/my-routes', eggDispatchController.getMyDriverRoutes);
router.get('/dispatch/search-dte-orders', eggDispatchController.searchDteOrActiveOrders);
router.post('/dispatch/stops/:stop_id/confirm', eggDispatchController.confirmStopDelivery);
router.put('/dispatch/branches/:branch_id/location', eggDispatchController.updateCustomerBranchLocation);
router.get('/dispatch/customer-branches', eggDispatchController.getCustomerBranches);

// 23. Reportes de Huevo Industrial
router.get('/reports/raw-materials', eggController.getRawMaterialsReport);
router.get('/reports/production', eggController.getProductionReport);
router.get('/reports/packaging', eggController.getPackagingReport);
router.get('/reports/quality', eggController.getQualityReport);
router.get('/reports/wastes', eggController.getWastesReport);

// 24. Vinculación de Códigos de Catálogo (Mapeo de Productos)
router.get('/code-mappings', eggController.getCodeMappings);
router.post('/code-mappings', eggController.saveCodeMapping);
router.put('/code-mappings/:id', eggController.saveCodeMapping);
router.delete('/code-mappings/:id', eggController.deleteCodeMapping);

// 25. Inventario Traducido de Huevo Industrial
router.get('/inventory-translated', eggController.getTranslatedInventory);
// 26. Metas, Comisiones y Simulador con Tope ($1,000) e Integración a Planilla
const eggCommissionsController = require('../controllers/eggCommissions.controller');
router.get('/commissions/simulate', eggCommissionsController.simulateCommission);
router.post('/commissions/simulate', eggCommissionsController.simulateCommission);
router.get('/commissions/sellers-employees', eggCommissionsController.getSellersAndEmployees);
router.post('/commissions/link-seller-employee', eggCommissionsController.linkSellerToEmployee);
router.get('/commissions/goals', eggCommissionsController.getSellerGoals);
router.post('/commissions/goals', eggCommissionsController.saveSellerGoal);
router.post('/commissions/calculate', eggCommissionsController.calculatePeriodCommissions);
router.post('/commissions/create-seller', eggCommissionsController.createEggSeller);
router.post('/commissions/remove-seller', eggCommissionsController.removeEggSeller);
router.post('/commissions/transfer-to-payroll', eggCommissionsController.transferCommissionToPayroll);
router.get('/commissions/summary', eggCommissionsController.getCommissionsSummary);

module.exports = router;

