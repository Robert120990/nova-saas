const { z } = require('zod');
const { optionalString } = require('./schemaHelpers');

/**
 * Validation schemas for Combos, Promotions & Discount Rules
 */

const comboItemSchema = z.object({
    product_id: z.coerce.number({ required_error: 'El ID de producto es requerido' })
        .int('El ID de producto debe ser un entero')
        .positive('ID de producto inválido'),
    quantity: z.coerce.number({ required_error: 'La cantidad es requerida' })
        .positive('La cantidad debe ser mayor a cero')
});

const comboShape = {
    name: z.string({ required_error: 'El nombre del combo es requerido' })
        .trim().min(1, 'El nombre no puede estar vacío'),
    barcode: optionalString,
    description: optionalString,
    price: z.coerce.number({ required_error: 'El precio es requerido' })
        .min(0, 'El precio no puede ser negativo'),
    branch_id: z.coerce.number().int().positive().nullable().optional(),
    status: z.enum(['active', 'inactive']).default('active').optional(),
    items: z.array(comboItemSchema, { required_error: 'Los ítems del combo son requeridos' })
        .min(1, 'El combo debe tener al menos un producto')
};

const comboSchema = z.object(comboShape);
const comboUpdateSchema = z.object({
    ...comboShape,
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
    discount_type: z.enum(['percentage', 'fixed'], {
        required_error: 'El tipo de descuento es requerido'
    }),
    discount_value: z.coerce.number({ required_error: 'El valor de descuento es requerido' })
        .positive('El valor de descuento debe ser mayor a cero')
});

const discountRuleShape = {
    product_id: z.coerce.number({ required_error: 'El producto es requerido' })
        .int('El ID de producto debe ser un entero')
        .positive('Debe indicar un producto válido'),
    discount_type: z.enum(['percentage', 'fixed']).default('percentage').optional(),
    discount_value: z.coerce.number({ required_error: 'El valor de descuento es requerido' })
        .positive('El valor de descuento debe ser mayor a cero'),
    start_date: optionalString,
    end_date: optionalString,
    active: z.union([z.boolean(), z.number()]).optional()
};

const discountRuleSchema = z.object(discountRuleShape);
const discountRuleUpdateSchema = z.object(discountRuleShape).partial();

const promotionShape = {
    name: z.string({ required_error: 'El nombre de la promoción es requerido' })
        .trim().min(1, 'El nombre no puede estar vacío'),
    description: optionalString,
    branch_id: z.coerce.number().int().positive().nullable().optional(),
    promotion_type: z.enum(['nxm', 'second_unit_discount', 'bundle_fixed_price', 'volume_tier'], {
        required_error: 'El tipo de promoción es requerido'
    }),
    buy_quantity: z.coerce.number().positive().default(2).optional(),
    pay_quantity: z.coerce.number().positive().default(1).optional(),
    discount_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
    bundle_price: z.coerce.number().min(0).nullable().optional(),
    start_date: optionalString,
    end_date: optionalString,
    days_of_week: z.string().trim().default('1,2,3,4,5,6,7').optional(),
    start_time: optionalString,
    end_time: optionalString,
    max_applications_per_sale: z.coerce.number().int().positive().nullable().optional(),
    is_cumulative: z.boolean().default(false).optional(),
    active: z.union([z.boolean(), z.number()]).default(true).optional(),
    product_ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), product_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive()
        ]), {
        required_error: 'Debe seleccionar al menos un producto participante'
    }).min(1, 'Debe seleccionar al menos un producto participante')
};

const promotionSchema = z.object(promotionShape);
const promotionUpdateSchema = z.object({
    ...promotionShape,
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
