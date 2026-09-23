/**
 * Barrel export for modularized PDF generation service.
 * Retains 100% backward compatibility for all consumers.
 * Split into domain-specific submodules in ./pdf/:
 * - pdfUtils: Shared utilities, company info resolution, date/tax formatting
 * - inventoryPdf.service: Stock, kardex, movements, transfers, valuation, turnover
 * - statementsPdf.service: Customer/provider statements, aging, balances, receipts
 * - salesBillingPdf.service: Daily sales, POS, category, customer, RTEE, invalidations, profitability
 * - payrollPdf.service: Vacations, liquidations, finiquitos, honorarios, aguinaldos, planillas
 * - gasStationPdf.service: Closeouts, fuel inventory, galonaje, lubricants, complementarias, arqueos, analytics
 */

module.exports = require('./pdf/index');
