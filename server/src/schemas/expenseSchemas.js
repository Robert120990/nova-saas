const { z } = require('zod');
const { optionalString } = require('./schemaHelpers');

// Expense Item Schema
const expenseItemSchema = z.object({
    description: optionalString,
    expense_type_id: z.coerce.number().int().positive().optional().nullable(),
    tax_type: optionalString.default('gravada'),
    tipo_item: z.coerce.number().optional(),
    cantidad: z.coerce.number().optional(),
    precio_unitario: z.coerce.number().optional(),
    total: z.coerce.number().optional().default(0)
}).passthrough();

// Expense Base Shape
const expenseBaseShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    numero_documento: z.preprocess(
        val => {
            if (val === undefined || val === null) return 'S/N';
            const str = String(val).trim();
            return str === '' ? 'S/N' : str;
        },
        z.string().default('S/N')
    ),
    tipo_documento_id: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ message: 'El tipo de documento es requerido' }).min(1, { message: 'El tipo de documento es requerido' })
    ),
    condicion_operacion_id: z.union([z.string().min(1), z.number().int().positive()], { message: 'La condición de operación es requerida' }),
    observaciones: optionalString,
    total_nosujeta: z.coerce.number().optional(),
    total_exenta: z.coerce.number().optional(),
    total_gravada: z.coerce.number().optional(),
    iva: z.coerce.number().optional(),
    retencion: z.coerce.number().optional(),
    percepcion: z.coerce.number().optional(),
    fovial: z.coerce.number().optional(),
    cotrans: z.coerce.number().optional(),
    anticipo_cuenta: z.coerce.number().optional(),
    monto_sujeto: z.coerce.number().optional(),
    monto_total: z.coerce.number().optional(),
    period_year: z.coerce.number().optional(),
    period_month: z.coerce.number().optional(),
    documento_afectado: optionalString,
    fecha_afectada: optionalString,
    num_control: optionalString,
    numero_control: optionalString,
    sello_recepcion: optionalString,
    tipo_operacion: optionalString,
    tipo_clasificacion: optionalString,
    tipo_sector: optionalString,
    tipo_costo: optionalString,
    gravadas_importaciones: z.coerce.number().optional(),
    gravadas_internaciones: z.coerce.number().optional(),
    iva_importaciones: z.coerce.number().optional(),
    emitir_dte: z.boolean().optional(),
    estado_dte: optionalString,
    codigo_generacion: optionalString,
    codigoGeneracion: optionalString,
    items: z.array(expenseItemSchema).optional()
};

const expenseCreateSchema = z.object({
    ...expenseBaseShape,
    total_nosujeta: expenseBaseShape.total_nosujeta.default(0),
    total_exenta: expenseBaseShape.total_exenta.default(0),
    total_gravada: expenseBaseShape.total_gravada.default(0),
    iva: expenseBaseShape.iva.default(0),
    retencion: expenseBaseShape.retencion.default(0),
    percepcion: expenseBaseShape.percepcion.default(0),
    fovial: expenseBaseShape.fovial.default(0),
    cotrans: expenseBaseShape.cotrans.default(0),
    anticipo_cuenta: expenseBaseShape.anticipo_cuenta.default(0),
    monto_sujeto: expenseBaseShape.monto_sujeto.default(0),
    monto_total: expenseBaseShape.monto_total.default(0),
    gravadas_importaciones: expenseBaseShape.gravadas_importaciones.default(0),
    gravadas_internaciones: expenseBaseShape.gravadas_internaciones.default(0),
    iva_importaciones: expenseBaseShape.iva_importaciones.default(0)
}).passthrough();
const expenseUpdateSchema = z.object(expenseBaseShape).partial().passthrough();

module.exports = {
    expenseItemSchema,
    expenseCreateSchema,
    expenseUpdateSchema
};
