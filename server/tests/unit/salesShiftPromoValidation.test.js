const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    saleCreateSchema,
    saleChangeShiftSchema,
    saleCustomerUpdateSchema,
    salesSettingsSchema,
    salesRemesaDeliverySchema,
    salesTiendaRrsSchema,
    editDTEItemsSchema
} = require('../../src/schemas/salesSchemas');

const {
    posSchema,
    posUpdateSchema,
    shiftOpenSchema,
    shiftArqueoSchema,
    shiftSellersUpdateSchema,
    shiftUpdateSchema
} = require('../../src/schemas/shiftSchemas');

const {
    comboSchema,
    comboUpdateSchema,
    customerDiscountSchema,
    discountRuleSchema,
    discountRuleUpdateSchema,
    promotionSchema,
    promotionUpdateSchema
} = require('../../src/schemas/promoSchemas');

describe('Ventas & Facturación Validation Schemas', () => {
    it('should validate a complete and valid saleCreate payload', () => {
        const payload = {
            header: {
                branch_id: 1,
                customer_id: 10,
                seller_id: 2,
                pos_id: 1,
                dte_type: '01',
                condicion_operacion: 1,
                total_pagar: 25.50
            },
            items: [
                {
                    product_id: 5,
                    descripcion: 'Producto de prueba',
                    cantidad: 2,
                    precio_unitario: 12.75,
                    monto_descuento: 0,
                    venta_gravada: 25.50
                }
            ],
            payments: [
                {
                    codigo: '01',
                    monto: 30.00
                }
            ]
        };

        const result = saleCreateSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.equal(result.data.header.total_pagar, 25.50);
        assert.equal(result.data.items[0].cantidad, 2);
    });

    it('should reject saleCreate when items are empty or missing', () => {
        const payload = {
            header: {
                dte_type: '01',
                total_pagar: 10.00
            },
            items: []
        };

        const result = saleCreateSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should reject saleCreate when item quantity is zero or negative', () => {
        const payload = {
            header: {
                dte_type: '01',
                total_pagar: 10.00
            },
            items: [
                {
                    descripcion: 'Gasolina',
                    cantidad: 0,
                    precio_unitario: 4.50
                }
            ]
        };

        const result = saleCreateSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should validate saleChangeShiftSchema with valid array of IDs', () => {
        const payload = { ids: [1, 2, 3], shift_id: 5 };
        const result = saleChangeShiftSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.deepEqual(result.data.ids, [1, 2, 3]);
        assert.equal(result.data.shift_id, 5);
    });

    it('should reject saleChangeShiftSchema when ids array is empty', () => {
        const payload = { ids: [], shift_id: 5 };
        const result = saleChangeShiftSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should validate salesRemesaDeliverySchema', () => {
        const payload = {
            fecha: '2026-09-23',
            hora: '14:30',
            referencia: 'REF-12345',
            remesa_ids: [10, 11],
            monto_entregado: 500.00
        };
        const result = salesRemesaDeliverySchema.safeParse(payload);
        assert.equal(result.success, true);
    });

    it('should validate salesTiendaRrsSchema', () => {
        const payload = {
            fecha: '2026-09-23',
            monto: 1540.25,
            branch_id: 1
        };
        const result = salesTiendaRrsSchema.safeParse(payload);
        assert.equal(result.success, true);
    });

    it('should validate saleCustomerUpdateSchema, salesSettingsSchema, and editDTEItemsSchema', () => {
        const custResult = saleCustomerUpdateSchema.safeParse({ nombre: 'Cliente Modificado', nit: '0614-010190-101-1' });
        assert.equal(custResult.success, true);

        const settingsResult = salesSettingsSchema.safeParse({ default_pos: 1, allow_credit: true });
        assert.equal(settingsResult.success, true);

        const editItemsResult = editDTEItemsSchema.safeParse({
            items: [{ sales_item_id: 1, descripcion: 'Descripción editada', cantidad: 1, precio_unitario: 10 }]
        });
        assert.equal(editItemsResult.success, true);
    });
});

describe('Turnos POS & Puntos de Venta Validation Schemas', () => {
    it('should validate posSchema and posUpdateSchema', () => {
        const validPos = {
            nombre: 'Caja Principal 1',
            branch_id: 1,
            codigo: 'POS-01',
            allow_discounts: true,
            status: 'activo'
        };
        const result = posSchema.safeParse(validPos);
        assert.equal(result.success, true);

        const partialUpdate = { nombre: 'Caja 1 Renombrada' };
        const updateResult = posUpdateSchema.safeParse(partialUpdate);
        assert.equal(updateResult.success, true);
    });

    it('should reject posSchema when branch_id is missing', () => {
        const invalidPos = { nombre: 'Caja Sin Sucursal' };
        const result = posSchema.safeParse(invalidPos);
        assert.equal(result.success, false);
    });

    it('should validate shiftOpenSchema with assigned sellers', () => {
        const payload = {
            pos_id: 1,
            branch_id: 1,
            seller_id: 2,
            opening_balance: 100.00,
            assigned_sellers: [2, 3, 4]
        };
        const result = shiftOpenSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.equal(result.data.opening_balance, 100);
    });

    it('should validate shiftArqueoSchema with expenses and remesas', () => {
        const payload = {
            actual_cash: 450.75,
            expenses: [{ description: 'Compra de bolsas', amount: 5.50 }],
            incomes: [{ description: 'Pago de cliente', amount: 20.00, payment_method: '01' }],
            remesas: [{ description: 'Remesa a mediodía', amount: 300.00 }],
            puntos: []
        };
        const result = shiftArqueoSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.equal(result.data.expenses.length, 1);
        assert.equal(result.data.remesas[0].amount, 300);
    });

    it('should validate shiftSellersUpdateSchema and shiftUpdateSchema', () => {
        const payload = { seller_ids: [1, 2, 5] };
        const result = shiftSellersUpdateSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.deepEqual(result.data.seller_ids, [1, 2, 5]);

        const updateResult = shiftUpdateSchema.safeParse({ opening_balance: 150.00, seller_id: 3 });
        assert.equal(updateResult.success, true);
    });
});

describe('Combos, Promociones & Descuentos Validation Schemas', () => {
    it('should validate comboSchema with valid items', () => {
        const payload = {
            name: 'Combo Desayuno',
            price: 5.99,
            branch_id: 1,
            status: 'active',
            items: [
                { product_id: 10, quantity: 1 },
                { product_id: 12, quantity: 2 }
            ]
        };
        const result = comboSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.equal(result.data.items.length, 2);
    });

    it('should reject comboSchema with empty items', () => {
        const payload = {
            name: 'Combo Vacío',
            price: 5.00,
            items: []
        };
        const result = comboSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should validate customerDiscountSchema', () => {
        const payload = {
            customer_id: 15,
            product_id: 100,
            branch_id: 1,
            discount_type: 'percentage',
            discount_value: 10.5
        };
        const result = customerDiscountSchema.safeParse(payload);
        assert.equal(result.success, true);
    });

    it('should reject customerDiscountSchema with invalid discount_type', () => {
        const payload = {
            customer_id: 15,
            product_id: 100,
            branch_id: 1,
            discount_type: 'unsupported_type',
            discount_value: 10.5
        };
        const result = customerDiscountSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should validate discountRuleSchema and discountRuleUpdateSchema', () => {
        const payload = {
            product_id: 25,
            discount_type: 'fixed',
            discount_value: 2.00,
            start_date: '2026-09-01',
            end_date: '2026-09-30'
        };
        const result = discountRuleSchema.safeParse(payload);
        assert.equal(result.success, true);

        const updateResult = discountRuleUpdateSchema.safeParse({ discount_value: 2.50 });
        assert.equal(updateResult.success, true);
    });

    it('should validate promotionSchema with product_ids', () => {
        const payload = {
            name: 'Promoción 2x1 Bebidas',
            promotion_type: 'nxm',
            buy_quantity: 2,
            pay_quantity: 1,
            product_ids: [101, 102]
        };
        const result = promotionSchema.safeParse(payload);
        assert.equal(result.success, true);
        assert.equal(result.data.promotion_type, 'nxm');
        assert.deepEqual(result.data.product_ids, [101, 102]);
    });

    it('should reject promotionSchema when product_ids is missing or empty', () => {
        const payload = {
            name: 'Promoción Sin Productos',
            promotion_type: 'second_unit_discount',
            product_ids: []
        };
        const result = promotionSchema.safeParse(payload);
        assert.equal(result.success, false);
    });

    it('should validate comboUpdateSchema and promotionUpdateSchema partial updates', () => {
        const comboUpResult = comboUpdateSchema.safeParse({ price: 6.50 });
        assert.equal(comboUpResult.success, true);

        const promoUpResult = promotionUpdateSchema.safeParse({ active: false, discount_percentage: 15 });
        assert.equal(promoUpResult.success, true);
    });
});
