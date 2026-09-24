const { z } = require('zod');

// Gas Station Distributors
const gasDistributorShape = {
    codigo: z.string({ message: 'El código de distribuidora es requerido' }).trim().min(1, { message: 'El código no puede estar vacío' }),
    descripcion: z.string().optional().nullable()
};
const gasDistributorSchema = z.object(gasDistributorShape);
const gasDistributorUpdateSchema = z.object(gasDistributorShape).partial();

// Gas Station Islands
const gasIslandShape = {
    codigo: z.string({ message: 'El código de isla es requerido' }).trim().min(1, { message: 'El código no puede estar vacío' }),
    descripcion: z.string().optional().nullable()
};
const gasIslandSchema = z.object(gasIslandShape);
const gasIslandUpdateSchema = z.object(gasIslandShape).partial();

// Gas Station Nozzles
const gasNozzleShape = {
    codigo: z.string({ message: 'El código de manguera es requerido' }).trim().min(1, { message: 'El código no puede estar vacío' }),
    descripcion: z.string().optional().nullable(),
    island_id: z.coerce.number().int().positive({ message: 'La isla es requerida' }),
    product_id: z.coerce.number().int().positive({ message: 'El producto de combustible es requerido' }),
    distributor_id: z.coerce.number().int().positive().optional().nullable()
};
const gasNozzleSchema = z.object(gasNozzleShape);
const gasNozzleUpdateSchema = z.object(gasNozzleShape).partial();

// Gas Station Tanks
const gasTankShape = {
    codigo: z.string({ message: 'El código de tanque es requerido' }).trim().min(1, { message: 'El código no puede estar vacío' }),
    descripcion: z.string().optional().nullable(),
    capacidad: z.coerce.number().min(0, { message: 'La capacidad no puede ser negativa' }).optional().default(0),
    tipo_combustible: z.coerce.number().optional().default(0)
};
const gasTankSchema = z.object(gasTankShape);
const gasTankUpdateSchema = z.object(gasTankShape).partial();

// Gas Station Despachadores
const gasDespachadorShape = {
    codigo: z.string({ message: 'El código del despachador es requerido' }).trim().min(1, { message: 'El código no puede estar vacío' }),
    descripcion: z.string().optional().nullable()
};
const gasDespachadorSchema = z.object(gasDespachadorShape);
const gasDespachadorUpdateSchema = z.object(gasDespachadorShape).partial();

// Gas Station Despachador Nozzle Assignments
const gasDespachadorNozzlesSchema = z.object({
    nozzle_ids: z.array(z.coerce.number().int().positive(), { message: 'Se requiere una lista de IDs de mangueras' })
});

// Gas Station POS Types
const gasPosTypeShape = {
    nombre: z.string({ message: 'El nombre del tipo de POS es requerido' }).trim().min(1, { message: 'El nombre no puede estar vacío' })
};
const gasPosTypeSchema = z.object(gasPosTypeShape);
const gasPosTypeUpdateSchema = z.object(gasPosTypeShape).partial();

// Gas Station Expense Categories
const gasExpenseCategoryShape = {
    name: z.string({ message: 'El nombre del rubro es requerido' }).trim().min(1, { message: 'El nombre no puede estar vacío' })
};
const gasExpenseCategorySchema = z.object(gasExpenseCategoryShape);
const gasExpenseCategoryUpdateSchema = z.object(gasExpenseCategoryShape).partial();

// Gas Station Settings
const gasSettingsSchema = z.record(z.string(), z.any());

module.exports = {
    gasDistributorSchema,
    gasDistributorUpdateSchema,
    gasIslandSchema,
    gasIslandUpdateSchema,
    gasNozzleSchema,
    gasNozzleUpdateSchema,
    gasTankSchema,
    gasTankUpdateSchema,
    gasDespachadorSchema,
    gasDespachadorUpdateSchema,
    gasDespachadorNozzlesSchema,
    gasPosTypeSchema,
    gasPosTypeUpdateSchema,
    gasExpenseCategorySchema,
    gasExpenseCategoryUpdateSchema,
    gasSettingsSchema
};
