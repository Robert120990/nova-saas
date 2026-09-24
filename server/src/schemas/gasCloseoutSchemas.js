const { z } = require('zod');

// Init Closeout
const initCloseoutSchema = z.object({
    seller_id: z.coerce.number().int().positive({ message: 'El vendedor/cajero es requerido' }),
    seller_name: z.string().optional().nullable(),
    fecha_turno: z.string({ message: 'La fecha del turno es requerida' }).min(1, { message: 'La fecha del turno es requerida' }),
    numero_turno: z.coerce.number().int().positive({ message: 'El número de turno es requerido' }),
    despachadores: z.array(z.coerce.number().int().positive()).optional().default([]),
    nozzle_assignments: z.array(z.any()).optional().default([])
});

// Update Readings
const batchReadingsSchema = z.object({
    readings: z.array(z.object({
        readingId: z.coerce.number().int().positive({ message: 'ID de lectura es requerido' }),
        lectura_actual: z.coerce.number({ message: 'La lectura actual debe ser numérica' })
    })).min(1, { message: 'El arreglo de lecturas es requerido' })
});

const singleReadingUpdateSchema = z.object({
    lectura_actual: z.coerce.number().optional(),
    calibracion: z.coerce.number().optional(),
    lectura_anterior: z.coerce.number().optional()
});

const singleTankReadingUpdateSchema = z.object({
    lectura_actual: z.coerce.number().optional(),
    recarga: z.coerce.number().optional(),
    lectura_anterior: z.coerce.number().optional()
});

const closeoutFechaTurnoSchema = z.object({
    fecha_turno: z.string({ message: 'La fecha de turno es requerida' }).min(1, { message: 'La fecha de turno es requerida' })
});

// Closeout Collections
const closeoutExpensesSchema = z.object({
    expenses: z.array(z.object({
        despachador_id: z.coerce.number().int().positive({ message: 'El despachador es requerido' }).optional().nullable(),
        rubro: z.string().optional().nullable(),
        fecha: z.string().optional().nullable(),
        documento: z.string().optional().nullable(),
        descripcion: z.string().optional().nullable(),
        monto: z.coerce.number().optional().default(0),
        provider_id: z.coerce.number().int().positive().optional().nullable()
    })).optional().default([])
});

const closeoutRemesasSchema = z.object({
    remesas: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        codigo: z.string().optional().nullable(),
        documento: z.string().optional().nullable(),
        descripcion: z.string().optional().nullable(),
        tipo_operacion: z.string().optional().nullable(),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutCuponesSchema = z.object({
    cupones: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        distribuidora_id: z.coerce.number().int().positive().optional().nullable(),
        producto_id: z.coerce.number().int().positive().optional().nullable(),
        cupon: z.string().optional().nullable(),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutDescuentosSchema = z.object({
    descuentos: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        producto_id: z.coerce.number().int().positive().optional().nullable(),
        galones: z.coerce.number().optional().default(0),
        descuento_galon: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutAdelantosSchema = z.object({
    adelantos: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        cliente_id: z.coerce.number().int().positive().optional().nullable(),
        monto: z.coerce.number().optional().default(0),
        notas: z.string().optional().nullable()
    })).optional().default([])
});

const closeoutTarjetasSchema = z.object({
    tarjetas: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        pos_type_id: z.coerce.number().int().positive().optional().nullable(),
        lote: z.string().optional().nullable(),
        voucher: z.string().optional().nullable(),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutCreditosSchema = z.object({
    creditos: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        cliente_id: z.coerce.number().int().positive().optional().nullable(),
        tipo_documento: z.string().optional().nullable(),
        documento: z.string().optional().nullable(),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutValesSchema = z.object({
    vales: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        cliente_id: z.coerce.number().int().positive().optional().nullable(),
        documento: z.string().optional().nullable(),
        galones: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutAnticiposDespSchema = z.object({
    anticipos: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        cliente_id: z.coerce.number().int().positive().optional().nullable(),
        anticipo_id: z.coerce.number().int().positive().optional().nullable(),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutTrupputDespSchema = z.object({
    despachos: z.array(z.object({
        despachador_id: z.coerce.number().int().positive().optional().nullable(),
        cliente_id: z.coerce.number().int().positive().optional().nullable(),
        trupput_id: z.coerce.number().int().positive().optional().nullable(),
        galones: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        monto: z.coerce.number().optional().default(0)
    })).optional().default([])
});

const closeoutLubricantesSchema = z.object({
    readings: z.array(z.object({
        producto_id: z.coerce.number().int().positive({ message: 'El producto es requerido' }),
        lectura_inicial: z.coerce.number().optional().default(0),
        recarga: z.coerce.number().optional().default(0),
        lectura_final: z.coerce.number().optional().default(0),
        ventas: z.coerce.number().optional().default(0),
        precio: z.coerce.number().optional().default(0),
        total: z.coerce.number().optional().default(0)
    })).optional().default([])
});

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
