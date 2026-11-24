const { z } = require('zod');
const { optionalString, requiredString } = require('./schemaHelpers');

// Purchase Item Schema
const purchaseItemSchema = z.object({
    product_id: z.coerce.number().int().positive().optional().nullable(),
    descripcion: optionalString,
    nombre: optionalString,
    codigo: optionalString,
    codigo_barra: optionalString,
    cantidad: z.coerce.number().positive({ message: 'La cantidad debe ser mayor a 0' }),
    precio_unitario: z.coerce.number().min(0, { message: 'El precio unitario no puede ser negativo' }),
    tipo_compra: optionalString,
    tipo_item: z.coerce.number().optional(),
    total: z.coerce.number().optional().nullable(),
    fovial: z.coerce.number().optional().nullable(),
    cotrans: z.coerce.number().optional().nullable(),
    unidad_medida: optionalString
}).passthrough();

// Purchase Header Shape
const purchaseBaseShape = {
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
    num_quedan: optionalString,
    numero_quedan: optionalString,
    numero_control: optionalString,
    num_control: optionalString,
    sello_recepcion: optionalString,
    dias_credito: z.coerce.number().optional(),
    fecha_vencimiento: optionalString,
    total_nosujeta: z.coerce.number().optional(),
    total_exenta: z.coerce.number().optional(),
    total_gravada: z.coerce.number().optional(),
    iva: z.coerce.number().optional(),
    retencion: z.coerce.number().optional(),
    percepcion: z.coerce.number().optional(),
    fovial: z.coerce.number().optional(),
    cotrans: z.coerce.number().optional(),
    monto_total: z.coerce.number().optional(),
    period_year: z.coerce.number().optional(),
    period_month: z.coerce.number().optional(),
    documento_afectado: optionalString,
    fecha_afectada: optionalString,
    emitir_dte: z.boolean().optional(),
    codigo_generacion: optionalString,
    estado_dte: optionalString,
    items: z.array(purchaseItemSchema).min(1, { message: 'Debe incluir al menos un producto en la compra' })
};

const purchaseCreateSchema = z.object({
    ...purchaseBaseShape,
    dias_credito: purchaseBaseShape.dias_credito.default(0),
    total_nosujeta: purchaseBaseShape.total_nosujeta.default(0),
    total_exenta: purchaseBaseShape.total_exenta.default(0),
    total_gravada: purchaseBaseShape.total_gravada.default(0),
    iva: purchaseBaseShape.iva.default(0),
    retencion: purchaseBaseShape.retencion.default(0),
    percepcion: purchaseBaseShape.percepcion.default(0),
    fovial: purchaseBaseShape.fovial.default(0),
    cotrans: purchaseBaseShape.cotrans.default(0)
}).passthrough();
const purchaseUpdateSchema = z.object({
    ...purchaseBaseShape,
    items: z.array(purchaseItemSchema).optional()
}).partial().passthrough();

// Purchase Checks (Chq Contado)
const purchaseCheckShape = {
    branch_id: z.coerce.number().int().positive().optional().nullable(),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    monto: z.coerce.number().positive({ message: 'El monto debe ser mayor a 0' }),
    destino: z.enum(['P', 'T'], { message: 'El destino debe ser P (Pista) o T (Tienda)' })
};

const purchaseCheckSchema = z.object(purchaseCheckShape);
const purchaseCheckUpdateSchema = z.object(purchaseCheckShape).partial();

// Purchase Check Branch Config
const purchaseCheckConfigSchema = z.object({
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    rrs_id_empresa: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ message: 'El ID Empresa RRS es requerido' }).min(1, { message: 'El ID Empresa RRS no puede estar vacío' })
    ),
    cod_destino: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ message: 'El código de destino es requerido' }).min(1, { message: 'El código de destino no puede estar vacío' })
    )
});

// Quedan Items
const quedanItemSchema = z.object({
    fecha: optionalString,
    documento: optionalString,
    gravadas: z.coerce.number().optional().default(0),
    iva: z.coerce.number().optional().default(0),
    retencion: z.coerce.number().optional().default(0),
    percepcion: z.coerce.number().optional().default(0),
    exentas: z.coerce.number().optional().default(0),
    total: z.coerce.number().optional().nullable(),
    tipo: optionalString.default('CCF')
}).passthrough();

// Quedan Header
const quedanBaseShape = {
    branch_id: z.coerce.number().int().positive().optional().nullable(),
    num_quedan: requiredString('El número de quedan es requerido'),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    dias_credito: z.coerce.number().optional(),
    fecha_vencimiento: optionalString,
    destino: optionalString,
    items: z.array(quedanItemSchema).optional()
};

const quedanSchema = z.object({
    ...quedanBaseShape,
    dias_credito: quedanBaseShape.dias_credito.default(0),
    destino: quedanBaseShape.destino.default('T'),
    items: quedanBaseShape.items.default([])
}).passthrough();
const quedanUpdateSchema = z.object(quedanBaseShape).partial().passthrough();

module.exports = {
    purchaseItemSchema,
    purchaseCreateSchema,
    purchaseUpdateSchema,
    purchaseCheckSchema,
    purchaseCheckUpdateSchema,
    purchaseCheckConfigSchema,
    quedanItemSchema,
    quedanSchema,
    quedanUpdateSchema
};
