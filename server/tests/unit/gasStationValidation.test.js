const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    gasDistributorSchema,
    gasIslandSchema,
    gasNozzleSchema,
    gasTankSchema,
    gasDespachadorSchema,
    gasDespachadorNozzlesSchema,
    gasPosTypeSchema,
    gasExpenseCategorySchema
} = require('../../src/schemas/gasCatalogSchemas');

const {
    gasAdvanceSchema,
    gasTrupputSchema,
    gasRemesaDeliverySchema,
    gasCouponLiquidationSchema
} = require('../../src/schemas/gasOpsSchemas');

const {
    initCloseoutSchema,
    batchReadingsSchema,
    singleReadingUpdateSchema,
    closeoutFechaTurnoSchema,
    closeoutExpensesSchema,
    closeoutTarjetasSchema,
    closeoutCreditosSchema
} = require('../../src/schemas/gasCloseoutSchemas');

describe('Gas Station Module Validation', () => {

    describe('Gas Infrastructure & Catalogs Schemas', () => {
        test('should validate distributor and island', () => {
            const dist = { codigo: 'DIST-01', descripcion: 'Puma Energy' };
            assert.equal(gasDistributorSchema.safeParse(dist).success, true);
            assert.equal(gasDistributorSchema.safeParse({ codigo: '' }).success, false);

            const island = { codigo: 'ISLA-1', descripcion: 'Isla Central' };
            assert.equal(gasIslandSchema.safeParse(island).success, true);
        });

        test('should validate nozzle with product and island', () => {
            const nozzle = {
                codigo: 'MANG-01',
                island_id: 1,
                product_id: 10,
                descripcion: 'Super Isla 1'
            };
            assert.equal(gasNozzleSchema.safeParse(nozzle).success, true);
            assert.equal(gasNozzleSchema.safeParse({ codigo: 'MANG-01' }).success, false);
        });

        test('should validate tank, despachador and pos types', () => {
            const tank = { codigo: 'TK-01', capacidad: 5000, tipo_combustible: 1 };
            assert.equal(gasTankSchema.safeParse(tank).success, true);

            const despachador = { codigo: 'DESP-01', descripcion: 'Juan Pérez' };
            assert.equal(gasDespachadorSchema.safeParse(despachador).success, true);

            const nozzles = { nozzle_ids: [1, 2, 3] };
            assert.equal(gasDespachadorNozzlesSchema.safeParse(nozzles).success, true);

            const posType = { nombre: 'BAC Credomatic' };
            assert.equal(gasPosTypeSchema.safeParse(posType).success, true);

            const rubro = { name: 'Agua y Café' };
            assert.equal(gasExpenseCategorySchema.safeParse(rubro).success, true);
        });
    });

    describe('Gas Operations Schemas', () => {
        test('should validate gas advance and reject zero payment', () => {
            const validAdvance = {
                cliente_id: 5,
                cliente_nombre: 'Transportes SA',
                efectivo: 100.00
            };
            assert.equal(gasAdvanceSchema.safeParse(validAdvance).success, true);

            const zeroAdvance = {
                cliente_id: 5,
                efectivo: 0,
                tarjeta: 0
            };
            const parsed = gasAdvanceSchema.safeParse(zeroAdvance);
            assert.equal(parsed.success, false);
            assert.match(parsed.error.issues[0].message, /mayor a 0/);
        });

        test('should validate trupput and reject negative or zero gallons', () => {
            const validTrupput = {
                cliente_id: 4,
                galones: 250.5,
                precio: 3.85
            };
            assert.equal(gasTrupputSchema.safeParse(validTrupput).success, true);
            assert.equal(gasTrupputSchema.safeParse({ cliente_id: 4, galones: 0 }).success, false);
        });

        test('should validate remesa delivery and reject when empty', () => {
            const validDelivery = {
                fecha: '2026-09-23',
                hora: '14:30',
                referencia: 'REM-10023',
                remesa_ids: [1, 2]
            };
            assert.equal(gasRemesaDeliverySchema.safeParse(validDelivery).success, true);

            const emptyDelivery = {
                fecha: '2026-09-23',
                hora: '14:30',
                referencia: 'REM-10023',
                remesa_ids: [],
                remesas_extra: []
            };
            assert.equal(gasRemesaDeliverySchema.safeParse(emptyDelivery).success, false);
        });

        test('should validate coupon liquidation with items', () => {
            const validLiq = {
                branch_id: 1,
                distribuidora_nombre: 'DLC El Salvador',
                items: [
                    { cupon: 'CUP-99881', monto_sistema: 25.00, monto_fisico: 25.00, estado_conciliacion: 'conciliado' }
                ]
            };
            assert.equal(gasCouponLiquidationSchema.safeParse(validLiq).success, true);
            assert.equal(gasCouponLiquidationSchema.safeParse({ branch_id: 1, items: [] }).success, false);
        });
    });

    describe('Gas Closeout Schemas', () => {
        test('should validate init closeout and reject missing fields', () => {
            const validInit = {
                seller_id: 1,
                seller_name: 'Ana López',
                fecha_turno: '2026-09-23',
                numero_turno: 1
            };
            assert.equal(initCloseoutSchema.safeParse(validInit).success, true);
            assert.equal(initCloseoutSchema.safeParse({ seller_id: 1 }).success, false);

            // Validar despachadores como arreglo de objetos (formato enviado por GasCloseout frontend)
            const initWithObjects = {
                seller_id: 17,
                seller_name: 'Alonso Rivera',
                fecha_turno: '2026-09-24',
                numero_turno: 1,
                despachadores: [
                    { despachador_id: 1, nombre: 'C01' },
                    { despachador_id: 2, nombre: 'C02' }
                ],
                nozzle_assignments: [
                    { despachador_id: 1, nozzle_ids: [1, 2] }
                ]
            };
            const parsedObjects = initCloseoutSchema.safeParse(initWithObjects);
            assert.equal(parsedObjects.success, true);
            assert.equal(parsedObjects.data.despachadores.length, 2);

            // Validar despachadores como arreglo de IDs numéricos
            const initWithNumbers = {
                seller_id: 17,
                fecha_turno: '2026-09-24',
                numero_turno: 1,
                despachadores: [1, 2, 3]
            };
            const parsedNumbers = initCloseoutSchema.safeParse(initWithNumbers);
            assert.equal(parsedNumbers.success, true);
            assert.deepEqual(parsedNumbers.data.despachadores, [1, 2, 3]);
        });

        test('should validate batch readings and single reading update', () => {
            const batch = {
                readings: [
                    { readingId: 1, lectura_actual: 15420.5 }
                ]
            };
            assert.equal(batchReadingsSchema.safeParse(batch).success, true);
            assert.equal(batchReadingsSchema.safeParse({ readings: [] }).success, false);

            const single = { lectura_actual: 120.4, calibracion: 1.5 };
            assert.equal(singleReadingUpdateSchema.safeParse(single).success, true);

            const changeDate = { fecha_turno: '2026-09-24' };
            assert.equal(closeoutFechaTurnoSchema.safeParse(changeDate).success, true);
        });

        test('should validate closeout collections (expenses, tarjetas, creditos)', () => {
            const exp = {
                expenses: [{ id: 1, despachador_id: 1, rubro: 'Limpieza', monto: 15.00, valor: 15.00, proveedor: 'Prov S.A.' }]
            };
            const parsedExp = closeoutExpensesSchema.safeParse(exp);
            assert.equal(parsedExp.success, true);
            assert.equal(parsedExp.data.expenses[0].proveedor, 'Prov S.A.');

            const tarj = {
                tarjetas: [{
                    id: 99,
                    num_tarjeta: '-4321',
                    num_autorizacion: 'AUTH-123456',
                    pos_type_id: 2,
                    despachador_id: 1,
                    tipo_operacion: 'venta_combustible',
                    monto: 45.00
                }]
            };
            const parsedTarj = closeoutTarjetasSchema.safeParse(tarj);
            assert.equal(parsedTarj.success, true);
            assert.equal(parsedTarj.data.tarjetas[0].num_autorizacion, 'AUTH-123456');
            assert.equal(parsedTarj.data.tarjetas[0].num_tarjeta, '-4321');
            assert.equal(parsedTarj.data.tarjetas[0].tipo_operacion, 'venta_combustible');

            const cred = {
                creditos: [{ id: 5, despachador_id: 1, cliente_id: 4, monto: 80.00, placa: 'P123-456' }]
            };
            const parsedCred = closeoutCreditosSchema.safeParse(cred);
            assert.equal(parsedCred.success, true);
            assert.equal(parsedCred.data.creditos[0].placa, 'P123-456');

            // Validar que strings vacíos en selects opcionales (ej: provider_id: '', despachador_id: '') se transformen en null sin error
            const expWithEmptySelects = {
                expenses: [{ despachador_id: '', provider_id: '', rubro: 'Varios', monto: 10.00 }]
            };
            const parsedEmptyExp = closeoutExpensesSchema.safeParse(expWithEmptySelects);
            assert.equal(parsedEmptyExp.success, true);
            assert.equal(parsedEmptyExp.data.expenses[0].despachador_id, null);
            assert.equal(parsedEmptyExp.data.expenses[0].provider_id, null);
        });
    });
});
