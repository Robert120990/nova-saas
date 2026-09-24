const { z } = require('zod');
const { optionalString, requiredString } = require('./schemaHelpers');

// Expense Item Schema
const expenseItemSchema = z.object({
    description: optionalString,
    expense_type_id: z.coerce.number().int().positive().optional().nullable(),
    tax_type: optionalString.default('gravada'),
    total: z.coerce.number().min(0, { message: 'El total del ítem no puede ser negativo' }).optional().default(0)
});

// Expense Base Shape
const expenseBaseShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    numero_documento: requiredString('El número de documento es requerido'),
    tipo_documento_id: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ message: 'El tipo de documento es requerido' }).min(1, { message: 'El tipo de documento es requerido' })
    ),
    condicion_operacion_id: z.union([z.string().min(1), z.number().int().positive()], { message: 'La condición de operación es requerida' }),
    observaciones: optionalString,
    total_nosujeta: z.coerce.number().optional().default(0),
    total_exenta: z.coerce.number().optional().default(0),
    total_gravada: z.coerce.number().optional().default(0),
    iva: z.coerce.number().optional().default(0),
    retencion: z.coerce.number().optional().default(0),
    percepcion: z.coerce.number().optional().default(0),
    fovial: z.coerce.number().optional().default(0),
    cotrans: z.coerce.number().optional().default(0),
    anticipo_cuenta: z.coerce.number().optional().default(0),
    monto_sujeto: z.coerce.number().optional().default(0),
    monto_total: z.coerce.number().optional().default(0),
    period_year: z.coerce.number().optional(),
    period_month: z.coerce.number().optional(),
    documento_afectado: optionalString,
    fecha_afectada: optionalString,
    num_control: optionalString,
    sello_recepcion: optionalString,
    tipo_operacion: optionalString,
    tipo_clasificacion: optionalString,
    tipo_sector: optionalString,
    tipo_costo: optionalString,
    gravadas_importaciones: z.coerce.number().optional().default(0),
    gravadas_internaciones: z.coerce.number().optional().default(0),
    iva_importaciones: z.coerce.number().optional().default(0),
    items: z.array(expenseItemSchema).optional()
};

const expenseCreateSchema = z.object(expenseBaseShape);
const expenseUpdateSchema = z.object(expenseBaseShape).partial();

module.exports = {
    expenseItemSchema,
    expenseCreateSchema,
    expenseUpdateSchema
};
