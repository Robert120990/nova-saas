const express = require('express');
const router = express.Router();
const permit = require('../middlewares/eggPermission');
const eggController = require('../controllers/eggIndustrial.controller');
router.use(require('../middlewares/eggReferences'));

// 1. Recepción de Materia Prima
router.get('/raw-materials', permit('manage_mp_reception', 'manage_production', 'manage_egg_quality', 'view_egg_reports'), eggController.getRawMaterials);
router.post('/raw-materials', permit('manage_mp_reception'), eggController.createRawMaterial);
router.put('/raw-materials/:id', permit('manage_mp_reception'), eggController.updateRawMaterial);
router.put('/raw-materials/:id/quality-classification', permit('manage_egg_quality'), eggController.saveQualityClassification);
router.put('/raw-materials/:id/approve', permit('manage_egg_quality'), eggController.approveRawMaterial);
router.get('/raw-materials/:id/lab-001-pdf', permit('manage_mp_reception', 'manage_production', 'manage_egg_quality', 'view_egg_reports'), eggController.getRawMaterialLab001Pdf);
router.post('/raw-materials/:id/lab-001-pdf', permit('manage_mp_reception'), eggController.getRawMaterialLab001Pdf);
router.get('/raw-materials/:id/origin-certificate', permit('manage_mp_reception', 'manage_production', 'manage_egg_quality', 'view_egg_reports'), eggController.getOriginCertificate);
router.post('/raw-materials/:id/origin-certificate', permit('manage_mp_reception'), eggController.getOriginCertificate);
router.put('/raw-materials/:id/void', permit('manage_mp_reception'), eggController.voidRawMaterial);
router.delete('/raw-materials/:id', permit('manage_mp_reception'), eggController.deleteRawMaterial);

// 2. CIP (Clean In Place)
router.get('/cip', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getCipLogs);
router.post('/cip', permit('manage_production'), eggController.createCipLog);
router.post('/cip/quick-sanitize', permit('manage_production'), eggController.quickSanitizeCip);
router.delete('/cip/:id', permit('manage_production'), eggController.deleteCipLog);

// 3. Lotes de Producción
router.get('/batches', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getProductionBatches);
router.post('/batches', permit('manage_production'), eggController.createProductionBatch);
router.put('/batches/:id', permit('manage_production'), eggController.updateProductionBatch);
router.delete('/batches/:id', permit('manage_production'), eggController.deleteProductionBatch);
router.put('/batches/:id/complete', permit('manage_production'), eggController.completeProductionBatch);
router.get('/batches/:id/stages', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getBatchStages);
router.post('/batches/:id/tarimas', permit('manage_production'), eggController.addTarimasToBatch);
router.post('/batches/:id/add-tarimas', permit('manage_production'), eggController.addTarimasToBatch);
router.post('/batches/:id/close-packaging', permit('manage_egg_packaging_close'), eggController.closeBatchPackaging);
router.post('/batches/:id/reopen-packaging', permit('manage_egg_production_lots'), eggController.reopenBatchPackaging);
router.post('/batches/:id/close-pasteurization', permit('manage_egg_production_lots'), eggController.closePasteurization);
router.post('/batches/:id/reopen-pasteurization', permit('manage_egg_production_lots'), eggController.reopenPasteurization);
router.get('/batches/:id/export-summary', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.exportBatchSummary);

// 3.1 Mermas de Producción (Soporte dual /mermas y /wastes)
router.get('/batches/:id/mermas', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getBatchWastes);
router.post('/batches/:id/mermas', permit('manage_production'), eggController.createBatchWaste);
router.put('/batches/:id/mermas/:wasteId', permit('manage_production'), eggController.updateBatchWaste);
router.delete('/mermas/:id', permit('manage_production'), eggController.deleteBatchWaste);
router.get('/batches/:id/wastes', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getBatchWastes);
router.post('/batches/:id/wastes', permit('manage_production'), eggController.createBatchWaste);
router.put('/batches/:id/wastes/:wasteId', permit('manage_production'), eggController.updateBatchWaste);
router.put('/wastes/:id', permit('manage_production'), eggController.updateBatchWaste);
router.delete('/batches/:id/wastes/:wasteId', permit('manage_production'), eggController.deleteBatchWaste);
router.delete('/wastes/:id', permit('manage_production'), eggController.deleteBatchWaste);

// 3.2 Remanentes y Reprocesos
router.get('/batches/:id/remanentes', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getBatchRemanentes);
router.get('/remanentes/available', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getAvailableRemanentes);
router.post('/batches/:id/remanentes', permit('manage_production'), eggController.createBatchRemanente);
router.put('/remanentes/:id', permit('manage_production'), eggController.updateBatchRemanente);
router.put('/batches/:id/remanentes/:remanenteId', permit('manage_production'), eggController.updateBatchRemanente);
router.delete('/remanentes/:id', permit('manage_production'), eggController.deleteBatchRemanente);
router.delete('/batches/:id/remanentes/:remanenteId', permit('manage_production'), eggController.deleteBatchRemanente);

// 4. Pasteurización
router.post('/pasteurize', permit('manage_production'), eggController.createPasteurizationLog);

// 5. Holding y Cold Chain
router.get('/holding-temps', permit('manage_production', 'manage_packaging', 'manage_egg_quality', 'manage_production_calendar', 'view_egg_reports', 'manage_industrial_costs'), eggController.getHoldingTemperatures);
router.post('/holding-temps', permit('manage_production'), eggController.createHoldingTemperature);

// 6. Empaque Final
router.get('/packaging', permit('manage_packaging', 'manage_production', 'manage_egg_quality', 'manage_egg_dispatch'), eggController.getPackagingRecords);
router.post('/packaging', permit('manage_packaging'), eggController.createPackagingRecord);
router.put('/packaging/:id', permit('manage_packaging'), eggController.updatePackagingRecord);
router.delete('/packaging/:id', permit('manage_packaging'), eggController.deletePackagingRecord);

// 7. Blast Freezer
router.get('/blast-freezer', permit('manage_packaging', 'manage_production', 'manage_egg_quality', 'manage_egg_dispatch'), eggController.getBlastFreezerLogs);
router.post('/blast-freezer', permit('manage_packaging'), eggController.createBlastFreezerLog);
router.delete('/blast-freezer/:id', permit('manage_packaging'), eggController.deleteBlastFreezerLog);

// 8. Mantenimiento de Maquinaria
router.get('/maintenance', permit('manage_industrial_costs'), eggController.getMaintenanceLogs);
router.post('/maintenance', permit('manage_industrial_costs'), eggController.createMaintenanceLog);

// 9. Costos Operativos Industriales
router.get('/costs', permit('manage_industrial_costs'), eggController.getIndustrialCosts);
router.post('/costs', permit('manage_industrial_costs'), eggController.createIndustrialCosts);
router.get('/costs/system-sources', permit('manage_industrial_costs'), eggController.getCostsSystemSources);
router.post('/costs/sync-system-sources', permit('manage_industrial_costs'), eggController.syncCostsSystemSources);

// 10. Forecasting
router.get('/forecast', permit('manage_industrial_costs', 'manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getForecasting);

// 11. Trazabilidad Bidireccional 360
router.get('/traceability-360', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getTraceability360List);
router.get('/traceability-360/stats', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getTraceability360Stats);
router.get('/traceability-360/detail/:type/:id', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getTraceability360Detail);
router.get('/traceability-360/available-lots', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getAvailableSalesLots);
router.get('/traceability-360/batch/:batchId/origin-certificate', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getOriginCertificateByBatch);
router.post('/traceability-360/batch/:batchId/origin-certificate', permit('manage_traceability'), eggController.getOriginCertificateByBatch);
router.get('/trace/:code', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getTraceability);

// 12. Bitácora de Eventos de Auditoría
router.get('/events', permit('manage_traceability', 'manage_production', 'manage_packaging', 'manage_egg_dispatch', 'view_industrial_dashboard'), eggController.getIndustrialEvents);

// 13. Configuración de Productos
router.get('/product-config', permit('manage_industrial_settings', 'manage_production', 'manage_packaging', 'manage_mp_reception', 'view_egg_inventory', 'manage_egg_dispatch'), eggController.getProductConfig);
router.put('/product-config', permit('manage_industrial_settings'), eggController.updateProductConfig);

// 14. Conceptos de Costos
router.get('/cost-concepts', permit('manage_industrial_costs'), eggController.getCostConcepts);
router.post('/cost-concepts', permit('manage_industrial_costs'), eggController.saveCostConcept);
router.put('/cost-concepts/:id', permit('manage_industrial_costs'), eggController.saveCostConcept);
router.delete('/cost-concepts/:id', permit('manage_industrial_costs'), eggController.deleteCostConcept);

// 14.1 Parametrización de Prefijos de Lote por Proveedor
router.get('/provider-lot-configs', permit('manage_industrial_settings', 'manage_production', 'manage_packaging', 'manage_mp_reception', 'view_egg_inventory', 'manage_egg_dispatch'), eggController.getProviderLotConfigs);
router.post('/provider-lot-configs', permit('manage_industrial_settings'), eggController.saveProviderLotConfig);
router.delete('/provider-lot-configs/:id', permit('manage_industrial_settings'), eggController.deleteProviderLotConfig);
router.get('/providers/:providerId/lot-intelligence', permit('manage_mp_reception', 'manage_production', 'manage_egg_quality', 'view_egg_reports'), eggController.getProviderLotIntelligence);

// 15. Costos Variables por Lote
router.get('/batches/:batchId/variable-costs', permit('manage_industrial_costs'), eggController.getBatchVariableCosts);
router.post('/batches/:batchId/variable-costs', permit('manage_industrial_costs'), eggController.saveBatchVariableCost);
router.delete('/variable-costs/:id', permit('manage_industrial_costs'), eggController.deleteBatchVariableCost);

const eggCosteoController = require('../controllers/eggCosteoLibra.controller');

// 16. Costeo por Libra y Simulador Comercial (Oficial ANDELSA)
router.get('/costeo-libra/actual-operational-cost', permit('manage_industrial_costeo_libra'), eggCosteoController.getActualOperationalCost);
router.get('/costeo-libra/config', permit('manage_industrial_costeo_libra'), eggCosteoController.getCostingConfig);
router.put('/costeo-libra/config', permit('manage_industrial_costeo_libra'), eggCosteoController.updateCostingConfig);

router.get('/costeo-libra/cip-items', permit('manage_industrial_costeo_libra'), eggCosteoController.getCipItems);
router.post('/costeo-libra/cip-items', permit('manage_industrial_costeo_libra'), eggCosteoController.saveCipItem);
router.delete('/costeo-libra/cip-items/:id', permit('manage_industrial_costeo_libra'), eggCosteoController.deleteCipItem);

router.get('/costeo-libra/products-lookup', permit('manage_industrial_costeo_libra'), eggCosteoController.getCostingProductsLookup);
router.post('/costeo-libra/sync-purchases', permit('manage_industrial_costeo_libra'), eggCosteoController.syncPurchasesWithInvoices);
router.get('/costeo-libra/packaging-items', permit('manage_industrial_costeo_libra'), eggCosteoController.getPackagingItems);
router.get('/costeo-libra/packaging', permit('manage_industrial_costeo_libra'), eggCosteoController.getPackagingItems);
router.post('/costeo-libra/packaging-items', permit('manage_industrial_costeo_libra'), eggCosteoController.savePackagingItem);
router.post('/costeo-libra/packaging', permit('manage_industrial_costeo_libra'), eggCosteoController.savePackagingItem);
router.delete('/costeo-libra/packaging-items/:id', permit('manage_industrial_costeo_libra'), eggCosteoController.deletePackagingItem);
router.delete('/costeo-libra/packaging/:id', permit('manage_industrial_costeo_libra'), eggCosteoController.deletePackagingItem);

router.get('/costeo-libra/customer-agreements', permit('manage_industrial_costeo_libra'), eggCosteoController.getCustomerAgreements);
router.get('/costeo-libra/customer-agreements/history', permit('manage_industrial_costeo_libra'), eggCosteoController.getAgreementHistory);
router.get('/costeo-libra/customer-agreements/:id/history', permit('manage_industrial_costeo_libra'), eggCosteoController.getAgreementHistory);
router.post('/costeo-libra/customer-agreements', permit('manage_industrial_costeo_libra'), eggCosteoController.saveCustomerAgreement);
router.delete('/costeo-libra/customer-agreements/:id', permit('manage_industrial_costeo_libra'), eggCosteoController.deleteCustomerAgreement);

router.post('/costeo-libra/calculate', permit('manage_industrial_costeo_libra'), eggCosteoController.calculateDynamicCost);

router.get('/costeo-libra/scenarios', permit('manage_industrial_costeo_libra'), eggCosteoController.getScenarios);
router.post('/costeo-libra/scenarios', permit('manage_industrial_costeo_libra'), eggCosteoController.saveScenario);
router.delete('/costeo-libra/scenarios/:id', permit('manage_industrial_costeo_libra'), eggCosteoController.deleteScenario);

router.get('/costeo-libra/history', permit('manage_industrial_costeo_libra'), eggCosteoController.getCostingHistory);

// 17. Laboratorio y Calidad Microbiológica LAB-004
router.get('/quality-parameters', permit('manage_egg_quality', 'manage_industrial_settings'), eggController.getQualityParameters);
router.post('/quality-parameters', permit('manage_industrial_settings'), eggController.saveQualityParameter);
router.put('/quality-parameters/:id', permit('manage_industrial_settings'), eggController.saveQualityParameter);
router.delete('/quality-parameters/:id', permit('manage_industrial_settings'), eggController.deleteQualityParameter);
router.get('/lab/logs', permit('manage_egg_quality', 'manage_traceability'), eggController.getLabLogs);
router.get('/lab/quality-letter/:batchId/export', permit('manage_egg_quality', 'manage_traceability'), eggController.exportQualityLetter);
router.get('/lab/export-mario', permit('manage_egg_quality', 'manage_traceability'), eggController.exportMarioQualityExcel);
router.post('/lab/logs', permit('manage_egg_quality'), eggController.createLabLog);
router.put('/lab/logs/:id', permit('manage_egg_quality'), eggController.updateLabLog);
router.post('/lab/send-unified-email', permit('manage_egg_quality'), eggController.sendUnifiedCoaEmail);
router.get('/lab/solids-calc', permit('manage_egg_quality', 'manage_traceability'), eggController.getSolidsCalculation);

// 18. Control de Retornables (Cubetas y Tapaderas)
router.get('/returnables/balances', permit('manage_egg_returnables'), eggController.getReturnableBalances);
router.get('/returnables/customers/:id/statement', permit('manage_egg_returnables'), eggController.getReturnableCustomerStatement);
router.post('/returnables/customers', permit('manage_egg_returnables'), eggController.saveReturnableCustomer);
router.post('/returnables/movements', permit('manage_egg_returnables'), eggController.registerReturnableMovement);
router.post('/returnables/sync-sales', permit('manage_egg_returnables'), eggController.syncReturnablesFromSales);

// 19. Calendario de Producción y Roles de Planta
router.get('/calendar', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getScheduledProductions);
router.post('/calendar', permit('manage_production_calendar'), eggController.createScheduledProduction);
router.put('/calendar/:id', permit('manage_production_calendar'), eggController.updateScheduledProduction);
router.patch('/calendar/:id/move', permit('manage_production_calendar'), eggController.moveScheduledProduction);
router.delete('/calendar/:id', permit('manage_production_calendar'), eggController.deleteScheduledProduction);
router.post('/calendar/:id/start-batch', permit('manage_production_calendar'), eggController.startBatchFromSchedule);
router.patch('/calendar/tasks/:taskId/toggle', permit('manage_production_calendar'), eggController.toggleTaskStatus);
router.get('/calendar/suggestions', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getProductionSuggestions);
router.get('/calendar/monthly-suggestions', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getMonthlyProductionSuggestions);
router.post('/calendar/apply-monthly-plan', permit('manage_production_calendar'), eggController.applyMonthlyPlan);
router.post('/calendar/:id/convert-julian', permit('manage_production_calendar'), eggController.convertLotToJulian);

// 19.1 Planificador de Materia Prima e Insumos (MRP)
router.get('/raw-materials/planner', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getRawMaterialPlanning);

// 20. Pedidos de Clientes de Ovoproductos
router.get('/orders', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getEggCustomerOrders);
router.post('/orders', permit('manage_production_calendar'), eggController.saveEggCustomerOrder);
router.put('/orders/:id', permit('manage_production_calendar'), eggController.saveEggCustomerOrder);
router.delete('/orders/:id', permit('manage_production_calendar'), eggController.deleteEggCustomerOrder);
router.get('/orders/customer-pricing', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getCustomerPricingForOrder);
router.get('/orders/:id/delivery-receipt', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getOrderDeliveryReceipt);

// 21. Usuarios de Planta para Roles
router.get('/factory-users', permit('manage_production_calendar', 'manage_production', 'manage_egg_dispatch'), eggController.getFactoryUsers);

// 22. Despachos, Rutas, Flota y Mantenimientos de Vehículos
const eggDispatchController = require('../controllers/eggDispatch.controller');

// 22.1 Flota de Vehículos
router.get('/dispatch/vehicles', permit('manage_egg_dispatch'), eggDispatchController.getVehicles);
router.post('/dispatch/vehicles', permit('manage_egg_dispatch'), eggDispatchController.saveVehicle);
router.put('/dispatch/vehicles/:id', permit('manage_egg_dispatch'), eggDispatchController.saveVehicle);
router.delete('/dispatch/vehicles/:id', permit('manage_egg_dispatch'), eggDispatchController.deleteVehicle);

// 22.2 Mantenimiento de Vehículos
router.get('/dispatch/maintenance', permit('manage_egg_dispatch'), eggDispatchController.getMaintenanceLogs);
router.post('/dispatch/maintenance', permit('manage_egg_dispatch'), eggDispatchController.saveMaintenanceLog);
router.put('/dispatch/maintenance/:id', permit('manage_egg_dispatch'), eggDispatchController.saveMaintenanceLog);
router.delete('/dispatch/maintenance/:id', permit('manage_egg_dispatch'), eggDispatchController.deleteMaintenanceLog);

// 22.3 Rutas de Despacho y Paradas
router.get('/dispatch/routes', permit('manage_egg_dispatch'), eggDispatchController.getDispatchRoutes);
router.get('/dispatch/routes/:id', permit('manage_egg_dispatch'), eggDispatchController.getDispatchRouteDetail);
router.get('/dispatch/routes/:id/manifest-pdf', permit('manage_egg_dispatch'), eggDispatchController.getDispatchRouteManifestPdf);
router.post('/dispatch/routes', permit('manage_egg_dispatch'), eggDispatchController.saveDispatchRoute);
router.put('/dispatch/routes/:id', permit('manage_egg_dispatch'), eggDispatchController.saveDispatchRoute);
router.delete('/dispatch/routes/:id', permit('manage_egg_dispatch'), eggDispatchController.deleteDispatchRoute);
router.put('/dispatch/routes/:id/reorder', permit('manage_egg_dispatch'), eggDispatchController.reorderRouteStops);
router.post('/dispatch/routes/:id/optimize', permit('manage_egg_dispatch'), eggDispatchController.optimizeRouteStops);
router.delete('/dispatch/routes/:id/stops/:stop_id', permit('manage_egg_dispatch'), eggDispatchController.removeStopFromRoute);
router.post('/dispatch/routes/:id/auto-invoice', permit('manage_egg_dispatch'), eggDispatchController.autoInvoiceDispatchRoute);

// 22.4 Modo Motorista, DTE y Confirmación de Entregas con GPS
router.get('/dispatch/my-routes', permit('manage_egg_dispatch'), eggDispatchController.getMyDriverRoutes);
router.get('/dispatch/search-dte-orders', permit('manage_egg_dispatch'), eggDispatchController.searchDteOrActiveOrders);
router.post('/dispatch/stops/:stop_id/confirm', permit('manage_egg_dispatch'), eggDispatchController.confirmStopDelivery);
router.put('/dispatch/branches/:branch_id/location', permit('manage_egg_dispatch'), eggDispatchController.updateCustomerBranchLocation);
router.get('/dispatch/customer-branches', permit('manage_egg_dispatch'), eggDispatchController.getCustomerBranches);

// 23. Reportes de Huevo Industrial
router.get('/reports/raw-materials', permit('view_egg_reports'), eggController.getRawMaterialsReport);
router.get('/reports/production', permit('view_egg_reports'), eggController.getProductionReport);
router.get('/reports/packaging', permit('view_egg_reports'), eggController.getPackagingReport);
router.get('/reports/quality', permit('view_egg_reports'), eggController.getQualityReport);
router.get('/reports/wastes', permit('view_egg_reports'), eggController.getWastesReport);

// 24. Vinculación de Códigos de Catálogo (Mapeo de Productos)
router.get('/code-mappings', permit('manage_industrial_settings', 'manage_production', 'manage_packaging', 'manage_mp_reception', 'view_egg_inventory', 'manage_egg_dispatch'), eggController.getCodeMappings);
router.post('/code-mappings', permit('manage_industrial_settings'), eggController.saveCodeMapping);
router.put('/code-mappings/:id', permit('manage_industrial_settings'), eggController.saveCodeMapping);
router.delete('/code-mappings/:id', permit('manage_industrial_settings'), eggController.deleteCodeMapping);

// 25. Inventario Traducido de Huevo Industrial
router.get('/inventory-translated/export', permit('view_egg_inventory'), eggController.exportTranslatedInventory);
router.get('/inventory-translated', permit('view_egg_inventory'), eggController.getTranslatedInventory);
// 26. Metas, Comisiones y Simulador con Tope ($1,000) e Integración a Planilla
const eggCommissionsController = require('../controllers/eggCommissions.controller');
router.get('/commissions/simulate', permit('manage_egg_commissions'), eggCommissionsController.simulateCommission);
router.post('/commissions/simulate', permit('manage_egg_commissions'), eggCommissionsController.simulateCommission);
router.get('/commissions/sellers-employees', permit('manage_egg_commissions'), eggCommissionsController.getSellersAndEmployees);
router.post('/commissions/link-seller-employee', permit('manage_egg_commissions'), eggCommissionsController.linkSellerToEmployee);
router.get('/commissions/goals', permit('manage_egg_commissions'), eggCommissionsController.getSellerGoals);
router.post('/commissions/goals', permit('manage_egg_commissions'), eggCommissionsController.saveSellerGoal);
router.post('/commissions/calculate', permit('manage_egg_commissions'), eggCommissionsController.calculatePeriodCommissions);
router.post('/commissions/create-seller', permit('manage_egg_commissions'), eggCommissionsController.createEggSeller);
router.post('/commissions/remove-seller', permit('manage_egg_commissions'), eggCommissionsController.removeEggSeller);
router.post('/commissions/transfer-to-payroll', permit('manage_egg_commissions'), eggCommissionsController.transferCommissionToPayroll);
router.get('/commissions/summary', permit('manage_egg_commissions'), eggCommissionsController.getCommissionsSummary);

const eggEmission = require('../controllers/eggIndustrial/eggEmission.controller');
router.get('/dispatch/emissions/:saleId', permit('manage_egg_dispatch'), eggEmission.getEmission);
router.post('/dispatch/emissions/:saleId/recover', permit('manage_egg_dispatch'), eggEmission.recoverEmission);
module.exports = router;
