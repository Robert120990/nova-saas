const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, database } = require('./eggTestHelpers.cjs');

const settings = {
    CUENTA_CAJA: 1, CUENTA_BANCOS: 2, CUENTA_CLIENTES_CXC: 3,
    CUENTA_VENTAS_GRAVADAS: 4, CUENTA_VENTAS_EXENTAS: 5, CUENTA_VENTAS_NOSUJETAS: 6,
    CUENTA_IVA_DEBITO: 7, CUENTA_FOVIAL_POR_PAGAR: 8, CUENTA_COTRANS_POR_PAGAR: 9, CUENTA_IVA_PERCIBIDO: 10,
    CUENTA_COMPRAS_GRAVADAS: 11, CUENTA_COMPRAS_EXENTAS: 12, CUENTA_IVA_CREDITO: 13,
    CUENTA_PROVEEDORES_CXP: 14, CUENTA_IVA_RETENIDO: 15
};
const sale = {
    id: 1, customer_id: 20, customer_nombre: 'Cliente', customer_account_id: 3,
    tipo_documento: '05', condicion_operacion: 2, total_gravado: '100.00', total_iva: '13.00',
    total_exento: 0, total_nosujetas: 0, fovial: 0, cotrans: 0, iva_percibido: 0, total_pagar: '113.00'
};
const purchase = {
    id: 1, provider_id: 20, provider_nombre: 'Proveedor', provider_account_id: 14,
    tipo_documento_id: '05', condicion_operacion_id: '2', total_gravada: '100.00', iva: '13.00',
    total_exenta: 0, total_nosujeta: 0, fovial: 0, cotrans: 0, retencion: 0, percepcion: 0, monto_total: '113.00'
};
function service(headers) {
    const db = database(async sql => [sql.includes('FROM sales_headers') || sql.includes('FROM purchase_headers') ? headers : []]);
    return load('src/services/accounting/accountingGenerationPreview.service.js', { 'src/config/db.js': db });
}

describe('Previsualización contable con saldos negativos y redondeos', () => {
    for (const detail of [false, true]) {
        it(`revierte una nota de crédito de venta sin convertirla en ingreso (auxiliares: ${detail})`, async () => {
            const result = await service([sale]).buildVentasPreview(7, '2026-10-01', detail, settings);
            const receivable = result.lines.find(line => line.account_id === 3);
            const revenue = result.lines.find(line => line.account_id === 4);
            const tax = result.lines.find(line => line.account_id === 7);
            assert.equal(receivable.debit, 0);
            assert.equal(receivable.credit, 113);
            assert.equal(revenue.debit, 100);
            assert.equal(revenue.credit, 0);
            assert.equal(tax.debit, 13);
            assert.equal(result.totals.balanced, true);
            assert.ok(!result.lines.some(line => line.description.startsWith('Ajuste')));
        });

        it(`revierte una nota de crédito de compra sin aumentar cuentas por pagar (auxiliares: ${detail})`, async () => {
            const result = await service([purchase]).buildComprasPreview(7, '2026-10-01', detail, settings);
            assert.equal(result.lines.find(line => line.account_id === 14).debit, 113);
            assert.equal(result.lines.find(line => line.account_id === 11).credit, 100);
            assert.equal(result.lines.find(line => line.account_id === 13).credit, 13);
            assert.equal(result.totals.balanced, true);
        });
    }

    it('corrige también un centavo para producir líneas aceptadas por el guardado estricto', async () => {
        const result = await service([{ ...purchase, tipo_documento_id: '03', monto_total: '113.01' }])
            .buildComprasPreview(7, '2026-10-01', false, settings);
        assert.equal(result.totals.debit, 113.01);
        assert.equal(result.totals.credit, 113.01);
        assert.equal(result.totals.diff, 0);
        assert.equal(result.lines.find(line => line.description.startsWith('Ajuste')).debit, 0.01);
    });

    it('un importe opcional nulo no elimina el IVA de otras compras del mismo día', async () => {
        const result = await service([
            { ...purchase, tipo_documento_id: '03', percepcion: null },
            { ...purchase, id: 2, tipo_documento_id: '03' }
        ]).buildComprasPreview(7, '2026-10-01', false, settings);
        assert.equal(result.lines.find(line => line.account_id === 13).debit, 26);
        assert.equal(result.source.iva, 26);
        assert.equal(result.totals.debit, 226);
    });

    it('consulta el IVA retenido y conserva la retención sin convertirla en ajuste de ventas', async () => {
        const db = database(async sql => {
            if (sql.includes('FROM sales_headers')) {
                assert.ok(sql.includes('h.iva_retenido'));
                return [[{ ...sale, tipo_documento: '03', condicion_operacion: '2', iva_retenido: 1, total_pagar: 112 }]];
            }
            return [[]];
        });
        const preview = load('src/services/accounting/accountingGenerationPreview.service.js', { 'src/config/db.js': db });
        const result = await preview.buildVentasPreview(7, '2026-10-01', false, settings);
        assert.equal(result.lines.find(line => line.account_id === 15).debit, 1);
        assert.equal(result.totals.debit, 113);
        assert.ok(!result.lines.some(line => line.description.startsWith('Ajuste')));
    });
});
