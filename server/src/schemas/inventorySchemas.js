const { z } = require('zod');

// Transfer Items Schema
const inventoryTransferItemSchema = z.object({
    product_id: z.coerce.number().int().positive({ message: 'El producto es requerido' }),
    cantidad: z.coerce.number().positive({ message: 'La cantidad debe ser mayor a 0' })
});

// Inventory Transfer Base Shape
const inventoryTransferShape = {
    origen_branch_id: z.coerce.number().int().positive({ message: 'La sucursal de origen es requerida' }),
    destino_branch_id: z.coerce.number().int().positive({ message: 'La sucursal de destino es requerida' }),
    observaciones: z.string().optional().nullable(),
    items: z.array(inventoryTransferItemSchema).min(1, { message: 'Debe incluir al menos un producto en el traslado' })
};

const inventoryTransferSchema = z.object(inventoryTransferShape).superRefine((data, ctx) => {
    if (data.origen_branch_id === data.destino_branch_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La sucursal de origen y destino no pueden ser iguales',
            path: ['destino_branch_id']
        });
    }
});

// Physical Inventory Items Schema
const physicalInventoryItemSchema = z.object({
    product_id: z.coerce.number().int().positive({ message: 'El producto es requerido' }),
    stock_sistema: z.coerce.number().optional().default(0),
    stock_fisico: z.coerce.number().nullable().optional(),
    diferencia: z.coerce.number().optional().default(0),
    costo: z.coerce.number().optional().default(0),
    total: z.coerce.number().optional().default(0)
});

// Physical Inventory Schema
const inventoryPhysicalSchema = z.object({
    id: z.coerce.number().int().positive().optional().nullable(),
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }).optional().nullable(),
    fecha: z.string({ message: 'La fecha es requerida' }).min(1, { message: 'La fecha es requerida' }),
    responsable: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    items: z.array(physicalInventoryItemSchema).optional().default([])
});

// Inventory Adjustment Motivos
const inventoryMotivoShape = {
    nombre: z.string({ message: 'El nombre del motivo es requerido' }).trim().min(1, { message: 'El nombre del motivo no puede estar vacío' }),
    tipo: z.string({ message: 'El tipo es requerido' }).trim().min(1, { message: 'El tipo es requerido' }).optional().nullable()
};

const inventoryMotivoSchema = z.object(inventoryMotivoShape);
const inventoryMotivoUpdateSchema = z.object(inventoryMotivoShape).partial();

// Inventory Adjustment Items
const inventoryAdjustmentItemSchema = z.object({
    product_id: z.coerce.number().int().positive({ message: 'El producto es requerido' }),
    cantidad: z.coerce.number().positive({ message: 'La cantidad debe ser mayor a 0' }),
    costo: z.coerce.number().min(0, { message: 'El costo no puede ser negativo' }).optional().default(0),
    total: z.coerce.number().min(0, { message: 'El total no puede ser negativo' }).optional()
});

// Inventory Adjustment Headers
const inventoryAdjustmentShape = {
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    motivo_id: z.coerce.number().int().positive({ message: 'El motivo del ajuste es requerido' }),
    tipo: z.enum(['ENTRADA', 'SALIDA'], { message: 'El tipo de ajuste debe ser ENTRADA o SALIDA' }),
    numero: z.string().optional().nullable(),
    fecha: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    items: z.array(inventoryAdjustmentItemSchema).min(1, { message: 'Debe incluir al menos un producto en el ajuste' })
};

const inventoryAdjustmentSchema = z.object(inventoryAdjustmentShape);

// Update Adjustment (only metadata can be updated)
const inventoryAdjustmentUpdateShape = {
    numero: z.string().optional().nullable(),
    fecha: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable()
};

const inventoryAdjustmentUpdateSchema = z.object(inventoryAdjustmentUpdateShape);

module.exports = {
    inventoryTransferItemSchema,
    inventoryTransferSchema,
    physicalInventoryItemSchema,
    inventoryPhysicalSchema,
    inventoryMotivoSchema,
    inventoryMotivoUpdateSchema,
    inventoryAdjustmentItemSchema,
    inventoryAdjustmentSchema,
    inventoryAdjustmentUpdateSchema
};
