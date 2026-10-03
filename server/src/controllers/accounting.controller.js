module.exports = {
    ...require('./accounting/accountingCatalog.controller'),
    ...require('./accounting/accountingEntries.controller'),
    ...require('./accounting/accountingFiscal.controller'),
    ...require('./accounting/accountingSettings.controller'),
    ...require('./accounting/accountingImport.controller'),
};
