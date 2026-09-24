const test = require('node:test');
const assert = require('node:assert/strict');
const {
    emptyToNull,
    requiredString,
    optionalString,
    emptyToNullId,
    safeNumber
} = require('../../src/schemas/schemaHelpers');

const { productSchema } = require('../../src/schemas/catalogSchemas');
const { branchCreateSchema } = require('../../src/schemas/companySchemas');
const { accountSchema } = require('../../src/schemas/accountingSchemas');
const { empleadoSchema } = require('../../src/schemas/rhSchemas');
const { closeoutExpensesSchema, closeoutTarjetasSchema } = require('../../src/schemas/gasCloseoutSchemas');
const { purchaseCreateSchema } = require('../../src/schemas/purchaseSchemas');
const { expenseCreateSchema } = require('../../src/schemas/expenseSchemas');
const { saleCreateSchema } = require('../../src/schemas/salesSchemas');
const { posSchema } = require('../../src/schemas/shiftSchemas');

test('Schema Helpers: Global Type Mismatch & Coercion Resilience', async (t) => {

    await t.test('emptyToNull handles numbers, strings, empty strings and nulls without throwing', () => {
        const schema = emptyToNull;
        assert.equal(schema.parse(''), null);
        assert.equal(schema.parse('   '), null);
        assert.equal(schema.parse(null), null);
        assert.equal(schema.parse(undefined), null);
        assert.equal(schema.parse('texto'), 'texto');
        assert.equal(schema.parse(12345), '12345');
        assert.equal(schema.parse(0), '0');
    });

    await t.test('requiredString coerces numbers to strings and enforces non-empty', () => {
        const schema = requiredString('Requerido');
        assert.equal(schema.parse(101), '101');
        assert.equal(schema.parse('ABC'), 'ABC');
        assert.throws(() => schema.parse(''), /Requerido/);
        assert.throws(() => schema.parse(null), /Requerido/);
        assert.throws(() => schema.parse(undefined), /Requerido/);
    });

    await t.test('optionalString safely accepts numbers and trims strings', () => {
        const schema = optionalString;
        assert.equal(schema.parse(9999), '9999');
        assert.equal(schema.parse('  hola  '), 'hola');
        assert.equal(schema.parse(''), null);
        assert.equal(schema.parse(null), null);
    });

    await t.test('emptyToNullId handles 0, "0", empty strings, and numeric IDs', () => {
        const schema = emptyToNullId;
        assert.equal(schema.parse(0), null);
        assert.equal(schema.parse('0'), null);
        assert.equal(schema.parse(''), null);
        assert.equal(schema.parse(null), null);
        assert.equal(schema.parse(5), 5);
        assert.equal(schema.parse('12'), 12);
    });

    await t.test('safeNumber handles NaN and empty values gracefully', () => {
        const schema = safeNumber(0);
        assert.equal(schema.parse(NaN), 0);
        assert.equal(schema.parse(''), 0);
        assert.equal(schema.parse(null), 0);
        assert.equal(schema.parse(undefined), 0);
        assert.equal(schema.parse(42.5), 42.5);
    });

    await t.test('Product schema validates payload with numeric fields and barcodes without type mismatch', () => {
        const productPayload = {
            codigo: 1001,
            nombre: 'Producto Prueba',
            codigo_barra: 74123456789,
            costo: 10.5,
            precio_unitario: 15.0,
            stock_minimo: 5,
            tipo_operacion: 1,
            tipo_combustible: 2,
            afecta_inventario: 1,
            permitir_existencia_negativa: 0
        };
        const parsed = productSchema.parse(productPayload);
        assert.equal(parsed.codigo, '1001');
        assert.equal(parsed.codigo_barra, '74123456789');
        assert.equal(parsed.tipo_operacion, 1);
        assert.equal(parsed.tipo_combustible, 2);
    });

    await t.test('Branch schema accepts numeric branch code and phone number', () => {
        const branchPayload = {
            codigo: 101,
            nombre: 'Sucursal Central',
            telefono: 22223333
        };
        const parsed = branchCreateSchema.parse(branchPayload);
        assert.equal(parsed.codigo, '101');
        assert.equal(parsed.telefono, '22223333');
    });

    await t.test('Accounting account schema accepts numeric code', () => {
        const accountPayload = {
            code: 110101,
            name: 'Caja General',
            account_type_id: 1
        };
        const parsed = accountSchema.parse(accountPayload);
        assert.equal(parsed.code, '110101');
    });

    await t.test('Employee schema accepts numeric code, phone and account', () => {
        const employeePayload = {
            codigo: 501,
            nombres: 'Juan',
            apellidos: 'Pérez',
            telefono: '2222-3333',
            cuenta_planillera: 9876543210
        };
        const parsed = empleadoSchema.parse(employeePayload);
        assert.equal(parsed.codigo, '501');
        assert.equal(parsed.cuenta_planillera, '9876543210');
    });

    await t.test('Gas Closeout schema accepts numeric documento, voucher and lote', () => {
        const expensesPayload = {
            expenses: [{
                rubro: 'Mantenimiento',
                documento: 45678,
                monto: 25.0
            }]
        };
        const parsedExp = closeoutExpensesSchema.parse(expensesPayload);
        assert.equal(parsedExp.expenses[0].documento, '45678');

        const cardsPayload = {
            tarjetas: [{
                voucher: 1234,
                lote: 5,
                num_tarjeta: 9876,
                monto: 50.0
            }]
        };
        const parsedCards = closeoutTarjetasSchema.parse(cardsPayload);
        assert.equal(parsedCards.tarjetas[0].voucher, '1234');
        assert.equal(parsedCards.tarjetas[0].lote, '5');
        assert.equal(parsedCards.tarjetas[0].num_tarjeta, '9876');
    });

    await t.test('Purchase schema accepts numeric numero_documento and num_quedan', () => {
        const purchasePayload = {
            branch_id: 1,
            provider_id: 2,
            fecha: '2026-09-24',
            numero_documento: 78910,
            tipo_documento_id: 1,
            condicion_operacion_id: 1,
            num_quedan: 345,
            items: [{
                codigo: 555,
                cantidad: 10,
                precio_unitario: 5.0
            }]
        };
        const parsed = purchaseCreateSchema.parse(purchasePayload);
        assert.equal(parsed.numero_documento, '78910');
        assert.equal(parsed.num_quedan, '345');
        assert.equal(parsed.items[0].codigo, '555');
    });

    await t.test('Expense schema accepts numeric numero_documento and tipo_operacion', () => {
        const expensePayload = {
            branch_id: 1,
            provider_id: 2,
            fecha: '2026-09-24',
            numero_documento: 12345,
            tipo_documento_id: 1,
            condicion_operacion_id: 1,
            tipo_operacion: 1
        };
        const parsed = expenseCreateSchema.parse(expensePayload);
        assert.equal(parsed.numero_documento, '12345');
        assert.equal(parsed.tipo_operacion, '1');
    });

    await t.test('Sale schema accepts numeric dte_type, item code and payment reference', () => {
        const salePayload = {
            header: {
                branch_id: 1,
                dte_type: 1,
                total_pagar: 10.0
            },
            items: [{
                codigo: 123,
                descripcion: 'Gasolina Regular',
                cantidad: 2.5,
                precio_unitario: 4.0
            }],
            payments: [{
                monto: 10.0,
                referencia: 888999
            }]
        };
        const parsed = saleCreateSchema.parse(salePayload);
        assert.equal(parsed.header.dte_type, '1');
        assert.equal(parsed.items[0].codigo, '123');
        assert.equal(parsed.payments[0].referencia, '888999');
    });

    await t.test('POS schema accepts numeric POS code', () => {
        const posPayload = {
            nombre: 'Caja 1',
            branch_id: 1,
            codigo: 101
        };
        const parsed = posSchema.parse(posPayload);
        assert.equal(parsed.codigo, '101');
    });
});
