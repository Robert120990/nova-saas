const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const upload = require('../config/upload');

// Import Controllers
const companyController = require('../controllers/company.controller');
const branchController = require('../controllers/branch.controller');
const posController = require('../controllers/pos.controller');
const sellerController = require('../controllers/seller.controller');
const customerController = require('../controllers/customer.controller');
const categoryController = require('../controllers/category.controller');
const productController = require('../controllers/product.controller');
const userController = require('../controllers/user.controller');
const roleController = require('../controllers/role.controller');
const menuItemController = require('../controllers/menuItem.controller');
const providerController = require('../controllers/provider.controller');
const catalogController = require('../controllers/catalog.controller');
const smtpController = require('../controllers/smtp.controller');
const settingsController = require('../controllers/settings.controller');
const aiRoutes = require('./ai.routes');
const inventoryController = require('../controllers/inventory.controller');
const inventoryAdjustmentController = require('../controllers/inventoryAdjustment.controller');
const inventoryScanController = require('../controllers/inventoryScan.controller');
const purchaseController = require('../controllers/purchase.controller');
const salesController = require('../controllers/sales.controller');
const salesConfigController = require('../controllers/salesConfig.controller');
const periodController = require('../controllers/period.controller');
const dashboardController = require('../controllers/dashboard.controller');
const shiftController = require('../controllers/shift.controller');
const comboController = require('../controllers/combo.controller');
const vatBooksController = require('../controllers/vatBooks.controller');
const customerDiscountController = require('../controllers/customerDiscount.controller');
const customerBranchController = require('../controllers/customerBranch.controller');
const discountRulesController = require('../controllers/discountRules.controller');
const accountingController = require('../controllers/accounting.controller');
const accountingReportsController = require('../controllers/accounting.reports.controller');
const cxcController = require('../controllers/cxc.controller');
const expenseController = require('../controllers/expense.controller');
const taxRoutes = require('./tax.routes');
const auditController = require('../controllers/audit.controller');
const rhAfpController = require('../controllers/rhAfp.controller');
const rhCargoController = require('../controllers/rhCargo.controller');
const rhDescuentoController = require('../controllers/rhDescuentoProgramado.controller');
const rhDepartamentoController = require('../controllers/rhDepartamento.controller');
const rhAfpTasaController = require('../controllers/rhAfpTasa.controller');
const rhIsssTasaController = require('../controllers/rhIsssTasa.controller');
const rhRentaConfigController = require('../controllers/rhRentaConfig.controller');
const rhAguinaldoConfigController = require('../controllers/rhAguinaldoConfig.controller');
const rhSalarioMinimoController = require('../controllers/rhSalarioMinimo.controller');
const rhTipoContratoController = require('../controllers/rhTipoContrato.controller');
const rhEmpleadoController = require('../controllers/rhEmpleado.controller');
const rhConfigController = require('../controllers/rhConfig.controller');
const rhPlanillaVacacionesController = require('../controllers/rhPlanillaVacaciones.controller');
const rhPlanillaLiquidacionesController = require('../controllers/rhPlanillaLiquidaciones.controller');
const rhHonorariosController = require('../controllers/rhHonorarios.controller');
const rhPlanillaAguinaldosController = require('../controllers/rhPlanillaAguinaldos.controller');
const rhCuentaPlanillaController = require('../controllers/rhCuentaPlanilla.controller');
const rhPlanillaController = require('../controllers/rhPlanilla.controller');
const changelogController = require('../controllers/changelog.controller');

// Gas Station Controllers
const gasDistributorController = require('../controllers/gasDistributor.controller');
const islandController = require('../controllers/island.controller');
const nozzleController = require('../controllers/nozzle.controller');
const tankController = require('../controllers/tank.controller');
const gasCloseoutController = require('../controllers/gasCloseout.controller');
const gasConfigController = require('../controllers/gasConfig.controller');
const gasDespachadorController = require('../controllers/gasDespachador.controller');
const gasPosTypeController = require('../controllers/gasPosType.controller');
const gasAdvanceController = require('../controllers/gasAdvance.controller');
const gasReporteController = require('../controllers/gasReporte.controller');
const gasRemesaDeliveryController = require('../controllers/gasRemesaDelivery.controller');
const salesRemesaDeliveryController = require('../controllers/salesRemesaDelivery.controller');
const pozoController = require('../controllers/pozo.controller');

// Notification Routes
const notificationRoutes = require('./notification.routes');
const whatsappRoutes = require('./whatsapp.routes');

// Public routes
router.get('/settings/public', settingsController.getPublicSettings);
router.get('/public/dte/:codigo/pdf', salesController.getPublicRTEE);
router.get('/public/dte/:codigo/info', salesController.getPublicDTEInfo);
router.get('/public/dte/:codigo/json', salesController.getPublicDTEJson);
router.post('/public/dte/:codigo/send-email', salesController.sendPublicDTEEmail);

// Public scan routes (no auth required - accessed via QR token)
router.get('/inventory/scan/:token', inventoryScanController.getScanSession);
router.post('/inventory/scan/:token/submit', inventoryScanController.submitScan);

// Routes
router.use(verifyToken);

// Purchase Period (Top priority)
router.get('/period-purchases', periodController.getPurchasePeriod);
router.post('/period-purchases', periodController.savePurchasePeriod);

router.get('/test-db', async (req, res) => {
    try {
        const [rows] = await require('../config/db').query('SELECT 1 as test');
        res.json({ status: 'OK', data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/catalogs/departments', catalogController.getDepartments);
router.get('/catalogs/municipalities', catalogController.getMunicipalities);
router.get('/catalogs/actividades', catalogController.getActividades);
router.get('/catalogs/districts', catalogController.getDistritos);
router.get('/catalogs/:table', catalogController.getGenericCatalog);

// New Global User Access Routes (After verifyToken but before tenantMiddleware)
router.get('/all-users', userController.getAllUsers);
router.get('/users/access-summary', userController.getAccessSummary);
router.post('/users/assign-access', userController.assignCompanyAccess);
router.delete('/users/access/:userId/:companyId', userController.deleteCompanyAccess);
router.get('/companies', companyController.getCompanies);
router.post('/companies', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'certificate', maxCount: 1 }, { name: 'certificate_crt', maxCount: 1 }]), companyController.createCompany);
router.put('/companies/:id', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'certificate', maxCount: 1 }, { name: 'certificate_crt', maxCount: 1 }]), companyController.updateCompany);
router.delete('/companies/:id', companyController.deleteCompany);

router.get('/users', userController.getUsers);
router.post('/users', userController.createUser);
router.put('/users/me', userController.updateProfile);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);

// Connected users (before tenant for cross-branch visibility)
router.get('/users/connected', userController.getConnectedSessions);
router.post('/users/sessions/:id/terminate', userController.terminateSession);

// Changelog (global, no tenant scope)
router.get('/changelog', changelogController.getChangelog);

// Multi-tenant scoped routes
router.use(tenantMiddleware);
router.use(require('../middlewares/audit'));

// Security (Roles & Users)
router.get('/roles', roleController.getRoles);
router.post('/roles', roleController.createRole);
router.put('/roles/:id', roleController.updateRole);
router.delete('/roles/:id', roleController.deleteRole);

// Menu Items
router.get('/menu-items', verifyToken, menuItemController.getMenuItems);
router.get('/menu-items/permissions', verifyToken, menuItemController.getPermissions);
router.post('/menu-items', verifyToken, checkPermission('manage_menu'), menuItemController.createMenuItem);
router.put('/menu-items/reorder', verifyToken, checkPermission('manage_menu'), menuItemController.reorderMenuItems);
router.put('/menu-items/:id', verifyToken, checkPermission('manage_menu'), menuItemController.updateMenuItem);
router.delete('/menu-items/:id', verifyToken, checkPermission('manage_menu'), menuItemController.deleteMenuItem);

// Audit Log (Bitácora del Sistema)
router.get('/audit-log', auditController.getLogs);
router.get('/audit-log/types', auditController.getEntityTypes);
router.get('/audit-log/:id', auditController.getLogById);

// Branches
router.get('/branches', branchController.getBranches);
router.post('/branches', upload.single('logo'), branchController.createBranch);
router.put('/branches/:id', upload.single('logo'), branchController.updateBranch);
router.delete('/branches/:id', branchController.deleteBranch);

// POS
router.get('/pos', posController.getPOS);
router.post('/pos', posController.createPOS);
router.put('/pos/:id', posController.updatePOS);
router.delete('/pos/:id', posController.deletePOS);

// Sellers
router.get('/sellers', sellerController.getSellers);
router.post('/sellers', sellerController.createSeller);
router.post('/sellers/login-pos', sellerController.loginPos);
router.put('/sellers/:id', sellerController.updateSeller);
router.delete('/sellers/:id', sellerController.deleteSeller);

// Customers
router.get('/customers', customerController.getCustomers);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.delete('/customers/batch', checkPermission('manage_customers_batch_delete'), customerController.deleteBatchCustomers);
router.delete('/customers/:id', customerController.deleteCustomer);

// Customer Branches (Sucursales)
router.get('/customer-branches', customerBranchController.getBranches);
router.post('/customer-branches', customerBranchController.createBranch);
router.put('/customer-branches/:id', customerBranchController.updateBranch);
router.delete('/customer-branches/:id', customerBranchController.deleteBranch);

// Providers
router.get('/providers', providerController.getProviders);
router.post('/providers', providerController.createProvider);
router.put('/providers/:id', providerController.updateProvider);
router.delete('/providers/:id', providerController.deleteProvider);

// Categories
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Products
router.get('/products', productController.getProducts);
router.get('/products/fuel', productController.getFuelProducts);
router.patch('/products/fuel/prices', productController.updateFuelPrices);
router.get('/products/lookup/:code', productController.lookupProduct);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// SMTP Configuration
router.get('/smtp/:branchId', smtpController.getSmtpByBranch);
router.post('/smtp', smtpController.saveSmtp);
router.post('/smtp/test', smtpController.testSmtp);

// System Settings
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// Taxes Configuration
router.use('/taxes', taxRoutes);

// Physical Inventory
router.get('/inventory/physical/products', inventoryController.getProductsForPhysicalInventory);
router.get('/inventory/physical', inventoryController.getPhysicalInventories);
router.get('/inventory/physical/:id', inventoryController.getPhysicalInventoryDetail);
router.post('/inventory/physical/save', inventoryController.savePhysicalInventory);
router.post('/inventory/physical/:id/apply', inventoryController.applyPhysicalInventory);
router.delete('/inventory/physical/:id', inventoryController.deletePhysicalInventory);

// Physical Inventory - Scan Sessions (QR public access)
router.post('/inventory/physical/:id/scan-session', inventoryScanController.createScanSession);
router.get('/inventory/physical/:id/scans', inventoryScanController.getSessionScans);
router.post('/inventory/physical/:id/apply-scans', inventoryScanController.applyScans);
router.post('/inventory/physical/:id/reject-scans', inventoryScanController.rejectScans);
router.delete('/inventory/physical/scan-session/:id', inventoryScanController.deleteScanSession);

// Inventory
router.get('/inventory', inventoryController.getInventory);
router.get('/inventory/stock-report', inventoryController.getInventoryStockReport);
router.get('/inventory/movements-report', inventoryController.getInventoryMovementsReport);
router.get('/inventory/kardex', inventoryController.getKardex);
router.get('/inventory/transfers', inventoryController.getTransfers);
router.get('/inventory/transfers/:id', inventoryController.getTransferDetail);
router.post('/inventory/transfers', inventoryController.createTransfer);
router.delete('/inventory/transfers/:id', inventoryController.deleteTransfer);

// Inventory Adjustments
router.get('/inventory/motivos', inventoryAdjustmentController.getMotivos);
router.post('/inventory/motivos', inventoryAdjustmentController.createMotivo);
router.put('/inventory/motivos/:id', inventoryAdjustmentController.updateMotivo);
router.delete('/inventory/motivos/:id', inventoryAdjustmentController.deleteMotivo);
router.get('/inventory/adjustments', inventoryAdjustmentController.getAdjustments);
router.post('/inventory/adjustments', inventoryAdjustmentController.createAdjustment);
router.get('/inventory/adjustments/:id', inventoryAdjustmentController.getAdjustmentById);
router.put('/inventory/adjustments/:id', inventoryAdjustmentController.updateAdjustment);
router.post('/inventory/adjustments/:id/void', inventoryAdjustmentController.voidAdjustment);

// Purchases
router.get('/purchases', purchaseController.getPurchases);
router.post('/purchases', purchaseController.createPurchase);
router.get('/purchases/reports/pdf', purchaseController.getPurchaseReportPDF);
router.get('/purchases/pdf/:id', purchaseController.exportPurchasePDF);

// Purchase Checks (Chq Contado) — MUST be before /purchases/:id to avoid route conflict
const purchaseCheckController = require('../controllers/purchaseCheck.controller');
router.get('/purchases/checks', purchaseCheckController.getChecks);
router.post('/purchases/checks', purchaseCheckController.createCheck);
router.get('/purchases/checks/:id', purchaseCheckController.getCheckById);
router.put('/purchases/checks/:id', purchaseCheckController.updateCheck);
router.delete('/purchases/checks/:id', purchaseCheckController.deleteCheck);
router.post('/purchases/checks/:id/deliver', purchaseCheckController.deliverCheck);
router.post('/purchases/checks/:id/request', purchaseCheckController.requestCheck);
router.post('/purchases/checks/:id/revert', purchaseCheckController.revertCheck);
router.get('/purchases/checks/config/:branchId', purchaseCheckController.getChqConfig);
router.post('/purchases/checks/config', purchaseCheckController.saveChqConfig);
router.post('/purchases/checks/rrs-num-cheque', purchaseCheckController.getRrsNumCheque);
router.post('/purchases/checks/sync-providers', purchaseCheckController.syncProviders);

// Quedan
const quedanController = require('../controllers/quedan.controller');
router.get('/purchases/quedans/reports/pdf', quedanController.getQuedanReportPDF);
router.get('/purchases/quedans', quedanController.getQuedans);
router.post('/purchases/quedans', quedanController.createQuedan);
router.get('/purchases/quedans/:id', quedanController.getQuedanById);
router.put('/purchases/quedans/:id', quedanController.updateQuedan);
router.delete('/purchases/quedans/:id', quedanController.deleteQuedan);
router.post('/purchases/quedans/:id/deliver', quedanController.deliverQuedan);
router.post('/purchases/quedans/:id/request', quedanController.requestQuedan);
router.post('/purchases/quedans/:id/revert', quedanController.revertQuedan);

router.get('/purchases/:id', purchaseController.getPurchaseById);
router.put('/purchases/:id', purchaseController.updatePurchase);
router.post('/purchases/:id/void', purchaseController.voidPurchase);

// Expenses
router.get('/expenses', expenseController.getExpenses);
router.get('/expenses/types', expenseController.getExpenseTypes);
router.get('/expenses/reports/pdf', expenseController.getExpenseReportPDF);
router.post('/expenses', expenseController.createExpense);
router.get('/expenses/:id', expenseController.getExpenseById);
router.put('/expenses/:id', expenseController.updateExpense);
router.post('/expenses/:id/void', expenseController.voidExpense);

// Sales
router.get('/sales', salesController.getSales);
router.get('/sales/check-cr', salesController.checkExistingCR);
router.get('/sales/reports/pdf', salesController.getSalesReportPDF);
router.get('/sales/reports/by-category', salesController.getSalesByCategory);
router.get('/sales/reports/category/pdf', salesController.exportSalesByCategoryPDF);
router.get('/sales/reports/daily', salesController.getDailySales);
router.get('/sales/reports/daily/pdf', salesController.exportDailySalesPDF);
router.get('/sales/reports/by-customer/pdf', salesController.exportSalesByCustomerPDF);
router.get('/sales/reports/pos', salesController.getSalesByPOS);
router.get('/sales/reports/pos/pdf', salesController.exportSalesByPOSPDF);
router.get('/sales/reports/detalle/pdf', salesController.exportSalesDetailPDF);
router.post('/sales', salesController.createSale);
router.get('/sales/rtee/:id', salesController.exportRTEE);
router.post('/sales/resend-email/:id', salesController.resendDTEEmail);
router.get('/sales/dte-json/:id', salesController.getDTEJson);

// Sales Settings (Configuración Tienda) — antes de /sales/:id
router.get('/sales/settings', salesConfigController.getSettings);
router.put('/sales/settings', salesConfigController.updateSettings);

// Sales - Remesa Deliveries (Entrega de Remesas - Ventas/Tienda) — antes de /sales/:id
router.get('/sales/remesas/pending', salesRemesaDeliveryController.getPendingRemesas);
router.get('/sales/remesa-deliveries', salesRemesaDeliveryController.getDeliveries);
router.post('/sales/remesa-deliveries', salesRemesaDeliveryController.createDelivery);
router.put('/sales/remesa-deliveries/:id', salesRemesaDeliveryController.updateDelivery);
router.get('/sales/remesa-deliveries/:id', salesRemesaDeliveryController.getDelivery);
router.put('/sales/remesa-deliveries/:id/entregar', salesRemesaDeliveryController.entregarDelivery);
router.get('/sales/remesa-deliveries/:id/pdf', salesRemesaDeliveryController.getDeliveryPdf);
router.delete('/sales/remesa-deliveries/:id', salesRemesaDeliveryController.deleteDelivery);

router.put('/sales/change-shift', checkPermission('manage_dte_shift_change'), salesController.changeSalesShift);

router.get('/sales/:id', salesController.getSaleById);
router.post('/sales/:id/void', salesController.voidSale);
router.post('/sales/:id/retransmit', salesController.retransmitSaleDTE);
router.post('/sales/:id/regenerate-dte', salesController.regenerateDTE);
router.put('/sales/:id/edit-dte-items', salesController.editDTEItems);

// Contingency (proxy to dte-api)
router.get('/contingency/status', salesController.getContingencyStatus);
router.post('/contingency/start', salesController.startContingency);
router.post('/contingency/stop/:id', salesController.stopContingency);

// Retorno / ERET (proxy to dte-api)
router.get('/retorno', salesController.listRetornos);
router.post('/retorno/emit', salesController.emitRetorno);
router.get('/retorno/status/:codigoGeneracion', salesController.getRetornoStatus);

// DTE lookup by codigo generacion (for ERET and general use)
router.get('/dte/:codigoGeneracion', salesController.getDTEByCodigoGeneracion);

// POS Shifts (Corte de Caja)
router.get('/shifts', shiftController.getShiftsHistory);
router.get('/shifts/reports/arqueos/pdf', shiftController.exportArqueosPDF);
router.get('/shifts/current', shiftController.getCurrentShift);
router.post('/shifts/open', shiftController.openShift);
router.get('/shifts/:id/summary', shiftController.getShiftSummary);
router.post('/shifts/:id/arqueo', shiftController.saveArqueo);
router.post('/shifts/:id/close', shiftController.closeShift);
router.get('/shifts/:id/sellers', shiftController.getShiftSellers);
router.put('/shifts/:id/sellers', shiftController.updateShiftSellers);
router.put('/shifts/:id', checkPermission('manage_shifts_edit'), shiftController.updateShift);
router.delete('/shifts/:id', checkPermission('manage_shifts_edit'), shiftController.deleteShift);

// Dashboard
router.get('/dashboard/general-stats', dashboardController.getStats);
router.get('/dashboard/category-sales', dashboardController.getCategorySales);

// Product Combos
router.get('/combos', comboController.getCombos);
router.post('/combos', comboController.createCombo);
router.put('/combos/:id', comboController.updateCombo);
router.delete('/combos/:id', comboController.deleteCombo);

// Customer Specific Discounts
router.get('/customer-discounts', customerDiscountController.getDiscounts);
router.post('/customer-discounts', customerDiscountController.createDiscount);
router.delete('/customer-discounts/:id', customerDiscountController.deleteDiscount);

// Product Discount Rules
router.get('/discount-rules', discountRulesController.getRules);
router.post('/discount-rules', discountRulesController.createRule);
router.put('/discount-rules/:id', discountRulesController.updateRule);
router.delete('/discount-rules/:id', discountRulesController.deleteRule);

// Accounts Receivable (CXC)
router.get('/cxc/statement', cxcController.getCustomerStatement);
router.get('/cxc/statement/pdf', cxcController.exportStatementPDF);
router.post('/cxc/statement/send-email', cxcController.sendStatementEmail);
router.get('/cxc/aging-report', cxcController.getAgingReport);
router.get('/cxc/aging-report/pdf', cxcController.exportAgingPDF);
router.get('/cxc/reports/pending-detailed/pdf', cxcController.exportPendingDocumentsDetailedPDF);
router.post('/cxc/aging-report/send-email', cxcController.sendAgingEmail);
router.get('/cxc/pending-documents', cxcController.getPendingDocuments);
router.get('/cxc/payments', cxcController.getPaymentHistory);
router.get('/cxc/payments/:id', cxcController.getPaymentById);
router.post('/cxc/payments', cxcController.registerPayment);
router.put('/cxc/payments/:id', cxcController.updatePayment);
router.delete('/cxc/payments/:id', cxcController.deletePayment);
router.post('/cxc/payments/:id/send-email', cxcController.sendReceiptEmail);
router.get('/cxc/payments/:id/pdf', cxcController.exportPaymentPDF);
router.get('/cxc/balances-report', cxcController.getCustomerBalancesReport);

 
// Accounts Payable (CXP)
const cxpController = require('../controllers/cxp.controller');
router.get('/cxp/statement', cxpController.getProviderStatement);
router.get('/cxp/statement/pdf', cxpController.exportProviderStatementPDF);
router.post('/cxp/statement/send-email', cxpController.sendProviderStatementEmail);
router.get('/cxp/aging-report', cxpController.getProviderAgingReport);
router.get('/cxp/aging-report/pdf', cxpController.exportProviderAgingPDF);
router.post('/cxp/aging-report/send-email', cxpController.sendProviderAgingEmail);
router.get('/cxp/pending-documents', cxpController.getPendingDocuments);
router.get('/cxp/reports/pending-detailed/pdf', cxpController.exportProviderPendingDocumentsDetailedPDF);
router.get('/cxp/payments', cxpController.getPaymentHistory);
router.get('/cxp/payments/:id', cxpController.getPaymentById);
router.post('/cxp/payments', cxpController.registerPayment);
router.put('/cxp/payments/:id', cxpController.updatePayment);
router.delete('/cxp/payments/:id', cxpController.deletePayment);
router.post('/cxp/payments/:id/send-email', cxpController.sendReceiptEmail);
router.get('/cxp/balances-report', cxpController.getProviderBalancesReport);
router.get('/cxp/payments/:id/pdf', cxpController.exportPaymentPDF);

// Libros de IVA
router.get('/vat-books/purchases-pdf', vatBooksController.getVatBookPurchasesPDF);
router.get('/vat-books/sales-taxpayers-pdf', vatBooksController.getVatBookSalesTaxpayersPDF);
router.get('/vat-books/sales-consumers-pdf', vatBooksController.getVatBookSalesConsumersPDF);
router.get('/vat-books/anexos-iva', vatBooksController.getVatBookAnexosIVA);
router.get('/vat-books/anexos-iva-pdf', vatBooksController.getVatBookAnexosIVAPDF);
router.get('/vat-books/anexos-iva-excel', vatBooksController.getVatBookAnexosIVAExcel);

// Accounting Module
router.get('/accounting/account-types', accountingController.getAccountTypes);
router.post('/accounting/account-types', accountingController.createAccountType);
router.put('/accounting/account-types/:id', accountingController.updateAccountType);
router.delete('/accounting/account-types/:id', accountingController.deleteAccountType);

router.get('/accounting/entry-types', accountingController.getEntryTypes);
router.post('/accounting/entry-types', accountingController.createEntryType);
router.put('/accounting/entry-types/:id', accountingController.updateEntryType);
router.delete('/accounting/entry-types/:id', accountingController.deleteEntryType);

router.get('/accounting/accounts', accountingController.getAccounts);
router.post('/accounting/accounts', accountingController.createAccount);
router.put('/accounting/accounts/:id', accountingController.updateAccount);
router.delete('/accounting/accounts/:id', accountingController.deleteAccount);

router.get('/accounting/entries', accountingController.getEntries);
router.get('/accounting/entries/:id', accountingController.getEntry);
router.post('/accounting/entries', accountingController.createEntry);
router.put('/accounting/entries/:id', accountingController.updateEntry);
router.put('/accounting/entries/:id/void', accountingController.voidEntry);
router.get('/accounting/trial-balance', accountingController.getTrialBalance);
router.post('/accounting/closing', accountingController.performClosing);
router.post('/cxp/payments/:id/send-email', cxpController.sendReceiptEmail);
router.get('/cxp/balances-report', cxpController.getProviderBalancesReport);
router.get('/cxp/payments/:id/pdf', cxpController.exportPaymentPDF);

// Libros de IVA
router.get('/vat-books/purchases-pdf', vatBooksController.getVatBookPurchasesPDF);
router.get('/vat-books/sales-taxpayers-pdf', vatBooksController.getVatBookSalesTaxpayersPDF);
router.get('/vat-books/sales-consumers-pdf', vatBooksController.getVatBookSalesConsumersPDF);

// Accounting Module
router.get('/accounting/account-types', accountingController.getAccountTypes);
router.post('/accounting/account-types', accountingController.createAccountType);
router.put('/accounting/account-types/:id', accountingController.updateAccountType);
router.delete('/accounting/account-types/:id', accountingController.deleteAccountType);

router.get('/accounting/entry-types', accountingController.getEntryTypes);
router.post('/accounting/entry-types', accountingController.createEntryType);
router.put('/accounting/entry-types/:id', accountingController.updateEntryType);
router.delete('/accounting/entry-types/:id', accountingController.deleteEntryType);

router.get('/accounting/accounts', accountingController.getAccounts);
router.post('/accounting/accounts', accountingController.createAccount);
router.put('/accounting/accounts/:id', accountingController.updateAccount);
router.delete('/accounting/accounts/:id', accountingController.deleteAccount);

router.get('/accounting/entries', accountingController.getEntries);
router.get('/accounting/entries/:id', accountingController.getEntry);
router.post('/accounting/entries', accountingController.createEntry);
router.put('/accounting/entries/:id', accountingController.updateEntry);
router.put('/accounting/entries/:id/void', accountingController.voidEntry);
router.get('/accounting/trial-balance', accountingController.getTrialBalance);
router.post('/accounting/closing', accountingController.performClosing);
router.post('/accounting/opening', accountingController.performOpening);
router.get('/accounting/settings', accountingController.getSettings);
router.post('/accounting/settings', accountingController.saveSettings);
router.post('/accounting/import', accountingController.importAccounts);

// Accounting Reports
router.get('/accounting/reports/libro-diario', accountingReportsController.getLibroDiario);
router.get('/accounting/reports/libro-diario-mayor', accountingReportsController.getLibroDiarioMayor);
router.get('/accounting/reports/libro-mayor', accountingReportsController.getLibroMayor);
router.get('/accounting/reports/estado-resultados', accountingReportsController.getEstadoResultados);
router.get('/accounting/reports/balance-general', accountingReportsController.getBalanceGeneral);
router.get('/accounting/reports/anexo-balance', accountingReportsController.getAnexoBalance);
router.get('/accounting/reports/auxiliar-operaciones', accountingReportsController.getAuxiliarOperaciones);
router.get('/accounting/reports/balance-comprobacion', accountingReportsController.getBalanceComprobacion);
router.get('/accounting/reports/listado-partidas', accountingReportsController.getListadoPartidas);
router.get('/accounting/reports/cambios-patrimonio', accountingReportsController.getCambiosPatrimonio);
router.get('/accounting/reports/flujo-efectivo', accountingReportsController.getFlujoEfectivo);
router.get('/accounting/reports/balance-comparativo', accountingReportsController.getBalanceComparativo);
router.get('/accounting/reports/cedula-auditoria', accountingReportsController.getCedulaAuditoria);
router.get('/accounting/reports/retenciones', accountingReportsController.getRetenciones);

// AI Assistant
router.use('/ai', aiRoutes);

// Industrial Egg Processing Module
const eggIndustrialRoutes = require('./eggIndustrial.routes');
router.use('/egg-industrial', eggIndustrialRoutes);

// Gas Station - Distributors
router.get('/gas-station/distributors', gasDistributorController.getDistributors);
router.post('/gas-station/distributors', gasDistributorController.createDistributor);
router.put('/gas-station/distributors/:id', gasDistributorController.updateDistributor);
router.delete('/gas-station/distributors/:id', gasDistributorController.deleteDistributor);

// Gas Station - Islands
router.get('/gas-station/islands', islandController.getIslands);
router.post('/gas-station/islands', islandController.createIsland);
router.put('/gas-station/islands/:id', islandController.updateIsland);
router.delete('/gas-station/islands/:id', islandController.deleteIsland);

// Gas Station - Nozzles
router.get('/gas-station/nozzles', nozzleController.getNozzles);
router.post('/gas-station/nozzles', nozzleController.createNozzle);
router.put('/gas-station/nozzles/:id', nozzleController.updateNozzle);
router.delete('/gas-station/nozzles/:id', nozzleController.deleteNozzle);

// Gas Station - Tanks
router.get('/gas-station/tanks', tankController.getTanks);
router.post('/gas-station/tanks', tankController.createTank);
router.put('/gas-station/tanks/:id', tankController.updateTank);
router.delete('/gas-station/tanks/:id', tankController.deleteTank);

// Gas Station - Closeouts (Cierre de Lecturas)
router.post('/gas-station/closeouts/init', gasCloseoutController.initCloseout);
router.post('/gas-station/closeouts/:id/tank-readings/init', gasCloseoutController.initTankReadings);
router.get('/gas-station/closeouts/next-turno', gasCloseoutController.getNextTurno);
router.get('/gas-station/closeouts/last-turno', gasCloseoutController.getLastTurno);
router.get('/gas-station/closeouts/print-day', gasCloseoutController.getAccumulatedDayPrintData);
router.get('/gas-station/closeouts', gasCloseoutController.getCloseouts);
router.get('/gas-station/closeouts/:id', gasCloseoutController.getCloseout);
router.patch('/gas-station/closeouts/:closeoutId/readings/batch', gasCloseoutController.batchUpdateReadings);
router.patch('/gas-station/closeouts/:closeoutId/readings/:id', gasCloseoutController.updateReading);
router.patch('/gas-station/closeouts/:closeoutId/tank-readings/:id', gasCloseoutController.updateTankReading);
router.post('/gas-station/closeouts/:id/close', gasCloseoutController.closeCloseout);
router.post('/gas-station/closeouts/:id/reopen', gasCloseoutController.reopenCloseout);
router.patch('/gas-station/closeouts/:id/fecha-turno', gasCloseoutController.updateCloseoutFechaTurno);
router.delete('/gas-station/closeouts/:id', gasCloseoutController.deleteCloseout);
router.put('/gas-station/closeouts/:id/despachadores', gasCloseoutController.updateCloseoutDespachadores);
router.put('/gas-station/closeouts/:id/despachador-nozzles', gasCloseoutController.updateCloseoutDespachadorNozzles);

// Gas Station - Expense Categories
router.get('/gas-station/expense-categories', gasCloseoutController.getExpenseCategories);
router.post('/gas-station/expense-categories', gasCloseoutController.createExpenseCategory);
router.put('/gas-station/expense-categories/:id', gasCloseoutController.updateExpenseCategory);
router.delete('/gas-station/expense-categories/:id', gasCloseoutController.deleteExpenseCategory);

// Gas Station - Closeout Expenses
router.get('/gas-station/closeouts/:id/expenses', gasCloseoutController.getExpenses);
router.post('/gas-station/closeouts/:id/expenses', gasCloseoutController.saveExpenses);
router.delete('/gas-station/closeouts/:id/expenses/:expenseId', gasCloseoutController.deleteExpense);

// Gas Station - Closeout Remesas
router.get('/gas-station/closeouts/:id/remesas', gasCloseoutController.getRemesas);
router.post('/gas-station/closeouts/:id/remesas', gasCloseoutController.saveRemesas);
router.delete('/gas-station/closeouts/:id/remesas/:remesaId', gasCloseoutController.deleteRemesa);

// Gas Station - Closeout Cupones
router.get('/gas-station/closeouts/:id/cupones', gasCloseoutController.getCupones);
router.post('/gas-station/closeouts/:id/cupones', gasCloseoutController.saveCupones);
router.delete('/gas-station/closeouts/:id/cupones/:cuponId', gasCloseoutController.deleteCupon);

// Gas Station - Closeout Descuentos
router.get('/gas-station/closeouts/:id/descuentos', gasCloseoutController.getDescuentos);
router.post('/gas-station/closeouts/:id/descuentos', gasCloseoutController.saveDescuentos);
router.delete('/gas-station/closeouts/:id/descuentos/:descuentoId', gasCloseoutController.deleteDescuento);

// Gas Station - Closeout Adelantos
router.get('/gas-station/closeouts/:id/adelantos', gasCloseoutController.getAdelantos);
router.post('/gas-station/closeouts/:id/adelantos', gasCloseoutController.saveAdelantos);
router.delete('/gas-station/closeouts/:id/adelantos/:adelantoId', gasCloseoutController.deleteAdelanto);

// Gas Station - Settings
router.get('/gas-station/settings', gasConfigController.getSettings);
router.put('/gas-station/settings', gasConfigController.updateSettings);

// Gas Station - Lubricant Products
router.get('/products/lubricants', productController.getLubricantProducts);

// Gas Station - Closeout Lubricant Readings
router.get('/gas-station/closeouts/:id/lubricantes', gasCloseoutController.getLubricantReadings);
router.post('/gas-station/closeouts/:id/lubricantes', gasCloseoutController.saveLubricantReadings);

// Gas Station - Despachadores
router.get('/gas-station/despachadores', gasDespachadorController.getDespachadores);
router.post('/gas-station/despachadores', gasDespachadorController.createDespachador);
router.put('/gas-station/despachadores/:id', gasDespachadorController.updateDespachador);
router.delete('/gas-station/despachadores/:id', gasDespachadorController.deleteDespachador);

// Gas Station - Despachador Nozzle Assignments
router.get('/gas-station/despachadores/:id/nozzles', gasDespachadorController.getDespachadorNozzles);
router.put('/gas-station/despachadores/:id/nozzles', gasDespachadorController.updateDespachadorNozzles);
router.get('/gas-station/despachador-nozzles/all', gasDespachadorController.getAllAssignments);

// Gas Station - POS Types
router.get('/gas-station/pos-types', gasPosTypeController.getPosTypes);
router.post('/gas-station/pos-types', gasPosTypeController.createPosType);
router.put('/gas-station/pos-types/:id', gasPosTypeController.updatePosType);
router.delete('/gas-station/pos-types/:id', gasPosTypeController.deletePosType);

// Gas Station - Closeout Tarjetas
router.get('/gas-station/closeouts/:id/tarjetas', gasCloseoutController.getTarjetas);
router.post('/gas-station/closeouts/:id/tarjetas', gasCloseoutController.saveTarjetas);
router.delete('/gas-station/closeouts/:id/tarjetas/:tarjetaId', gasCloseoutController.deleteTarjeta);

// Gas Station - Closeout Creditos
router.get('/gas-station/closeouts/:id/creditos', gasCloseoutController.getCreditos);
router.post('/gas-station/closeouts/:id/creditos', gasCloseoutController.saveCreditos);
router.delete('/gas-station/closeouts/:id/creditos/:creditoId', gasCloseoutController.deleteCredito);

// Gas Station - Closeout Vales
router.get('/gas-station/closeouts/:id/vales', gasCloseoutController.getVales);
router.post('/gas-station/closeouts/:id/vales', gasCloseoutController.saveVales);
router.delete('/gas-station/closeouts/:id/vales/:valeId', gasCloseoutController.deleteVale);

// Gas Station - Advances
router.get('/gas-station/advances', gasAdvanceController.getAdvances);
router.post('/gas-station/advances', gasAdvanceController.createAdvance);
router.put('/gas-station/advances/:id', gasAdvanceController.updateAdvance);
router.delete('/gas-station/advances/:id', gasAdvanceController.deleteAdvance);
router.get('/gas-station/advances/available/:cliente_id', gasAdvanceController.getAvailableAdvancesByClient);

// Gas Station - Closeout Anticipos Despachados
router.get('/gas-station/closeouts/:id/anticipos-desp', gasCloseoutController.getAnticiposDesp);
router.post('/gas-station/closeouts/:id/anticipos-desp', gasCloseoutController.saveAnticiposDesp);
router.delete('/gas-station/closeouts/:id/anticipos-desp/:anticipoId', gasCloseoutController.deleteAnticipoDesp);

// Print full closeout data
router.get('/gas-station/closeouts/:id/print-full', gasCloseoutController.getCloseoutPrintData);

// Send closeout to RRS external database
router.post('/gas-station/closeouts/:id/send-to-rrs', gasCloseoutController.sendToRrs);

// Gas Station - Ventas Comparacion & DTE Complementaria
router.get('/gas-station/closeouts/:id/ventas-comparacion', gasCloseoutController.getVentasComparacion);
router.post('/gas-station/closeouts/:id/generar-complementaria', gasCloseoutController.generarComplementaria);

// Gas Station - Reporte Ventas
router.get('/gas-station/reporte-ventas', gasReporteController.getReporteVentas);

// Gas Station - Reporte Detalle del Cierre
router.get('/gas-station/reports/closeout-detail/pdf', gasReporteController.getCloseoutDetailPDF);

// Gas Station - Reporte Inventario de Combustibles
router.get('/gas-station/reports/fuel-inventory/pdf', gasReporteController.getFuelInventoryPDF);

// Gas Station - Reporte Galonaje Vendido
router.get('/gas-station/reports/galonaje-vendido/pdf', gasReporteController.getGalonajeVendidoPDF);
router.get('/gas-station/reports/fuel-sales-summary/pdf', gasReporteController.getFuelSalesSummaryPDF);

// Gas Station - Remesa Deliveries
router.get('/gas-station/remesas/pending', gasRemesaDeliveryController.getPendingRemesas);
router.get('/gas-station/remesa-deliveries', gasRemesaDeliveryController.getDeliveries);
router.post('/gas-station/remesa-deliveries', gasRemesaDeliveryController.createDelivery);
router.put('/gas-station/remesa-deliveries/:id', gasRemesaDeliveryController.updateDelivery);
router.get('/gas-station/remesa-deliveries/:id', gasRemesaDeliveryController.getDelivery);
router.put('/gas-station/remesa-deliveries/:id/entregar', gasRemesaDeliveryController.entregarDelivery);
router.get('/gas-station/remesa-deliveries/:id/pdf', gasRemesaDeliveryController.getDeliveryPdf);
router.delete('/gas-station/remesa-deliveries/:id', gasRemesaDeliveryController.deleteDelivery);

// Control de Pozo - Servicios
router.get('/pozo/servicios', pozoController.getServicios);
router.post('/pozo/servicios', pozoController.createServicio);
router.put('/pozo/servicios/:id', pozoController.updateServicio);
router.delete('/pozo/servicios/:id', pozoController.deleteServicio);

// Control de Pozo - Despachos
router.get('/pozo/despachos', pozoController.getDespachos);
router.get('/pozo/despachos/:id', pozoController.getDespacho);
router.post('/pozo/despachos', pozoController.createDespacho);
router.put('/pozo/despachos/:id', pozoController.updateDespacho);
router.delete('/pozo/despachos/:id', pozoController.deleteDespacho);

// Control de Pozo - Cortes
    router.get('/pozo/cortes', pozoController.getCortes);
    router.get('/pozo/cortes/consultar', pozoController.consultarCorte);
    router.post('/pozo/cortes', pozoController.saveCorte);
    router.get('/pozo/cortes/:id', pozoController.getCorte);
    router.delete('/pozo/cortes/:id', pozoController.deleteCorte);

    router.get('/pozo/entregas-efectivo', pozoController.getEntregasEfectivo);
    router.post('/pozo/entregas-efectivo', pozoController.createEntregaEfectivo);
    router.put('/pozo/entregas-efectivo/:id', pozoController.updateEntregaEfectivo);
    router.delete('/pozo/entregas-efectivo/:id', pozoController.deleteEntregaEfectivo);

// RRHH - AFPs
router.get('/rh/afps', rhAfpController.getAfps);
router.post('/rh/afps', rhAfpController.createAfp);
router.put('/rh/afps/:id', rhAfpController.updateAfp);
router.delete('/rh/afps/:id', rhAfpController.deleteAfp);

// RRHH - Cargos
router.get('/rh/cargos', rhCargoController.getCargos);
router.post('/rh/cargos', rhCargoController.createCargo);
router.put('/rh/cargos/:id', rhCargoController.updateCargo);
router.delete('/rh/cargos/:id', rhCargoController.deleteCargo);

// RRHH - Descuentos Programados
router.get('/rh/descuentos-programados', rhDescuentoController.getDescuentos);
router.post('/rh/descuentos-programados', rhDescuentoController.createDescuento);
router.put('/rh/descuentos-programados/:id', rhDescuentoController.updateDescuento);
router.delete('/rh/descuentos-programados/:id', rhDescuentoController.deleteDescuento);

// RRHH - Departamentos
router.get('/rh/departamentos', rhDepartamentoController.getDepartamentos);
router.post('/rh/departamentos', rhDepartamentoController.createDepartamento);
router.put('/rh/departamentos/:id', rhDepartamentoController.updateDepartamento);
router.delete('/rh/departamentos/:id', rhDepartamentoController.deleteDepartamento);

// RRHH - Tasas de AFP
router.get('/rh/afp-tasas', rhAfpTasaController.getAfpTasas);
router.post('/rh/afp-tasas', rhAfpTasaController.createAfpTasa);
router.put('/rh/afp-tasas/:id', rhAfpTasaController.updateAfpTasa);
router.delete('/rh/afp-tasas/:id', rhAfpTasaController.deleteAfpTasa);

// RRHH - Tasas de ISSS
router.get('/rh/isss-tasas', rhIsssTasaController.getIsssTasas);
router.post('/rh/isss-tasas', rhIsssTasaController.createIsssTasa);
router.put('/rh/isss-tasas/:id', rhIsssTasaController.updateIsssTasa);
router.delete('/rh/isss-tasas/:id', rhIsssTasaController.deleteIsssTasa);

// RRHH - Configuración de Renta (ISR)
router.get('/rh/renta-config', rhRentaConfigController.getRentaConfigs);
router.get('/rh/renta-config/:id', rhRentaConfigController.getRentaConfig);
router.post('/rh/renta-config', rhRentaConfigController.createRentaConfig);
router.put('/rh/renta-config/:id', rhRentaConfigController.updateRentaConfig);
router.delete('/rh/renta-config/:id', rhRentaConfigController.deleteRentaConfig);

// RRHH - Configuración de Aguinaldo
router.get('/rh/aguinaldo-config', rhAguinaldoConfigController.getAguinaldoConfigs);
router.get('/rh/aguinaldo-config/:id', rhAguinaldoConfigController.getAguinaldoConfig);
router.post('/rh/aguinaldo-config', rhAguinaldoConfigController.createAguinaldoConfig);
router.put('/rh/aguinaldo-config/:id', rhAguinaldoConfigController.updateAguinaldoConfig);
router.delete('/rh/aguinaldo-config/:id', rhAguinaldoConfigController.deleteAguinaldoConfig);

// RRHH - Salario Mínimo
router.get('/rh/salario-minimo', rhSalarioMinimoController.getSalarioMinimoConfigs);
router.post('/rh/salario-minimo', rhSalarioMinimoController.createSalarioMinimoConfig);
router.put('/rh/salario-minimo/:id', rhSalarioMinimoController.updateSalarioMinimoConfig);
router.delete('/rh/salario-minimo/:id', rhSalarioMinimoController.deleteSalarioMinimoConfig);

// RRHH - Tipos de Contrato
router.get('/rh/tipos-contrato', rhTipoContratoController.getTiposContrato);
router.post('/rh/tipos-contrato', rhTipoContratoController.createTipoContrato);
router.put('/rh/tipos-contrato/:id', rhTipoContratoController.updateTipoContrato);
router.delete('/rh/tipos-contrato/:id', rhTipoContratoController.deleteTipoContrato);

// RRHH - Cuentas de Planillas
router.get('/rh/cuentas-planillas', rhCuentaPlanillaController.getCuentasPlanillas);
router.get('/rh/cuentas-planillas/next-orden', rhCuentaPlanillaController.getNextOrden);
router.post('/rh/cuentas-planillas', rhCuentaPlanillaController.createCuentaPlanilla);
router.put('/rh/cuentas-planillas/:id', rhCuentaPlanillaController.updateCuentaPlanilla);
router.delete('/rh/cuentas-planillas/:id', rhCuentaPlanillaController.deleteCuentaPlanilla);

// RRHH - Configuracion (Responsable y Sello)
router.get('/rh/config', rhConfigController.getConfig);
router.put('/rh/config', upload.fields([{ name: 'firma', maxCount: 1 }, { name: 'sello', maxCount: 1 }]), rhConfigController.updateConfig);

// RRHH - Empleados
router.get('/rh/empleados', rhEmpleadoController.getEmpleados);
router.get('/rh/empleados/next-code', rhEmpleadoController.getNextCode);
router.post('/rh/empleados', rhEmpleadoController.createEmpleado);
router.get('/rh/empleados/:id', rhEmpleadoController.getEmpleado);
router.put('/rh/empleados/:id', rhEmpleadoController.updateEmpleado);
router.delete('/rh/empleados/:id', rhEmpleadoController.deleteEmpleado);

// RRHH - Empleado Descuentos Programados
router.get('/rh/empleados/:id/descuentos', rhEmpleadoController.getDescuentos);
router.post('/rh/empleados/:id/descuentos', rhEmpleadoController.createDescuento);
router.put('/rh/empleados/:id/descuentos/:did', rhEmpleadoController.updateDescuento);
router.delete('/rh/empleados/:id/descuentos/:did', rhEmpleadoController.deleteDescuento);

// RRHH - Empleado Indemnizaciones
router.get('/rh/empleados/:id/historial-indemnizaciones', rhEmpleadoController.getHistorialIndemnizaciones);
router.get('/rh/empleados/:id/indemnizaciones', rhEmpleadoController.getIndemnizaciones);
router.post('/rh/empleados/:id/indemnizaciones', rhEmpleadoController.createIndemnizacion);
router.delete('/rh/empleados/:id/indemnizaciones/:iid', rhEmpleadoController.deleteIndemnizacion);

// RRHH - Empleado Ausencias
router.get('/rh/empleados/:id/ausencias', rhEmpleadoController.getAusencias);
router.post('/rh/empleados/:id/ausencias', rhEmpleadoController.createAusencia);
router.put('/rh/empleados/:id/ausencias/:aid', rhEmpleadoController.updateAusencia);
router.delete('/rh/empleados/:id/ausencias/:aid', rhEmpleadoController.deleteAusencia);

// RRHH - Planilla de Vacaciones
router.get('/rh/planilla-vacaciones/calcular', rhPlanillaVacacionesController.calcular);
router.get('/rh/planilla-vacaciones/empleado/:id', rhPlanillaVacacionesController.getEmpleadoData);
router.get('/rh/planilla-vacaciones', rhPlanillaVacacionesController.getPlanillas);
router.post('/rh/planilla-vacaciones', rhPlanillaVacacionesController.createPlanilla);
router.get('/rh/planilla-vacaciones/:id/pdf', rhPlanillaVacacionesController.exportPDF);
router.get('/rh/planilla-vacaciones/:id', rhPlanillaVacacionesController.getPlanilla);
router.put('/rh/planilla-vacaciones/:id', rhPlanillaVacacionesController.updatePlanilla);
router.delete('/rh/planilla-vacaciones/:id', rhPlanillaVacacionesController.deletePlanilla);

// RRHH - Planilla de Liquidaciones
router.get('/rh/planilla-liquidaciones/calcular', rhPlanillaLiquidacionesController.calcular);
router.get('/rh/planilla-liquidaciones/empleado/:id', rhPlanillaLiquidacionesController.getEmpleadoData);
router.get('/rh/planilla-liquidaciones/ultima/:empleado_id', rhPlanillaLiquidacionesController.getUltimaLiquidacion);
router.get('/rh/planilla-liquidaciones', rhPlanillaLiquidacionesController.getLiquidaciones);
router.post('/rh/planilla-liquidaciones', rhPlanillaLiquidacionesController.createLiquidacion);
router.get('/rh/planilla-liquidaciones/:id/pdf', rhPlanillaLiquidacionesController.exportPDF);
router.get('/rh/planilla-liquidaciones/:id/finiquito', rhPlanillaLiquidacionesController.exportFiniquito);
router.get('/rh/planilla-liquidaciones/:id/acuerdo-pago', rhPlanillaLiquidacionesController.exportAcuerdoPago);
router.get('/rh/planilla-liquidaciones/:id', rhPlanillaLiquidacionesController.getLiquidacion);
router.put('/rh/planilla-liquidaciones/:id', rhPlanillaLiquidacionesController.updateLiquidacion);
router.delete('/rh/planilla-liquidaciones/:id', rhPlanillaLiquidacionesController.deleteLiquidacion);

// RRHH - Honorarios y Servicios
router.get('/rh/honorarios/next-code', rhHonorariosController.getNextCode);
router.get('/rh/honorarios', rhHonorariosController.getHonorarios);
router.post('/rh/honorarios', rhHonorariosController.createHonorario);
router.get('/rh/honorarios/:id/pdf', rhHonorariosController.exportPDF);
router.get('/rh/honorarios/:id', rhHonorariosController.getHonorario);
router.put('/rh/honorarios/:id', rhHonorariosController.updateHonorario);
router.delete('/rh/honorarios/:id', rhHonorariosController.deleteHonorario);

// RRHH - Planilla de Aguinaldos
router.get('/rh/planilla-aguinaldos/calcular', rhPlanillaAguinaldosController.calcular);
router.get('/rh/planilla-aguinaldos/resumen', rhPlanillaAguinaldosController.getResumen);
router.get('/rh/planilla-aguinaldos/pdf', rhPlanillaAguinaldosController.exportPDF);
router.get('/rh/planilla-aguinaldos/recibos', rhPlanillaAguinaldosController.exportRecibos);
router.get('/rh/planilla-aguinaldos', rhPlanillaAguinaldosController.getPlanilla);
router.post('/rh/planilla-aguinaldos', rhPlanillaAguinaldosController.savePlanilla);
router.delete('/rh/planilla-aguinaldos/periodo', rhPlanillaAguinaldosController.deletePeriodo);

// RRHH - Planillas Quincenales
router.get('/rh/planillas/cuentas-activas', rhPlanillaController.getCuentasActivas);
router.post('/rh/planillas/calcular', rhPlanillaController.calcular);
router.post('/rh/planillas/generar', rhPlanillaController.generarPlanilla);
router.get('/rh/planillas/grupos', rhPlanillaController.getGruposPlanilla);
router.get('/rh/planillas/recibos-masivos', rhPlanillaController.exportRecibosMasivos);
router.post('/rh/planillas/cerrar-periodo', rhPlanillaController.cerrarPeriodo);
router.post('/rh/planillas/eliminar-periodo', rhPlanillaController.eliminarPeriodo);
router.get('/rh/planillas/empleado/:id', rhPlanillaController.getEmpleadoData);
router.get('/rh/planillas', rhPlanillaController.getPlanillas);
router.post('/rh/planillas', rhPlanillaController.createPlanilla);
router.get('/rh/planillas/:id/pdf', rhPlanillaController.exportPDF);
router.get('/rh/planillas/:id/recibo', rhPlanillaController.exportRecibo);
router.get('/rh/planillas/:id', rhPlanillaController.getPlanilla);
router.put('/rh/planillas/:id', rhPlanillaController.updatePlanilla);
router.delete('/rh/planillas/:id', rhPlanillaController.deletePlanilla);
router.post('/rh/planillas/:id/pagar', rhPlanillaController.pagarPlanilla);

router.get('/logs/stream/:service', verifyToken, settingsController.streamLogs);

// Notifications
router.use('/notifications', notificationRoutes);

// WhatsApp
router.use('/whatsapp', whatsappRoutes);

module.exports = router;
