/**
 * Zod Schemas for Accounting Module:
 * Account Types, Entry Types, Chart of Accounts, Accounting Entries, Correlativos.
 */
const { z } = require('zod');
const { emptyToNull, requiredString } = require('./schemaHelpers');

// ==========================================
// 1. TIPOS DE CUENTA (Account Types)
// ==========================================
const accountTypeSchema = z.object({
    name: requiredString('El nombre del tipo de cuenta es obligatorio'),
    code: requiredString('El código del tipo de cuenta es obligatorio'),
    nature: z.enum(['debit', 'credit'], {
        error: 'La naturaleza debe ser debit o credit'
    }).optional()
}).passthrough();

const accountTypeUpdateSchema = accountTypeSchema.partial().passthrough();


// ==========================================
// 2. TIPOS DE PARTIDA (Entry Types)
// ==========================================
const entryTypeSchema = z.object({
    name: requiredString('El nombre del tipo de partida es obligatorio'),
    code: requiredString('El código del tipo de partida es obligatorio')
}).passthrough();

const entryTypeUpdateSchema = entryTypeSchema.partial().passthrough();


// ==========================================
// 3. CATÁLOGO DE CUENTAS (Chart of Accounts)
// ==========================================
const accountSchema = z.object({
    code: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ error: 'El código de cuenta es obligatorio' })
            .min(1, 'El código de cuenta no puede estar vacío')
            .max(50, 'El código no puede exceder 50 caracteres')
    ),
    name: requiredString('El nombre de la cuenta es obligatorio'),
    account_type_id: z.coerce.number({ error: 'El tipo de cuenta es obligatorio' }),
    parent_id: z.coerce.number().nullable().optional(),
    level: z.coerce.number().optional(),
    is_group: z.coerce.number().optional().or(z.boolean()),
    allows_entries: z.coerce.number().optional().or(z.boolean()),
    active: z.coerce.number().optional().or(z.boolean())
}).passthrough();

const accountUpdateSchema = z.object({
    code: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El código no puede estar vacío').max(50).optional()
    ),
    name: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El nombre no puede estar vacío').max(255).optional()
    ),
    account_type_id: z.coerce.number().optional(),
    parent_id: z.coerce.number().nullable().optional(),
    level: z.coerce.number().optional(),
    is_group: z.coerce.number().optional().or(z.boolean()),
    allows_entries: z.coerce.number().optional().or(z.boolean()),
    active: z.coerce.number().optional().or(z.boolean())
}).passthrough();


// ==========================================
// 4. PARTIDAS CONTABLES (Accounting Entries)
// ==========================================
const entryLineSchema = z.object({
    account_id: z.coerce.number({ error: 'La cuenta contable es obligatoria en cada línea' }),
    description: emptyToNull.nullable().optional(),
    debit: z.coerce.number({ error: 'El débito debe ser numérico' })
        .min(0, 'El débito no puede ser negativo')
        .optional()
        .default(0),
    credit: z.coerce.number({ error: 'El crédito debe ser numérico' })
        .min(0, 'El crédito no puede ser negativo')
        .optional()
        .default(0)
}).passthrough();

const validateEntryBalance = (data, ctx) => {
    if (Array.isArray(data.lines) && data.lines.length > 0) {
        const totalDebit = data.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCredit = data.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['lines'],
                message: `La partida contable no está cuadrada: Debe ($${totalDebit.toFixed(2)}) != Haber ($${totalCredit.toFixed(2)})`
            });
        }
    }
};

const entrySchema = z.object({
    entry_type_id: z.coerce.number({ error: 'El tipo de partida es obligatorio' }),
    date: z.string({ error: 'La fecha de la partida es obligatoria' })
        .trim()
        .min(1, 'La fecha no puede estar vacía'),
    description: z.string({ error: 'La descripción de la partida es obligatoria' })
        .trim()
        .min(1, 'La descripción de la partida no puede estar vacía'),
    branch_id: z.coerce.number().nullable().optional(),
    lines: z.array(entryLineSchema, { error: 'Las líneas de la partida son requeridas' })
        .min(1, 'La partida debe tener al menos una línea')
}).passthrough().superRefine(validateEntryBalance);

const entryUpdateSchema = z.object({
    description: z.string().trim().min(1, 'La descripción no puede estar vacía').optional(),
    lines: z.array(entryLineSchema, { error: 'Las líneas de la partida son requeridas' })
        .min(1, 'La partida debe tener al menos una línea')
        .optional()
}).passthrough().superRefine(validateEntryBalance);


// ==========================================
// 5. CORRELATIVOS CONTABLES
// ==========================================
const correlativoMonthSchema = z.object({
    month: z.coerce.number().min(1, 'Mes inválido').max(12, 'Mes inválido'),
    current_number: z.coerce.number({ error: 'El correlativo debe ser numérico' })
        .int('El número debe ser entero')
        .min(1, 'El número debe ser mayor o igual a 1')
}).passthrough();

const accountingCorrelativosSchema = z.object({
    type_id: z.coerce.number({ error: 'El tipo de partida es obligatorio' }),
    year: z.coerce.number({ error: 'El año es obligatorio' }).int().min(2000).max(2200),
    months: z.array(correlativoMonthSchema, { error: 'Los meses son obligatorios' })
        .min(1, 'Debe especificar al menos un mes')
}).passthrough();

const accountingRenumberSchema = z.object({
    type_id: z.coerce.number({ error: 'El tipo de partida es obligatorio' }),
    year: z.coerce.number({ error: 'El año es obligatorio' }).int().min(2000).max(2200)
}).passthrough();

module.exports = {
    accountTypeSchema,
    accountTypeUpdateSchema,
    entryTypeSchema,
    entryTypeUpdateSchema,
    accountSchema,
    accountUpdateSchema,
    entrySchema,
    entryUpdateSchema,
    accountingCorrelativosSchema,
    accountingRenumberSchema
};
