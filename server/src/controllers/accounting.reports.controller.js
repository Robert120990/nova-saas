/**
 * Accounting Reports Controller (Facade / Barrel Export)
 * 
 * Modularized into:
 * - ./accounting/accountingBooks.controller.js (Libros Diario, Mayor, Auxiliares, Partidas, Retenciones)
 * - ./accounting/accountingFinancial.controller.js (Balances, Estados de Resultados, Flujos, Cédulas)
 * - ./accounting/accountingReportUtils.js (Helpers, cabeceras, firmas y formatos)
 */

const accountingBooks = require('./accounting/accountingBooks.controller');
const accountingFinancial = require('./accounting/accountingFinancial.controller');

module.exports = {
    ...accountingBooks,
    ...accountingFinancial
};
