const { z } = require('zod');
const { optionalString, requiredString, emptyToNullId } = require('./schemaHelpers');

// Gas Station Distributors
const gasDistributorShape = {
    codigo: requiredString('El código de distribuidora es requerido'),
    descripcion: optionalString,
    status: optionalString
};
const gasDistributorSchema = z.object(gasDistributorShape);
const gasDistributorUpdateSchema = z.object(gasDistributorShape).partial();

// Gas Station Islands
const gasIslandShape = {
    codigo: requiredString('El código de isla es requerido'),
    descripcion: optionalString,
    status: optionalString,
    branch_id: emptyToNullId
};
const gasIslandSchema = z.object(gasIslandShape);
const gasIslandUpdateSchema = z.object(gasIslandShape).partial();

// Gas Station Nozzles
const gasNozzleBaseShape = {
    codigo: requiredString('El código de manguera es requerido'),
    descripcion: optionalString,
    tipo: z.enum(['A', 'C', 'M'], { message: 'El tipo de pistola debe ser A (Autoservicio), C (Servicio Completo) o M (Master)' }).optional(),
    island_id: z.coerce.number().int().positive({ message: 'La isla es requerida' }),
    product_id: z.coerce.number().int().positive({ message: 'El producto de combustible es requerido' }),
    branch_id: emptyToNullId
};
const gasNozzleSchema = z.object({
    ...gasNozzleBaseShape,
    tipo: gasNozzleBaseShape.tipo.default('C')
});
const gasNozzleUpdateSchema = z.object(gasNozzleBaseShape).partial();

// Gas Station Tanks
const gasTankBaseShape = {
    codigo: requiredString('El código de tanque es requerido'),
    descripcion: optionalString,
    capacidad: z.coerce.number().min(0, { message: 'La capacidad no puede ser negativa' }).optional(),
    reserva: z.coerce.number().min(0, { message: 'La reserva no puede ser negativa' }).optional(),
    tipo_combustible: z.coerce.number().optional(),
    branch_id: emptyToNullId
};
const gasTankSchema = z.object({
    ...gasTankBaseShape,
    capacidad: gasTankBaseShape.capacidad.default(0),
    reserva: gasTankBaseShape.reserva.default(0),
    tipo_combustible: gasTankBaseShape.tipo_combustible.default(0)
});
const gasTankUpdateSchema = z.object(gasTankBaseShape).partial();

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
