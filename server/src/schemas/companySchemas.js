/**
 * Zod Schemas for Company & Branch Management:
 * Companies and Branches.
 */
const { z } = require('zod');

const { emptyToNull, requiredString } = require('./schemaHelpers');

// Email regex pattern
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// NIT / DUI validation regex
const nitOrDuiRegex = /^(\d{4}-\d{6}-\d{3}-\d{1}|\d{8}-\d{1}|\d{9}|\d{14})$/;

// ==========================================
// 1. EMPRESAS (Companies)
// ==========================================
const companyBaseShape = {
    razon_social: z.string({ error: 'La razón social de la empresa es obligatoria' })
        .trim()
        .min(1, 'La razón social no puede estar vacía')
        .max(255, 'La razón social no puede exceder 255 caracteres'),
    nombre_comercial: emptyToNull.nullable().optional(),
    nit: emptyToNull.nullable().optional(),
    nrc: emptyToNull.nullable().optional(),
    codigo_actividad: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    telefono: emptyToNull.nullable().optional(),
    tipo_persona: emptyToNull.nullable().optional(),
    tipo_contribuyente: emptyToNull.nullable().optional(),
    api_user: emptyToNull.nullable().optional(),
    api_password: emptyToNull.nullable().optional(),
    ambiente: emptyToNull.nullable().optional(),
    certificate_password: emptyToNull.nullable().optional(),
    clave_privada: emptyToNull.nullable().optional(),
    dte_active: z.coerce.number().optional().or(z.boolean()),
    remove_logo: emptyToNull.nullable().optional()
};

const validateNitRefine = (data, ctx) => {
    if (data.nit && typeof data.nit === 'string' && data.nit.trim()) {
        const cleanNit = data.nit.trim();
        if (!nitOrDuiRegex.test(cleanNit)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['nit'],
                message: 'Formato de NIT o DUI inválido (ej: 0000-000000-000-0 ó 00000000-0)'
            });
        }
    }
};

const companyCreateSchema = z.object(companyBaseShape).passthrough().superRefine(validateNitRefine);
const companyUpdateSchema = z.object(companyBaseShape).partial().passthrough().superRefine(validateNitRefine);


// ==========================================
// 2. SUCURSALES / ESTABLECIMIENTOS (Branches)
// ==========================================
const branchCreateSchema = z.object({
    codigo: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string({ error: 'El código de la sucursal es obligatorio' })
            .min(1, 'El código de la sucursal no puede estar vacío')
            .max(20, 'El código no puede exceder 20 caracteres')
    ),
    nombre: z.string({ error: 'El nombre de la sucursal es obligatorio' })
        .trim()
        .min(1, 'El nombre de la sucursal no puede estar vacío')
        .max(150, 'El nombre no puede exceder 150 caracteres'),
    tipo_establecimiento: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    telefono: emptyToNull.nullable().optional(),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    codigo_mh: emptyToNull.nullable().optional(),
    es_casa_matriz: z.coerce.number().optional().or(z.boolean()),
    omitir_digito_verificador: z.coerce.number().optional().or(z.boolean()),
    discount_percentages: z.any().optional(),
    max_discount_amount: z.coerce.number().nullable().optional(),
    max_discount_percentage: z.coerce.number().nullable().optional()
}).passthrough();

const branchUpdateSchema = z.object({
    codigo: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El código no puede estar vacío').max(20).optional()
    ),
    nombre: z.string().trim().min(1, 'El nombre no puede estar vacío').max(150).optional(),
    tipo_establecimiento: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    telefono: emptyToNull.nullable().optional(),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    codigo_mh: emptyToNull.nullable().optional(),
    es_casa_matriz: z.coerce.number().optional().or(z.boolean()),
    omitir_digito_verificador: z.coerce.number().optional().or(z.boolean()),
    discount_percentages: z.any().optional(),
    max_discount_amount: z.coerce.number().nullable().optional(),
    max_discount_percentage: z.coerce.number().nullable().optional()
}).passthrough();

module.exports = {
    companyCreateSchema,
    companyUpdateSchema,
    branchCreateSchema,
    branchUpdateSchema
};
