/**
 * Zod Schemas for Master Catalogs:
 * Categories, Sellers, Products, Customers, Providers.
 */
const { z } = require('zod');
const { validateDocumentNumber } = require('../utils/svfeValidators');

// Helper to sanitize/trim strings or convert empty string to null
const emptyToNull = z.string().trim().transform(val => (val === '' ? null : val));

// Email regex pattern matching controller regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ==========================================
// 1. CATEGORÍAS (product_categories)
// ==========================================
const categorySchema = z.object({
    name: z.string({ error: 'El nombre de la categoría es obligatorio' })
        .trim()
        .min(1, 'El nombre de la categoría no puede estar vacío')
        .max(150, 'El nombre no puede exceder 150 caracteres'),
    description: emptyToNull.nullable().optional()
}).passthrough();

const categoryUpdateSchema = z.object({
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(150).optional(),
    description: emptyToNull.nullable().optional()
}).passthrough();


// ==========================================
// 2. VENDEDORES (sellers)
// ==========================================
const sellerSchema = z.object({
    nombre: z.string({ error: 'El nombre del vendedor es obligatorio' })
        .trim()
        .min(1, 'El nombre del vendedor no puede estar vacío')
        .max(150, 'El nombre no puede exceder 150 caracteres'),
    codigo: emptyToNull.nullable().optional(),
    email: z.string().trim().email('El correo electrónico no tiene un formato válido').nullable().optional().or(z.literal('')),
    telefono: emptyToNull.nullable().optional(),
    branch_id: z.coerce.number().nullable().optional(),
    pos_id: z.coerce.number().nullable().optional(),
    password: z.string().optional(),
    activo: z.coerce.number().optional()
}).passthrough();

const sellerUpdateSchema = sellerSchema.partial().passthrough();


// ==========================================
// 3. PRODUCTOS (products)
// ==========================================
const productSchema = z.object({
    codigo: z.string({ error: 'El código del producto es obligatorio' })
        .trim()
        .min(1, 'El código del producto no puede estar vacío')
        .max(50, 'El código no puede exceder 50 caracteres'),
    nombre: z.string({ error: 'El nombre del producto es obligatorio' })
        .trim()
        .min(1, 'El nombre del producto no puede estar vacío')
        .max(255, 'El nombre no puede exceder 255 caracteres'),
    descripcion: emptyToNull.nullable().optional(),
    codigo_barra: emptyToNull.nullable().optional(),
    costo: z.coerce.number({ error: 'El costo debe ser un valor numérico' })
        .min(0, 'El costo no puede ser negativo')
        .nullable()
        .optional(),
    precio_unitario: z.coerce.number({ error: 'El precio unitario debe ser un valor numérico' })
        .min(0, 'El precio no puede ser negativo')
        .nullable()
        .optional(),
    unidad_medida: emptyToNull.nullable().optional(),
    category_id: z.coerce.number().nullable().optional(),
    provider_id: z.coerce.number().nullable().optional(),
    tipo_item: z.coerce.number().nullable().optional(),
    tipo_combustible: emptyToNull.nullable().optional(),
    tipo_operacion: emptyToNull.nullable().optional(),
    stock_minimo: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo').nullable().optional(),
    afecta_inventario: z.coerce.number().optional(),
    permitir_existencia_negativa: z.coerce.number().optional(),
    status: z.enum(['activo', 'inactivo']).optional(),
    branches: z.array(z.any()).optional(),
    pos: z.array(z.any()).optional(),
    tributes: z.array(z.any()).optional()
}).passthrough();

const productUpdateSchema = productSchema.partial().passthrough();


// ==========================================
// 4. CLIENTES (customers)
// ==========================================
const customerBaseSchema = z.object({
    nombre: z.string({ error: 'El nombre del cliente es obligatorio' })
        .trim()
        .min(1, 'El nombre del cliente no puede estar vacío')
        .max(255, 'El nombre no puede exceder 255 caracteres'),
    nombre_comercial: emptyToNull.nullable().optional(),
    tipo_persona: emptyToNull.nullable().optional(),
    tipo_contribuyente: emptyToNull.nullable().optional(),
    condicion_fiscal: emptyToNull.nullable().optional(),
    tipo_documento: emptyToNull.nullable().optional(),
    numero_documento: emptyToNull.nullable().optional(),
    nit: emptyToNull.nullable().optional(),
    nrc: emptyToNull.nullable().optional(),
    codigo_actividad: emptyToNull.nullable().optional(),
    pais: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    telefono: emptyToNull.nullable().optional(),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val) return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido (ejemplo: cliente@dominio.com)' }),
    exento_iva: z.coerce.number().optional(),
    aplica_fovial: z.coerce.number().optional(),
    aplica_cotrans: z.coerce.number().optional(),
    es_credito: z.coerce.number().optional(),
    es_anticipado: z.coerce.number().optional(),
    es_trupput: z.coerce.number().optional(),
    limite_credito: z.coerce.number().min(0, 'El límite de crédito no puede ser negativo').nullable().optional(),
    dias_credito: z.coerce.number().min(0, 'Los días de crédito deben ser positivos').nullable().optional()
}).passthrough();

// Custom refinement for document validation matching svfeValidators
const customerSchema = customerBaseSchema.superRefine((data, ctx) => {
    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['nit'],
                message: `NIT inválido: ${nitVal.error}`
            });
        }
    }

    if (data.numero_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['numero_documento'],
                message: `Documento inválido: ${docVal.error}`
            });
        }
    }
});

const customerUpdateSchema = customerBaseSchema.partial().superRefine((data, ctx) => {
    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['nit'],
                message: `NIT inválido: ${nitVal.error}`
            });
        }
    }

    if (data.numero_documento && data.tipo_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['numero_documento'],
                message: `Documento inválido: ${docVal.error}`
            });
        }
    }
});


// ==========================================
// 5. PROVEEDORES (providers)
// ==========================================
const providerBaseSchema = z.object({
    nombre: z.string({ error: 'El nombre del proveedor es obligatorio' })
        .trim()
        .min(1, 'El nombre del proveedor no puede estar vacío')
        .max(255, 'El nombre no puede exceder 255 caracteres'),
    nombre_comercial: emptyToNull.nullable().optional(),
    tipo_persona: emptyToNull.nullable().optional(),
    tipo_contribuyente: emptyToNull.nullable().optional(),
    condicion_fiscal: emptyToNull.nullable().optional(),
    tipo_documento: emptyToNull.nullable().optional(),
    numero_documento: emptyToNull.nullable().optional(),
    nit: emptyToNull.nullable().optional(),
    nrc: emptyToNull.nullable().optional(),
    codigo_actividad: emptyToNull.nullable().optional(),
    pais: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    telefono: emptyToNull.nullable().optional(),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val) return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido (ejemplo: proveedor@dominio.com)' }),
    tipo_proveedor: emptyToNull.nullable().optional(),
    es_gran_contribuyente: z.coerce.number().optional(),
    exento_iva: z.coerce.number().optional(),
    es_credito: z.coerce.number().optional(),
    dias_credito: z.coerce.number().min(0, 'Los días de crédito deben ser positivos').nullable().optional()
}).passthrough();

const providerSchema = providerBaseSchema.superRefine((data, ctx) => {
    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['nit'],
                message: `NIT inválido: ${nitVal.error}`
            });
        }
    }

    if (data.numero_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['numero_documento'],
                message: `Documento inválido: ${docVal.error}`
            });
        }
    }
});

const providerUpdateSchema = providerBaseSchema.partial().superRefine((data, ctx) => {
    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['nit'],
                message: `NIT inválido: ${nitVal.error}`
            });
        }
    }

    if (data.numero_documento && data.tipo_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['numero_documento'],
                message: `Documento inválido: ${docVal.error}`
            });
        }
    }
});

module.exports = {
    categorySchema,
    categoryUpdateSchema,
    sellerSchema,
    sellerUpdateSchema,
    productSchema,
    productUpdateSchema,
    customerSchema,
    customerUpdateSchema,
    providerSchema,
    providerUpdateSchema
};
