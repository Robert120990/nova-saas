const { z } = require('zod');
const { requiredString, optionalString } = require('./schemaHelpers');

/**
 * Validation schemas for Customer Fleets (Control de Flotas de Clientes)
 */

const optionalYear = z.preprocess(
    val => {
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return Number.isNaN(num) ? val : num;
    },
    z.number({ error: 'El año debe ser numérico' })
        .int('El año debe ser un entero')
        .min(1900, 'Año inválido')
        .max(2100, 'Año inválido')
        .nullable()
        .optional()
);

const activeFlag = z.preprocess(
    val => {
        if (val === undefined || val === null || val === '') return 1;
        if (val === false || val === 0 || val === '0' || val === 'false') return 0;
        return 1;
    },
    z.union([z.literal(0), z.literal(1)]).optional().default(1)
);

const fleetFields = {
    placa: requiredString('La placa del vehículo es requerida')
        .refine(v => v.length <= 20, 'La placa no puede exceder 20 caracteres'),
    motorista: optionalString.refine(v => !v || v.length <= 150, 'El nombre del motorista no puede exceder 150 caracteres'),
    documento_motorista: optionalString.refine(v => !v || v.length <= 30, 'El documento no puede exceder 30 caracteres'),
    telefono_motorista: optionalString.refine(v => !v || v.length <= 25, 'El teléfono no puede exceder 25 caracteres'),
    codigo_interno: optionalString.refine(v => !v || v.length <= 40, 'El código interno no puede exceder 40 caracteres'),
    tipo_vehiculo: optionalString.refine(v => !v || v.length <= 60, 'El tipo de vehículo no puede exceder 60 caracteres'),
    marca: optionalString.refine(v => !v || v.length <= 80, 'La marca no puede exceder 80 caracteres'),
    modelo: optionalString.refine(v => !v || v.length <= 80, 'El modelo no puede exceder 80 caracteres'),
    anio: optionalYear,
    color: optionalString.refine(v => !v || v.length <= 40, 'El color no puede exceder 40 caracteres'),
    tipo_combustible: optionalString.refine(v => !v || v.length <= 40, 'El tipo de combustible no puede exceder 40 caracteres'),
    observaciones: optionalString,
    activo: activeFlag
};

const customerFleetCreateSchema = z.object({
    customer_id: z.coerce.number({ error: 'El cliente es requerido' })
        .int('El cliente debe ser un identificador válido')
        .positive('El cliente es requerido'),
    ...fleetFields
});

const customerFleetUpdateSchema = z.object({
    customer_id: z.coerce.number().int().positive().optional(),
    ...fleetFields
});

module.exports = {
    customerFleetCreateSchema,
    customerFleetUpdateSchema
};
