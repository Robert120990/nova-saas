const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateItem, calculateTotals, round } = require('../../src/utils/calculations');
const { validateDTE } = require('../../src/validators/schemaValidator');

test('DTE Calculations: Precision and 1-cent disparity prevention', async (t) => {
    await t.test('Case 1: Fuel CCF exact $200.00 inclusive sale with FOVIAL and COTRANS', () => {
        const item = calculateItem({
            cantidad: 39.5257,
            precioUnitario: 5.06,
            tipoItem: 1,
            tributos: [
                { codigo: 'D1', valor: 7.91 },
                { codigo: 'C8', valor: 3.95 }
            ]
        }, '03', 13);

        assert.equal(item.precioUnitario, 4.212338);
        assert.equal(item.ventaGravada, 166.50);
        assert.equal(item.ivaItem, 21.64);
        assert.equal(item.totalItemInclusive, 200.00);

        const taxes = [
            { codigo: 'D1', valor: 7.91 },
            { codigo: 'C8', valor: 3.95 }
        ];

        const totals = calculateTotals([item], taxes, '03', 0, 13);

        assert.equal(totals.subTotal, 166.50);
        assert.equal(totals.totalGravada, 166.50);
        assert.equal(totals.montoPorIVA, 21.64);
        assert.equal(totals.totalPagar, 200.00);

        const sumParts = round(totals.subTotal + totals.montoPorIVA + 7.91 + 3.95);
        assert.equal(sumParts, 200.00);
    });

    await t.test('Case 2: Massive price and gallonage simulation for CCF fuel sales', () => {
        const prices = [3.95, 4.10, 4.25, 4.85, 5.06, 5.20];
        let checked = 0;

        for (let targetAmount = 5; targetAmount <= 200; targetAmount += 4.5) {
            for (const price of prices) {
                const qty = Number((targetAmount / price).toFixed(4));
                const expectedTotal = round(qty * price);
                const fovial = round(qty * 0.20);
                const cotrans = round(qty * 0.10);

                const item = calculateItem({
                    cantidad: qty,
                    precioUnitario: price,
                    tipoItem: 1,
                    tributos: [
                        { codigo: 'D1', valor: fovial },
                        { codigo: 'C8', valor: cotrans }
                    ]
                }, '03', 13);

                const taxes = [
                    { codigo: 'D1', valor: fovial },
                    { codigo: 'C8', valor: cotrans }
                ];
                const totals = calculateTotals([item], taxes, '03', 0, 13);
                const sumParts = round(totals.subTotal + totals.montoPorIVA + fovial + cotrans);

                assert.equal(totals.totalPagar, expectedTotal, `totalPagar mismatch for target ${targetAmount}, price ${price}`);
                assert.equal(sumParts, totals.totalPagar, `sumParts mismatch for target ${targetAmount}, price ${price}`);
                checked++;
            }
        }

        assert.ok(checked > 100, `Expected over 100 cases tested, got ${checked}`);
    });

    await t.test('Case 3: Non-fuel products with inclusive prices should not desynchronize', () => {
        // e.g. 1 item with price 100.00 inclusive
        const item = calculateItem({
            cantidad: 1,
            precioUnitario: 100.00,
            tipoItem: 1,
            tributos: []
        }, '03', 13);

        const totals = calculateTotals([item], [], '03', 0, 13);

        assert.equal(totals.subTotal, 88.50);
        assert.equal(totals.montoPorIVA, 11.50);
        assert.equal(totals.totalPagar, 100.00);
        assert.equal(round(totals.subTotal + totals.montoPorIVA), 100.00);
    });

    await t.test('Case 4: Fuel sale with general discount', () => {
        const item = calculateItem({
            cantidad: 39.5257,
            precioUnitario: 5.06,
            tipoItem: 1,
            tributos: [
                { codigo: 'D1', valor: 7.91 },
                { codigo: 'C8', valor: 3.95 }
            ]
        }, '03', 13);

        const taxes = [
            { codigo: 'D1', valor: 7.91 },
            { codigo: 'C8', valor: 3.95 }
        ];

        // Apply $10 inclusive general discount
        const totals = calculateTotals([item], taxes, '03', 10, 13);

        assert.equal(totals.totalPagar, 190.00);
        const sumParts = round(totals.subTotal + totals.montoPorIVA + 7.91 + 3.95);
        assert.equal(sumParts, 190.00);
    });
});
