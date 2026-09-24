const { z } = require('zod');

// Purchase Item Schema
const purchaseItemSchema = z.object({
    product_id: z.coerce.number().int().positive().optional().nullable(),
    descripcion: z.string().optional().nullable(),
    nombre: z.string().optional().nullable(),
    codigo: z.string().optional().nullable(),
    cantidad: z.coerce.number().positive({ message: 'La cantidad debe ser mayor a 0' }),
    precio_unitario: z.coerce.number().min(0, { message: 'El precio unitario no puede ser negativo' }),
    tipo_compra: z.string().optional().nullable(),
    total: z.coerce.number().optional().nullable(),
    fovial: z.coerce.number().optional().nullable(),
    cotrans: z.coerce.number().optional().nullable(),
    unidad_medida: z.string().optional().nullable()
});

// Purchase Header Shape
const purchaseBaseShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    numero_documento: z.string({ message: 'El número de documento es requerido' }).trim().min(1, { message: 'El número de documento es requerido' }),
    tipo_documento_id: z.string({ message: 'El tipo de documento es requerido' }).min(1, { message: 'El tipo de documento es requerido' }),
    condicion_operacion_id: z.union([z.string().min(1), z.number().int().positive()], { message: 'La condición de operación es requerida' }),
    observaciones: z.string().optional().nullable(),
    num_quedan: z.string().optional().nullable(),
    numero_quedan: z.string().optional().nullable(),
    numero_control: z.string().optional().nullable(),
    num_control: z.string().optional().nullable(),
    sello_recepcion: z.string().optional().nullable(),
    dias_credito: z.coerce.number().optional().default(0),
    fecha_vencimiento: z.string().optional().nullable(),
    total_nosujeta: z.coerce.number().optional().default(0),
    total_exenta: z.coerce.number().optional().default(0),
    total_gravada: z.coerce.number().optional().default(0),
    iva: z.coerce.number().optional().default(0),
    retencion: z.coerce.number().optional().default(0),
    percepcion: z.coerce.number().optional().default(0),
    fovial: z.coerce.number().optional().default(0),
    cotrans: z.coerce.number().optional().default(0),
    monto_total: z.coerce.number().optional(),
    period_year: z.coerce.number().optional(),
    period_month: z.coerce.number().optional(),
    documento_afectado: z.string().optional().nullable(),
    fecha_afectada: z.string().optional().nullable(),
    items: z.array(purchaseItemSchema).min(1, { message: 'Debe incluir al menos un producto en la compra' })
};

const purchaseCreateSchema = z.object(purchaseBaseShape);
const purchaseUpdateSchema = z.object({
    ...purchaseBaseShape,
    items: z.array(purchaseItemSchema).optional()
}).partial();

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
    rrs_id_empresa: z.string({ message: 'El ID Empresa RRS es requerido' }).trim().min(1, { message: 'El ID Empresa RRS no puede estar vacío' }),
    cod_destino: z.string({ message: 'El código de destino es requerido' }).trim().min(1, { message: 'El código de destino no puede estar vacío' })
});

// Quedan Items
const quedanItemSchema = z.object({
    documento: z.string().optional().nullable(),
    gravadas: z.coerce.number().optional().default(0),
    iva: z.coerce.number().optional().default(0),
    retencion: z.coerce.number().optional().default(0),
    percepcion: z.coerce.number().optional().default(0),
    exentas: z.coerce.number().optional().default(0),
    tipo: z.string().optional().default('FAC')
});

// Quedan Header
const quedanShape = {
    branch_id: z.coerce.number().int().positive().optional().nullable(),
    num_quedan: z.string({ message: 'El número de quedan es requerido' }).trim().min(1, { message: 'El número de quedan es requerido' }),
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    dias_credito: z.coerce.number().optional().default(0),
    fecha_vencimiento: z.string().optional().nullable(),
    destino: z.string().optional().default('T'),
    items: z.array(quedanItemSchema).optional().default([])
};

const quedanSchema = z.object(quedanShape);
const quedanUpdateSchema = z.object(quedanShape).partial();

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
