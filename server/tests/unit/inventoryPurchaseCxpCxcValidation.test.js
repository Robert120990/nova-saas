const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    inventoryTransferSchema,
    inventoryPhysicalSchema,
    inventoryMotivoSchema,
    inventoryAdjustmentSchema,
    inventoryAdjustmentUpdateSchema
} = require('../../src/schemas/inventorySchemas');

const {
    purchaseCreateSchema,
    purchaseUpdateSchema,
    purchaseCheckSchema,
    purchaseCheckConfigSchema,
    quedanSchema
} = require('../../src/schemas/purchaseSchemas');

const {
    cxpPaymentSchema,
    cxpPaymentUpdateSchema
} = require('../../src/schemas/cxpSchemas');

const {
    cxcPaymentSchema,
    cxcPaymentUpdateSchema
} = require('../../src/schemas/cxcSchemas');

const {
    expenseCreateSchema,
    expenseUpdateSchema
} = require('../../src/schemas/expenseSchemas');

describe('Inventario, Compras, Gastos, CXP y CXC Schemas Validation', () => {

    describe('Inventario Schemas', () => {
        test('should validate a correct inventory transfer', () => {
            const valid = {
                origen_branch_id: 1,
                destino_branch_id: 2,
                observaciones: 'Traslado a sucursal 2',
                items: [{ product_id: 10, cantidad: 5 }]
            };
            const parsed = inventoryTransferSchema.safeParse(valid);
            assert.equal(parsed.success, true);
        });

        test('should reject inventory transfer if origin and destination are the same', () => {
            const invalid = {
                origen_branch_id: 1,
                destino_branch_id: 1,
                items: [{ product_id: 10, cantidad: 5 }]
            };
            const parsed = inventoryTransferSchema.safeParse(invalid);
            assert.equal(parsed.success, false);
            assert.match(parsed.error.issues[0].message, /no pueden ser iguales/);
        });

        test('should reject inventory transfer without items', () => {
            const invalid = {
                origen_branch_id: 1,
                destino_branch_id: 2,
                items: []
            };
            const parsed = inventoryTransferSchema.safeParse(invalid);
            assert.equal(parsed.success, false);
        });

        test('should validate physical inventory and adjustment motivo', () => {
            const phys = {
                fecha: '2026-09-23',
                branch_id: 1,
                responsable: 'Carlos',
                items: [{ product_id: 5, stock_sistema: 10, stock_fisico: 12 }]
            };
            assert.equal(inventoryPhysicalSchema.safeParse(phys).success, true);

            const motivo = { nombre: 'Merma por evaporación', tipo: 'SALIDA' };
            assert.equal(inventoryMotivoSchema.safeParse(motivo).success, true);
            assert.equal(inventoryMotivoSchema.safeParse({ nombre: '' }).success, false);
        });

        test('should validate inventory adjustment and reject invalid type', () => {
            const validAdj = {
                branch_id: 1,
                motivo_id: 2,
                tipo: 'ENTRADA',
                items: [{ product_id: 3, cantidad: 10, costo: 2.5 }]
            };
            assert.equal(inventoryAdjustmentSchema.safeParse(validAdj).success, true);

            const invalidAdj = { ...validAdj, tipo: 'OTRO' };
            assert.equal(inventoryAdjustmentSchema.safeParse(invalidAdj).success, false);

            const updateAdj = { numero: 'AJ-001', observaciones: 'Revisado' };
            assert.equal(inventoryAdjustmentUpdateSchema.safeParse(updateAdj).success, true);
        });
    });

    describe('Compras Schemas', () => {
        test('should validate purchase creation with items', () => {
            const validPurchase = {
                branch_id: 1,
                provider_id: 4,
                fecha: '2026-09-23',
                numero_documento: 'FAC-99881',
                tipo_documento_id: '03',
                condicion_operacion_id: '1',
                total_gravada: 100,
                iva: 13,
                monto_total: 113,
                items: [{ product_id: 1, cantidad: 10, precio_unitario: 10 }]
            };
            const parsed = purchaseCreateSchema.safeParse(validPurchase);
            assert.equal(parsed.success, true);
        });

        test('should reject purchase without items or missing document number', () => {
            const noItems = {
                branch_id: 1,
                provider_id: 4,
                fecha: '2026-09-23',
                numero_documento: 'FAC-1',
                tipo_documento_id: '03',
                condicion_operacion_id: '1',
                items: []
            };
            assert.equal(purchaseCreateSchema.safeParse(noItems).success, false);

            const noDoc = { ...noItems, items: [{ product_id: 1, cantidad: 1, precio_unitario: 10 }], numero_documento: '' };
            assert.equal(purchaseCreateSchema.safeParse(noDoc).success, false);
        });

        test('should validate purchase partial update', () => {
            const update = {
                observaciones: 'Compra rectificada',
                dias_credito: 30
            };
            assert.equal(purchaseUpdateSchema.safeParse(update).success, true);
        });

        test('should validate purchase check and reject invalid destino', () => {
            const validCheck = {
                fecha: '2026-09-23',
                provider_id: 2,
                monto: 150.50,
                destino: 'P'
            };
            assert.equal(purchaseCheckSchema.safeParse(validCheck).success, true);

            const invalidCheck = { ...validCheck, destino: 'X' };
            assert.equal(purchaseCheckSchema.safeParse(invalidCheck).success, false);
        });

        test('should validate purchase check config and quedan', () => {
            const validConfig = {
                branch_id: 1,
                rrs_id_empresa: 'RRS-01',
                cod_destino: 'DES-02'
            };
            assert.equal(purchaseCheckConfigSchema.safeParse(validConfig).success, true);
            assert.equal(purchaseCheckConfigSchema.safeParse({ branch_id: 1, rrs_id_empresa: '', cod_destino: '' }).success, false);

            const validQuedan = {
                num_quedan: 'Q-1002',
                provider_id: 5,
                fecha: '2026-09-23',
                items: [{ documento: 'CCF-001', gravadas: 50, iva: 6.5 }]
            };
            assert.equal(quedanSchema.safeParse(validQuedan).success, true);
            assert.equal(quedanSchema.safeParse({ ...validQuedan, num_quedan: '' }).success, false);
        });
    });

    describe('CXP Schemas', () => {
        test('should validate CXP payment registration with valid documents', () => {
            const validPayment = {
                provider_id: 2,
                branch_id: 1,
                fecha_pago: '2026-09-23',
                metodo_pago: 'TRANSFERENCIA',
                referencia: 'TR-102938',
                documentos: [
                    { purchase_id: 10, monto: 75.25 },
                    { expense_id: 4, monto: 0 }
                ]
            };
            const parsed = cxpPaymentSchema.safeParse(validPayment);
            assert.equal(parsed.success, true);
        });

        test('should reject CXP payment when all document montos are zero or empty', () => {
            const invalidPayment = {
                provider_id: 2,
                branch_id: 1,
                fecha_pago: '2026-09-23',
                metodo_pago: 'EFECTIVO',
                documentos: [
                    { purchase_id: 10, monto: 0 }
                ]
            };
            const parsed = cxpPaymentSchema.safeParse(invalidPayment);
            assert.equal(parsed.success, false);
            assert.match(parsed.error.issues[0].message, /mayor a cero/);
        });

        test('should validate CXP payment update', () => {
            const update = {
                monto: 120.00,
                metodo_pago: 'CHEQUE',
                fecha_pago: '2026-09-24'
            };
            assert.equal(cxpPaymentUpdateSchema.safeParse(update).success, true);
        });
    });

    describe('CXC Schemas', () => {
        test('should validate CXC payment registration with valid documents', () => {
            const validPayment = {
                customer_id: 7,
                branch_id: 1,
                fecha_pago: '2026-09-23',
                metodo_pago: 'EFECTIVO',
                documentos: [
                    { sale_id: 101, monto: 50.00 }
                ]
            };
            const parsed = cxcPaymentSchema.safeParse(validPayment);
            assert.equal(parsed.success, true);
        });

        test('should reject CXC payment when documents list has zero amount', () => {
            const invalidPayment = {
                customer_id: 7,
                branch_id: 1,
                fecha_pago: '2026-09-23',
                metodo_pago: 'EFECTIVO',
                documentos: [
                    { sale_id: 101, monto: 0 }
                ]
            };
            const parsed = cxcPaymentSchema.safeParse(invalidPayment);
            assert.equal(parsed.success, false);
            assert.match(parsed.error.issues[0].message, /mayor a cero/);
        });

        test('should validate CXC payment update', () => {
            const update = {
                monto: 35.50,
                referencia: 'ABONO-01'
            };
            assert.equal(cxcPaymentUpdateSchema.safeParse(update).success, true);
        });
    });

    describe('Gastos Schemas', () => {
        test('should validate expense creation with optional items', () => {
            const validExpense = {
                branch_id: 1,
                provider_id: 3,
                fecha: '2026-09-23',
                numero_documento: 'REC-001',
                tipo_documento_id: '01',
                condicion_operacion_id: '1',
                total_gravada: 50.00,
                iva: 6.50,
                monto_total: 56.50,
                items: [
                    { description: 'Reparación de tubería', total: 56.50, tax_type: 'gravada' }
                ]
            };
            const parsed = expenseCreateSchema.safeParse(validExpense);
            assert.equal(parsed.success, true);
        });

        test('should reject expense creation when missing provider or document number', () => {
            const invalidExpense = {
                branch_id: 1,
                fecha: '2026-09-23',
                tipo_documento_id: '01',
                condicion_operacion_id: '1'
            };
            const parsed = expenseCreateSchema.safeParse(invalidExpense);
            assert.equal(parsed.success, false);
        });

        test('should validate expense update partial', () => {
            const update = {
                observaciones: 'Ajuste de partida contable',
                monto_total: 60.00
            };
            assert.equal(expenseUpdateSchema.safeParse(update).success, true);
        });
    });
});

