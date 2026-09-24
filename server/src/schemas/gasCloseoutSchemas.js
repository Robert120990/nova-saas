const { z } = require('zod');
const { emptyToNullId, optionalString } = require('./schemaHelpers');

// Init Closeout
const initCloseoutSchema = z.object({
    seller_id: z.coerce.number().int().positive({ message: 'El vendedor/cajero es requerido' }),
    seller_name: optionalString,
    fecha_turno: z.string({ message: 'La fecha del turno es requerida' }).min(1, { message: 'La fecha del turno es requerida' }),
    numero_turno: z.coerce.number().int().positive({ message: 'El número de turno es requerido' }),
    despachadores: z.array(
        z.union([
            z.object({
                despachador_id: z.coerce.number().int().positive().optional(),
                id: z.coerce.number().int().positive().optional(),
                nombre: optionalString
            }).passthrough(),
            z.coerce.number().int().positive()
        ])
    ).optional().default([]),
    nozzle_assignments: z.array(z.any()).optional().default([])
}).passthrough();

// Update Readings
const batchReadingsSchema = z.object({
    readings: z.array(z.object({
        readingId: z.coerce.number().int().positive({ message: 'ID de lectura es requerido' }),
        lectura_actual: z.coerce.number({ message: 'La lectura actual debe ser numérica' })
    }).passthrough()).min(1, { message: 'El arreglo de lecturas es requerido' })
}).passthrough();

const singleReadingUpdateSchema = z.object({
    lectura_actual: z.coerce.number().optional(),
    calibracion: z.coerce.number().optional(),
    lectura_anterior: z.coerce.number().optional()
}).passthrough();

const singleTankReadingUpdateSchema = z.object({
    lectura_actual: z.coerce.number().optional(),
    recarga: z.coerce.number().optional(),
    lectura_anterior: z.coerce.number().optional()
}).passthrough();

const closeoutFechaTurnoSchema = z.object({
    fecha_turno: z.string({ message: 'La fecha de turno es requerida' }).min(1, { message: 'La fecha de turno es requerida' }),
    numero_turno: z.coerce.number().int().positive().optional()
}).passthrough();

// Closeout Collections
const closeoutExpensesSchema = z.object({
    expenses: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        rubro: optionalString,
        fecha: optionalString,
        documento: optionalString,
        tipo: optionalString,
        provider_id: emptyToNullId,
        proveedor: optionalString,
        valor: z.coerce.number().optional().nullable(),
        monto: z.coerce.number().optional().nullable(),
        descripcion: optionalString,
        comentario: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutRemesasSchema = z.object({
    remesas: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        codigo: optionalString,
        documento: optionalString,
        descripcion: optionalString,
        tipo_operacion: optionalString,
        monto: z.coerce.number().optional().default(0),
        entregada: z.union([z.number(), z.boolean()]).optional().nullable(),
        entrega_id: emptyToNullId
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutCuponesSchema = z.object({
    cupones: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        distribuidora_id: emptyToNullId,
        distribuidora_nombre: optionalString,
        producto_id: emptyToNullId,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        cupon: optionalString,
        monto: z.coerce.number().optional().default(0)
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutDescuentosSchema = z.object({
    descuentos: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        cliente_id: emptyToNullId,
        cliente_nombre: optionalString,
        documento: optionalString,
        producto_id: emptyToNullId,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        cantidad: z.coerce.number().optional().default(0),
        galones: z.coerce.number().optional().default(0),
        valor: z.coerce.number().optional().default(0),
        descuento_galon: z.coerce.number().optional().default(0),
        total: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0)
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutAdelantosSchema = z.object({
    adelantos: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        empleado: optionalString,
        cliente_id: emptyToNullId,
        monto: z.coerce.number().optional().default(0),
        notas: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutTarjetasSchema = z.object({
    tarjetas: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        num_tarjeta: optionalString,
        num_autorizacion: optionalString,
        pos_type_id: emptyToNullId,
        despachador_id: emptyToNullId,
        tipo_operacion: optionalString,
        monto: z.coerce.number().optional().default(0),
        lote: optionalString,
        voucher: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutCreditosSchema = z.object({
    creditos: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        cliente_id: emptyToNullId,
        cliente_nombre: optionalString,
        tipo_documento: optionalString,
        documento: optionalString,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        cantidad: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0),
        placa: optionalString,
        kilometraje: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutValesSchema = z.object({
    vales: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        cliente_id: emptyToNullId,
        cliente_nombre: optionalString,
        tipo_documento: optionalString,
        documento: optionalString,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        cantidad: z.coerce.number().optional().default(0),
        galones: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0),
        placa: optionalString,
        kilometraje: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutAnticiposDespSchema = z.object({
    anticipos: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        cliente_id: emptyToNullId,
        cliente_nombre: optionalString,
        anticipo_id: emptyToNullId,
        tipo_documento: optionalString,
        documento: optionalString,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        cantidad: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0),
        placa: optionalString,
        kilometraje: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutTrupputDespSchema = z.object({
    despachos: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        despachador_id: emptyToNullId,
        cliente_id: emptyToNullId,
        cliente_nombre: optionalString,
        trupput_id: emptyToNullId,
        documento: optionalString,
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        galones: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0),
        placa: optionalString,
        kilometraje: optionalString
    }).passthrough()).optional().default([])
}).passthrough();

const closeoutLubricantesSchema = z.object({
    readings: z.array(z.object({
        id: z.union([z.number(), z.string()]).optional().nullable(),
        producto_id: z.coerce.number().int().positive({ message: 'El producto es requerido' }),
        producto_codigo: optionalString,
        producto_descripcion: optionalString,
        lectura_inicial: z.coerce.number().optional().default(0),
        recarga: z.coerce.number().optional().default(0),
        lectura_final: z.coerce.number().optional().default(0),
        ventas: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        total: z.coerce.number().optional().default(0)
    }).passthrough()).optional().default([])
}).passthrough();

module.exports = {
    initCloseoutSchema,
    batchReadingsSchema,
    singleReadingUpdateSchema,
    singleTankReadingUpdateSchema,
    closeoutFechaTurnoSchema,
    closeoutExpensesSchema,
    closeoutRemesasSchema,
    closeoutCuponesSchema,
    closeoutDescuentosSchema,
    closeoutAdelantosSchema,
    closeoutTarjetasSchema,
    closeoutCreditosSchema,
    closeoutValesSchema,
    closeoutAnticiposDespSchema,
    closeoutTrupputDespSchema,
    closeoutLubricantesSchema
};
