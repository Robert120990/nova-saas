const salesAnexos = require('./vatHaciendaAnexos/salesAnexos.service');
const purchasesAnexos = require('./vatHaciendaAnexos/purchasesAnexos.service');
const retentionsAnexos = require('./vatHaciendaAnexos/retentionsAnexos.service');

const ANNEX_GENERATORS = {
    contribuyentes: salesAnexos.generateTaxpayersAnnexCsv,
    consumidor: salesAnexos.generateConsumersAnnexCsv,
    compras: purchasesAnexos.generatePurchasesAnnexCsv,
    sujetos_excluidos: purchasesAnexos.generateExcludedSubjectsAnnexCsv,
    anticipo_recibido: retentionsAnexos.generateAnticipoRecibidoAnnexCsv,
    retencion_recibida: retentionsAnexos.generateRetencionRecibidaAnnexCsv,
    percepcion_recibida: retentionsAnexos.generatePercepcionRecibidaAnnexCsv,
    percepcion_efectuada: retentionsAnexos.generatePercepcionEfectuadaAnnexCsv,
    retencion_efectuada: retentionsAnexos.generateRetencionEfectuadaAnnexCsv
};

const ANNEX_KEYS = Object.keys(ANNEX_GENERATORS);

/**
 * Generate CSV payload for any supported F-07 annex key.
 */
async function generateAnnexCsvByType(type, options) {
    const generator = ANNEX_GENERATORS[type];
    if (!generator) {
        const err = new Error(`Unsupported annex type: ${type}`);
        err.statusCode = 400;
        throw err;
    }
    return generator(options);
}

/**
 * Compute summary totals and document counts for all 9 Hacienda annexes.
 */
async function getHaciendaAnexosSummary({ companyId, branchId, year, month }) {
    const [
        taxpayerRows,
        consumerRows,
        purchaseRows,
        excludedRows,
        anticipoRecibidoRows,
        retencionRecibidaRows,
        percepcionRecibidaRows,
        percepcionEfectuadaRows,
        retencionEfectuadaRows
    ] = await Promise.all([
        salesAnexos.fetchTaxpayersSalesRows({ companyId, branchId, year, month }),
        salesAnexos.fetchConsumersSalesRows({ companyId, branchId, year, month }),
        purchasesAnexos.fetchPurchasesRows({ companyId, branchId, year, month }),
        purchasesAnexos.fetchExcludedSubjectsRows({ companyId, branchId, year, month }),
        retentionsAnexos.fetchAnticipoRecibidoRows({ companyId, branchId, year, month }),
        retentionsAnexos.fetchRetencionRecibidaRows({ companyId, branchId, year, month }),
        retentionsAnexos.fetchPercepcionRecibidaRows({ companyId, branchId, year, month }),
        retentionsAnexos.fetchPercepcionEfectuadaRows({ companyId, branchId, year, month }),
        retentionsAnexos.fetchRetencionEfectuadaRows({ companyId, branchId, year, month })
    ]);

    return {
        contribuyentes: salesAnexos.summarizeTaxpayers(taxpayerRows),
        consumidor: salesAnexos.summarizeConsumers(consumerRows),
        compras: purchasesAnexos.summarizePurchases(purchaseRows, year, month),
        sujetos_excluidos: purchasesAnexos.summarizeExcludedSubjects(excludedRows),
        anticipo_recibido: retentionsAnexos.summarizeTaxAnnexRows(anticipoRecibidoRows),
        retencion_recibida: retentionsAnexos.summarizeTaxAnnexRows(retencionRecibidaRows),
        percepcion_recibida: retentionsAnexos.summarizeTaxAnnexRows(percepcionRecibidaRows),
        percepcion_efectuada: retentionsAnexos.summarizeTaxAnnexRows(percepcionEfectuadaRows),
        retencion_efectuada: retentionsAnexos.summarizeTaxAnnexRows(retencionEfectuadaRows)
    };
}

module.exports = {
    ANNEX_KEYS,
    generateAnnexCsvByType,
    getHaciendaAnexosSummary,
    generateTaxpayersAnnexCsv: salesAnexos.generateTaxpayersAnnexCsv,
    generatePurchasesAnnexCsv: purchasesAnexos.generatePurchasesAnnexCsv
};
