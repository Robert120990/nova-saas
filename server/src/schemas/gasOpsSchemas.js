const { z } = require('zod');
const { optionalString, requiredString, emptyToNullId } = require('./schemaHelpers');

// Gas Station Advances (Anticipos)
const gasAdvanceBaseShape = {
    cliente_id: z.coerce.number().int().positive({ message: 'El cliente es requerido' }),
    cliente_nombre: optionalString,
    notas: optionalString,
    fecha: optionalString,
    efectivo: z.coerce.number().min(0).optional(),
    tarjeta: z.coerce.number().min(0).optional(),
    tarjeta_referencia: optionalString,
    cheque: z.coerce.number().min(0).optional(),
    cheque_referencia: optionalString,
    transferencia: z.coerce.number().min(0).optional(),
    transferencia_referencia: optionalString
};

const gasAdvanceSchema = z.object({
    ...gasAdvanceBaseShape,
    efectivo: gasAdvanceBaseShape.efectivo.default(0),
    tarjeta: gasAdvanceBaseShape.tarjeta.default(0),
    cheque: gasAdvanceBaseShape.cheque.default(0),
    transferencia: gasAdvanceBaseShape.transferencia.default(0)
}).superRefine((data, ctx) => {
    const total = (data.efectivo || 0) + (data.tarjeta || 0) + (data.cheque || 0) + (data.transferencia || 0);
    if (total <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El monto total del anticipo debe ser mayor a 0',
            path: ['efectivo']
        });
    }
});

const gasAdvanceUpdateSchema = z.object(gasAdvanceBaseShape).partial();

// Gas Station Trupput (Prepago por galonaje)
const gasTrupputBaseShape = {
    cliente_id: z.coerce.number().int().positive({ message: 'El cliente es requerido' }),
    cliente_nombre: optionalString,
    galones: z.coerce.number().positive({ message: 'La cantidad de galones debe ser mayor a 0' }),
    precio: z.coerce.number().min(0, { message: 'El precio no puede ser negativo' }).optional(),
    notas: optionalString,
    fecha: optionalString
};

const gasTrupputSchema = z.object({
    ...gasTrupputBaseShape,
    precio: gasTrupputBaseShape.precio.default(0)
});
const gasTrupputUpdateSchema = z.object(gasTrupputBaseShape).partial();

// Gas Station Remesa Deliveries
const remesaExtraItemSchema = z.object({
    documento: optionalString,
    descripcion: optionalString,
    monto: z.coerce.number().optional().default(0)
}).passthrough();

const gasRemesaDeliveryBaseShape = {
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    hora: z.string({ message: 'La hora es requerida' }).min(1, { message: 'La hora es requerida' }),
    responsable: optionalString,
    comentario: optionalString,
    referencia: requiredString('El número de referencia es requerido'),
    remesa_ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), remesa_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive()
        ])
    ).optional(),
    remesas_extra: z.array(remesaExtraItemSchema).optional()
};

const gasRemesaDeliverySchema = z.object({
    ...gasRemesaDeliveryBaseShape,
    remesa_ids: gasRemesaDeliveryBaseShape.remesa_ids.default([]),
    remesas_extra: gasRemesaDeliveryBaseShape.remesas_extra.default([])
}).superRefine((data, ctx) => {
    const hasRemesas = data.remesa_ids && data.remesa_ids.length > 0;
    const hasExtras = data.remesas_extra && data.remesas_extra.some(x => parseFloat(x.monto) > 0);
    if (!hasRemesas && !hasExtras) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Debe seleccionar al menos una remesa o agregar remesas adicionales',
            path: ['remesa_ids']
        });
    }
});

const gasRemesaDeliveryUpdateSchema = z.object(gasRemesaDeliveryBaseShape).partial();

// Gas Station Coupon Liquidation (Conciliación de Cupones)
const couponLiquidationItemSchema = z.object({
    closeout_cupon_id: emptyToNullId,
    cupon: requiredString('El número de cupón es requerido'),
    distribuidora_id: emptyToNullId,
    distribuidora_nombre: optionalString,
    producto_codigo: optionalString,
    producto_descripcion: optionalString,
    despachador_id: emptyToNullId,
    despachador_nombre: optionalString,
    closeout_id: emptyToNullId,
    fecha_turno: optionalString,
    numero_turno: z.union([z.coerce.number().int().positive(), z.string()]).nullable().optional(),
    monto_sistema: z.coerce.number().optional().default(0),
    monto_fisico: z.coerce.number().optional().default(0),
    estado_conciliacion: z.enum(['conciliado', 'faltante', 'sobrante', 'pendiente']).optional().default('conciliado'),
    notas: optionalString,
    observacion: optionalString
}).passthrough();

const gasCouponLiquidationBaseShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    fecha: optionalString,
    distribuidora_id: emptyToNullId,
    distribuidora_nombre: optionalString,
    responsable: optionalString,
    comentario: optionalString,
    estado: z.enum(['borrador', 'liquidado', 'anulado']).optional(),
    items: z.array(couponLiquidationItemSchema).min(1, { message: 'Debe incluir al menos un cupón en la liquidación' })
};

const gasCouponLiquidationSchema = z.object({
    ...gasCouponLiquidationBaseShape,
    estado: gasCouponLiquidationBaseShape.estado.default('liquidado')
});
const gasCouponLiquidationUpdateSchema = z.object(gasCouponLiquidationBaseShape).partial();

module.exports = {
    gasAdvanceSchema,
    gasAdvanceUpdateSchema,
    gasTrupputSchema,
    gasTrupputUpdateSchema,
    gasRemesaDeliverySchema,
    gasRemesaDeliveryUpdateSchema,
    gasCouponLiquidationSchema,
    gasCouponLiquidationUpdateSchema
};
