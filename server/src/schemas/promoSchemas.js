const { z } = require('zod');
const { optionalString, emptyToNullId } = require('./schemaHelpers');

/**
 * Validation schemas for Combos, Promotions & Discount Rules
 */

const comboItemSchema = z.object({
    product_id: z.coerce.number({ required_error: 'El ID de producto es requerido' })
        .int('El ID de producto debe ser un entero')
        .positive('ID de producto inválido'),
    quantity: z.coerce.number({ required_error: 'La cantidad es requerida' })
        .positive('La cantidad debe ser mayor a cero')
}).passthrough();

const comboBaseShape = {
    name: z.string({ required_error: 'El nombre del combo es requerido' })
        .trim().min(1, 'El nombre no puede estar vacío'),
    barcode: optionalString,
    description: optionalString,
    price: z.coerce.number({ required_error: 'El precio es requerido' })
        .min(0, 'El precio no puede ser negativo'),
    branch_id: emptyToNullId,
    status: z.enum(['active', 'inactive']).optional(),
    items: z.array(comboItemSchema, { required_error: 'Los ítems del combo son requeridos' })
        .min(1, 'El combo debe tener al menos un producto')
};

const comboSchema = z.object({
    ...comboBaseShape,
    status: comboBaseShape.status.default('active')
});
const comboUpdateSchema = z.object({
    ...comboBaseShape,
    items: z.array(comboItemSchema).optional()
}).partial();

const customerDiscountSchema = z.object({
    customer_id: z.coerce.number({ required_error: 'El cliente es requerido' })
        .int('El ID de cliente debe ser un entero')
        .positive('Debe indicar un cliente válido'),
    product_id: z.coerce.number({ required_error: 'El producto es requerido' })
        .int('El ID de producto debe ser un entero')
        .positive('Debe indicar un producto válido'),
    branch_id: z.coerce.number({ required_error: 'La sucursal es requerida' })
        .int('El ID de sucursal debe ser un entero')
        .positive('Debe indicar una sucursal válida'),
    discount_type: z.enum(['PORCENTAJE', 'VALOR', 'percentage', 'fixed'], {
        required_error: 'El tipo de descuento es requerido'
    }).transform((val) => val === 'percentage' ? 'PORCENTAJE' : val === 'fixed' ? 'VALOR' : val),
    discount_value: z.coerce.number({ required_error: 'El valor de descuento es requerido' })
        .positive('El valor de descuento debe ser mayor a cero')
});

const discountRuleBaseShape = {
    product_id: z.coerce.number({ required_error: 'El producto es requerido' })
        .int('El ID de producto debe ser un entero')
        .positive('Debe indicar un producto válido'),
    discount_type: z.enum(['percentage', 'fixed']).optional(),
    discount_value: z.coerce.number({ required_error: 'El valor de descuento es requerido' })
        .positive('El valor de descuento debe ser mayor a cero'),
    start_date: optionalString,
    end_date: optionalString,
    active: z.union([z.boolean(), z.number()]).optional()
};

const discountRuleSchema = z.object({
    ...discountRuleBaseShape,
    discount_type: discountRuleBaseShape.discount_type.default('percentage')
});
const discountRuleUpdateSchema = z.object(discountRuleBaseShape).partial();

const promotionBaseShape = {
    name: z.string({ required_error: 'El nombre de la promoción es requerido' })
        .trim().min(1, 'El nombre no puede estar vacío'),
    description: optionalString,
    branch_id: emptyToNullId,
    promotion_type: z.enum(['nxm', 'second_unit_discount', 'bundle_fixed_price', 'volume_tier'], {
        required_error: 'El tipo de promoción es requerido'
    }),
    buy_quantity: z.coerce.number().positive().optional(),
    pay_quantity: z.coerce.number().positive().optional(),
    discount_percentage: z.preprocess(
        val => (val === '' || val === null || val === undefined ? null : Number(val)),
        z.number().min(0).max(100).nullable().optional()
    ),
    bundle_price: z.preprocess(
        val => (val === '' || val === null || val === undefined ? null : Number(val)),
        z.number().min(0).nullable().optional()
    ),
    start_date: optionalString,
    end_date: optionalString,
    days_of_week: z.string().trim().optional(),
    start_time: optionalString,
    end_time: optionalString,
    max_applications_per_sale: emptyToNullId,
    is_cumulative: z.union([z.boolean(), z.number()]).optional(),
    active: z.union([z.boolean(), z.number()]).optional(),
    product_ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), product_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive()
        ]), {
        required_error: 'Debe seleccionar al menos un producto participante'
    }).min(1, 'Debe seleccionar al menos un producto participante')
};

const promotionSchema = z.object({
    ...promotionBaseShape,
    buy_quantity: promotionBaseShape.buy_quantity.default(2),
    pay_quantity: promotionBaseShape.pay_quantity.default(1),
    days_of_week: promotionBaseShape.days_of_week.default('1,2,3,4,5,6,7'),
    is_cumulative: promotionBaseShape.is_cumulative.default(false),
    active: promotionBaseShape.active.default(true)
});
const promotionUpdateSchema = z.object({
    ...promotionBaseShape,
    product_ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), product_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive()
        ])
    ).optional()
}).partial();

module.exports = {
    comboSchema,
    comboUpdateSchema,
    customerDiscountSchema,
    discountRuleSchema,
    discountRuleUpdateSchema,
    promotionSchema,
    promotionUpdateSchema
};
