/**
 * Zod Schemas for Control de Pozos (Water Well Control) Module:
 * Servicios, Despachos, Cortes, Entregas de Efectivo.
 */
const { z } = require('zod');

// Helper to sanitize/trim strings or convert empty string to null
const emptyToNull = z.string().trim().transform(val => (val === '' ? null : val));

// ==========================================
// 1. SERVICIOS DE POZO
// ==========================================
const pozoServicioSchema = z.object({
    codigo: z.string({ error: 'El código del servicio es obligatorio' })
        .trim()
        .min(1, 'El código del servicio no puede estar vacío')
        .max(50, 'El código no puede exceder 50 caracteres'),
    descripcion: emptyToNull.nullable().optional(),
    monto: z.coerce.number({ error: 'El monto debe ser numérico' })
        .gt(0, 'El monto debe ser mayor a cero')
}).passthrough();

const pozoServicioUpdateSchema = z.object({
    codigo: z.string().trim().min(1, 'El código no puede estar vacío').max(50).optional(),
    descripcion: emptyToNull.nullable().optional(),
    monto: z.coerce.number().gt(0, 'El monto debe ser mayor a cero').optional()
}).passthrough();


// ==========================================
// 2. DESPACHOS DE POZO
// ==========================================
const pozoDespachoServicioItemSchema = z.object({
    servicio_id: z.coerce.number().nullable().optional(),
    cantidad: z.coerce.number({ error: 'La cantidad debe ser numérica' })
        .gt(0, 'La cantidad debe ser mayor a cero'),
    monto: z.coerce.number({ error: 'El monto debe ser numérico' })
        .gt(0, 'El monto debe ser mayor a cero')
}).passthrough();

const pozoDespachoSchema = z.object({
    numero: emptyToNull.nullable().optional(),
    fecha: z.string({ error: 'La fecha del despacho es obligatoria' })
        .trim()
        .min(1, 'La fecha no puede estar vacía'),
    encargado: emptyToNull.nullable().optional(),
    cliente: emptyToNull.nullable().optional(),
    placa: emptyToNull.nullable().optional(),
    hora_entrada: emptyToNull.nullable().optional(),
    hora_salida: emptyToNull.nullable().optional(),
    odometro_inicial: z.coerce.number().nullable().optional(),
    odometro_final: z.coerce.number().nullable().optional(),
    servicios: z.array(pozoDespachoServicioItemSchema, { error: 'Los servicios son requeridos' })
        .min(1, 'Debe agregar al menos un servicio con cantidad y monto válidos')
}).passthrough();

const pozoDespachoUpdateSchema = pozoDespachoSchema.partial().extend({
    fecha: z.string({ error: 'La fecha del despacho es obligatoria' })
        .trim()
        .min(1, 'La fecha no puede estar vacía'),
    servicios: z.array(pozoDespachoServicioItemSchema, { error: 'Los servicios son requeridos' })
        .min(1, 'Debe agregar al menos un servicio con cantidad y monto válidos')
}).passthrough();


// ==========================================
// 3. CORTES DE POZO
// ==========================================
const pozoCorteGastoSchema = z.object({
    descripcion: z.string({ error: 'La descripción del gasto es obligatoria' })
        .trim()
        .min(1, 'La descripción del gasto es obligatoria'),
    monto: z.coerce.number({ error: 'El monto debe ser numérico' })
        .gt(0, 'El monto del gasto debe ser mayor a cero')
}).passthrough();

const pozoCorteSchema = z.object({
    fecha: z.string({ error: 'La fecha del corte es obligatoria' })
        .trim()
        .min(1, 'La fecha del corte es obligatoria'),
    encargado: emptyToNull.nullable().optional(),
    odometro_final_manual: z.coerce.number().min(0, 'El odómetro debe ser mayor o igual a cero').nullable().optional(),
    gastos: z.array(pozoCorteGastoSchema).optional()
}).passthrough();

const pozoCorteOdometroSchema = z.object({
    odometro_final: z.coerce.number({ error: 'El odómetro final debe ser numérico' })
        .min(0, 'El valor del odómetro debe ser mayor o igual a cero')
}).passthrough();


// ==========================================
// 4. ENTREGAS DE EFECTIVO
// ==========================================
const pozoEntregaEfectivoSchema = z.object({
    persona_entrega: z.string({ error: 'La persona que entrega es obligatoria' })
        .trim()
        .min(1, 'La persona que entrega no puede estar vacía'),
    persona_recibe: z.string({ error: 'La persona que recibe es obligatoria' })
        .trim()
        .min(1, 'La persona que recibe no puede estar vacía'),
    fecha: z.string({ error: 'La fecha es obligatoria' })
        .trim()
        .min(1, 'La fecha no puede estar vacía'),
    monto: z.coerce.number({ error: 'El monto debe ser numérico' })
        .gt(0, 'El monto debe ser mayor a cero')
}).passthrough();

const pozoEntregaEfectivoUpdateSchema = pozoEntregaEfectivoSchema.partial().passthrough();

module.exports = {
    pozoServicioSchema,
    pozoServicioUpdateSchema,
    pozoDespachoSchema,
    pozoDespachoUpdateSchema,
    pozoCorteSchema,
    pozoCorteOdometroSchema,
    pozoEntregaEfectivoSchema,
    pozoEntregaEfectivoUpdateSchema
};
