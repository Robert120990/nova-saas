const { z } = require('zod');

/**
 * Validation schemas for POS Points of Sale & Cash Shifts (Turnos de Caja / Arqueos)
 */

const posShape = {
    nombre: z.string({ required_error: 'El nombre del punto de venta es requerido' })
        .trim().min(1, 'El nombre no puede estar vacío'),
    branch_id: z.coerce.number({ required_error: 'La sucursal es requerida' })
        .int('El ID de sucursal debe ser un número entero')
        .positive('Debe indicar una sucursal válida'),
    codigo: z.string().trim().nullable().optional(),
    allow_discounts: z.union([z.boolean(), z.number(), z.string()]).optional(),
    status: z.enum(['activo', 'inactivo']).default('activo').optional()
};

const posSchema = z.object(posShape);
const posUpdateSchema = z.object(posShape).partial();

const sellerItemSchema = z.union([
    z.object({
        seller_id: z.coerce.number().int().positive().optional(),
        id: z.coerce.number().int().positive().optional(),
        nombre: z.string().optional().nullable(),
        seller_name: z.string().optional().nullable()
    }).passthrough(),
    z.coerce.number().int().positive()
]);

const shiftOpenSchema = z.object({
    pos_id: z.coerce.number({ required_error: 'El punto de venta es requerido' })
        .int('El ID de punto de venta debe ser un número entero')
        .positive('Debe indicar un punto de venta válido'),
    branch_id: z.coerce.number({ required_error: 'La sucursal es requerida' })
        .int('El ID de sucursal debe ser un número entero')
        .positive('Debe indicar una sucursal válida'),
    seller_id: z.coerce.number({ required_error: 'El vendedor/cajero es requerido' })
        .int('El ID de vendedor debe ser un número entero')
        .positive('Debe indicar un vendedor válido'),
    opening_balance: z.coerce.number().min(0, 'El fondo de apertura no puede ser negativo').default(0).optional(),
    assigned_sellers: z.array(sellerItemSchema).optional()
});

const shiftArqueoExpenseSchema = z.object({
    description: z.string().trim().nullable().optional(),
    amount: z.coerce.number().min(0, 'El monto no puede ser negativo')
});

const shiftArqueoIncomeSchema = z.object({
    description: z.string().trim().nullable().optional(),
    amount: z.coerce.number().min(0, 'El monto no puede ser negativo'),
    payment_method: z.string().trim().optional()
});

const shiftArqueoRemesaSchema = z.object({
    description: z.string().trim().nullable().optional(),
    amount: z.coerce.number().min(0, 'El monto no puede ser negativo')
});

const shiftArqueoPuntoSchema = z.object({
    description: z.string().trim().nullable().optional(),
    amount: z.coerce.number().min(0, 'El monto no puede ser negativo')
});

const shiftArqueoSchema = z.object({
    actual_cash: z.coerce.number().min(0, 'El efectivo real no puede ser negativo').optional(),
    expenses: z.array(shiftArqueoExpenseSchema).optional().default([]),
    incomes: z.array(shiftArqueoIncomeSchema).optional().default([]),
    remesas: z.array(shiftArqueoRemesaSchema).optional().default([]),
    puntos: z.array(shiftArqueoPuntoSchema).optional().default([])
});

const shiftSellersUpdateSchema = z.object({
    seller_ids: z.array(sellerItemSchema).optional().default([])
});

const shiftUpdateSchema = z.object({
    seller_id: z.coerce.number().int().positive().optional(),
    pos_id: z.coerce.number().int().positive().optional(),
    opening_balance: z.coerce.number().min(0).optional(),
    shift_number: z.coerce.number().int().positive().optional()
});

module.exports = {
    posSchema,
    posUpdateSchema,
    shiftOpenSchema,
    shiftArqueoSchema,
    shiftSellersUpdateSchema,
    shiftUpdateSchema
};
