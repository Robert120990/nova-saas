const { z } = require('zod');
const { optionalString, requiredString } = require('./schemaHelpers');

// Gas Station Distributors
const gasDistributorShape = {
    codigo: requiredString('El código de distribuidora es requerido'),
    descripcion: optionalString
};
const gasDistributorSchema = z.object(gasDistributorShape);
const gasDistributorUpdateSchema = z.object(gasDistributorShape).partial();

// Gas Station Islands
const gasIslandShape = {
    codigo: requiredString('El código de isla es requerido'),
    descripcion: optionalString
};
const gasIslandSchema = z.object(gasIslandShape);
const gasIslandUpdateSchema = z.object(gasIslandShape).partial();

// Gas Station Nozzles
const gasNozzleShape = {
    codigo: requiredString('El código de manguera es requerido'),
    descripcion: optionalString,
    island_id: z.coerce.number().int().positive({ message: 'La isla es requerida' }),
    product_id: z.coerce.number().int().positive({ message: 'El producto de combustible es requerido' }),
    distributor_id: z.coerce.number().int().positive().optional().nullable()
};
const gasNozzleSchema = z.object(gasNozzleShape);
const gasNozzleUpdateSchema = z.object(gasNozzleShape).partial();

// Gas Station Tanks
const gasTankShape = {
    codigo: requiredString('El código de tanque es requerido'),
    descripcion: optionalString,
    capacidad: z.coerce.number().min(0, { message: 'La capacidad no puede ser negativa' }).optional().default(0),
    tipo_combustible: z.coerce.number().optional().default(0)
};
const gasTankSchema = z.object(gasTankShape);
const gasTankUpdateSchema = z.object(gasTankShape).partial();

// Gas Station Despachadores
const gasDespachadorShape = {
    codigo: requiredString('El código del despachador es requerido'),
    descripcion: optionalString
};
const gasDespachadorSchema = z.object(gasDespachadorShape);
const gasDespachadorUpdateSchema = z.object(gasDespachadorShape).partial();

// Gas Station Despachador Nozzle Assignments
const gasDespachadorNozzlesSchema = z.object({
    nozzle_ids: z.array(z.coerce.number().int().positive(), { message: 'Se requiere una lista de IDs de mangueras' })
});

// Gas Station POS Types
const gasPosTypeShape = {
    nombre: requiredString('El nombre del tipo de POS es requerido')
};
const gasPosTypeSchema = z.object(gasPosTypeShape);
const gasPosTypeUpdateSchema = z.object(gasPosTypeShape).partial();

// Gas Station Expense Categories
const gasExpenseCategoryShape = {
    name: requiredString('El nombre del rubro es requerido')
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
