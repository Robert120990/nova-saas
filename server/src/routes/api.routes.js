const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
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
const providerController = require('../controllers/provider.controller');
const catalogController = require('../controllers/catalog.controller');
const smtpController = require('../controllers/smtp.controller');
const settingsController = require('../controllers/settings.controller');
const aiRoutes = require('./ai.routes');
const inventoryController = require('../controllers/inventory.controller');
const inventoryAdjustmentController = require('../controllers/inventoryAdjustment.controller');
const purchaseController = require('../controllers/purchase.controller');
const salesController = require('../controllers/sales.controller');
const periodController = require('../controllers/period.controller');
const dashboardController = require('../controllers/dashboard.controller');
const shiftController = require('../controllers/shift.controller');
const comboController = require('../controllers/combo.controller');
const vatBooksController = require('../controllers/vatBooks.controller');
const customerDiscountController = require('../controllers/customerDiscount.controller');
const customerBranchController = require('../controllers/customerBranch.controller');
const discountRulesController = require('../controllers/discountRules.controller');
const accountingController = require('../controllers/accounting.controller');
const cxcController = require('../controllers/cxc.controller');
const expenseController = require('../controllers/expense.controller');
const taxRoutes = require('./tax.routes');
const auditController = require('../controllers/audit.controller');

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

// Public routes
router.get('/settings/public', settingsController.getPublicSettings);
router.get('/public/dte/:codigo/pdf', salesController.getPublicRTEE);

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

// Multi-tenant scoped routes
router.use(tenantMiddleware);
router.use(require('../middlewares/audit'));

// Security (Roles & Users)
router.get('/roles', roleController.getRoles);
router.post('/roles', roleController.createRole);
router.put('/roles/:id', roleController.updateRole);
router.delete('/roles/:id', roleController.deleteRole);

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
router.get('/sales/reports/pos', salesController.getSalesByPOS);
router.get('/sales/reports/pos/pdf', salesController.exportSalesByPOSPDF);
router.post('/sales', salesController.createSale);
router.get('/sales/rtee/:id', salesController.exportRTEE);
router.post('/sales/resend-email/:id', salesController.resendDTEEmail);
router.get('/sales/dte-json/:id', salesController.getDTEJson);
router.get('/sales/:id', salesController.getSaleById);
router.post('/sales/:id/void', salesController.voidSale);
router.post('/sales/:id/retransmit', salesController.retransmitSaleDTE);

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
router.get('/shifts/current', shiftController.getCurrentShift);
router.post('/shifts/open', shiftController.openShift);
router.get('/shifts/:id/summary', shiftController.getShiftSummary);
router.post('/shifts/:id/close', shiftController.closeShift);

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
router.get('/gas-station/closeouts/last-turno', gasCloseoutController.getLastTurno);
router.get('/gas-station/closeouts', gasCloseoutController.getCloseouts);
router.get('/gas-station/closeouts/:id', gasCloseoutController.getCloseout);
router.patch('/gas-station/closeouts/:closeoutId/readings/:id', gasCloseoutController.updateReading);
router.patch('/gas-station/closeouts/:closeoutId/tank-readings/:id', gasCloseoutController.updateTankReading);
router.post('/gas-station/closeouts/:id/close', gasCloseoutController.closeCloseout);
router.delete('/gas-station/closeouts/:id', gasCloseoutController.deleteCloseout);
router.put('/gas-station/closeouts/:id/despachadores', gasCloseoutController.updateCloseoutDespachadores);

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

module.exports = router;
