const { z } = require('zod');

// Gas Station Advances (Anticipos)
const gasAdvanceShape = {
    cliente_id: z.coerce.number().int().positive({ message: 'El cliente es requerido' }),
    cliente_nombre: z.string().optional().nullable(),
    notas: z.string().optional().nullable(),
    fecha: z.string().optional().nullable(),
    efectivo: z.coerce.number().min(0).optional().default(0),
    tarjeta: z.coerce.number().min(0).optional().default(0),
    tarjeta_referencia: z.string().optional().nullable(),
    cheque: z.coerce.number().min(0).optional().default(0),
    cheque_referencia: z.string().optional().nullable(),
    transferencia: z.coerce.number().min(0).optional().default(0),
    transferencia_referencia: z.string().optional().nullable()
};

const gasAdvanceSchema = z.object(gasAdvanceShape).superRefine((data, ctx) => {
    const total = (data.efectivo || 0) + (data.tarjeta || 0) + (data.cheque || 0) + (data.transferencia || 0);
    if (total <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El monto total del anticipo debe ser mayor a 0',
            path: ['efectivo']
        });
    }
});

const gasAdvanceUpdateSchema = z.object(gasAdvanceShape).partial();

// Gas Station Trupput (Prepago por galonaje)
const gasTrupputShape = {
    cliente_id: z.coerce.number().int().positive({ message: 'El cliente es requerido' }),
    cliente_nombre: z.string().optional().nullable(),
    galones: z.coerce.number().positive({ message: 'La cantidad de galones debe ser mayor a 0' }),
    precio: z.coerce.number().min(0, { message: 'El precio no puede ser negativo' }).optional().default(0),
    notas: z.string().optional().nullable(),
    fecha: z.string().optional().nullable()
};

const gasTrupputSchema = z.object(gasTrupputShape);
const gasTrupputUpdateSchema = z.object(gasTrupputShape).partial();

// Gas Station Remesa Deliveries
const remesaExtraItemSchema = z.object({
    documento: z.string().optional().nullable(),
    descripcion: z.string().optional().nullable(),
    monto: z.coerce.number().optional().default(0)
});

const gasRemesaDeliveryShape = {
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    hora: z.string({ message: 'La hora es requerida' }).min(1, { message: 'La hora es requerida' }),
    responsable: z.string().optional().nullable(),
    comentario: z.string().optional().nullable(),
    referencia: z.string({ message: 'El número de referencia es requerido' }).trim().min(1, { message: 'El número de referencia es requerido' }),
    remesa_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
    remesas_extra: z.array(remesaExtraItemSchema).optional().default([])
};

const gasRemesaDeliverySchema = z.object(gasRemesaDeliveryShape).superRefine((data, ctx) => {
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

const gasRemesaDeliveryUpdateSchema = z.object(gasRemesaDeliveryShape).partial();

// Gas Station Coupon Liquidation (Conciliación de Cupones)
const couponLiquidationItemSchema = z.object({
    closeout_cupon_id: z.coerce.number().int().positive().optional().nullable(),
    cupon: z.string({ message: 'El número de cupón es requerido' }).trim().min(1, { message: 'El número de cupón es requerido' }),
    distribuidora_id: z.coerce.number().int().positive().optional().nullable(),
    distribuidora_nombre: z.string().optional().nullable(),
    producto_codigo: z.string().optional().nullable(),
    monto_sistema: z.coerce.number().optional().default(0),
    monto_fisico: z.coerce.number().optional().default(0),
    estado_conciliacion: z.enum(['conciliado', 'faltante', 'sobrante', 'pendiente']).optional().default('conciliado'),
    observacion: z.string().optional().nullable()
});

const gasCouponLiquidationShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    fecha: z.string().optional().nullable(),
    distribuidora_id: z.coerce.number().int().positive().optional().nullable(),
    distribuidora_nombre: z.string().optional().nullable(),
    responsable: z.string().optional().nullable(),
    comentario: z.string().optional().nullable(),
    estado: z.enum(['borrador', 'liquidado', 'anulado']).optional().default('liquidado'),
    items: z.array(couponLiquidationItemSchema).min(1, { message: 'Debe incluir al menos un cupón en la liquidación' })
};

const gasCouponLiquidationSchema = z.object(gasCouponLiquidationShape);
const gasCouponLiquidationUpdateSchema = z.object(gasCouponLiquidationShape).partial();

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
