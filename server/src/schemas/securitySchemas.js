/**
 * Zod Schemas for Security Module:
 * Users, Profiles, User Company/Branch Access, and Roles.
 */
const { z } = require('zod');
const { optionalString, requiredString } = require('./schemaHelpers');

// Email regex pattern
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Phone regex (0000-0000)
const phoneRegex = /^\d{4}-\d{4}$/;

// Helper for branch items (accepts numeric ID or { id / branch_id } object)
const branchItemSchema = z.union([
    z.object({
        branch_id: z.coerce.number().int().positive().optional(),
        id: z.coerce.number().int().positive().optional()
    }).passthrough(),
    z.coerce.number().int().positive()
]);

// ==========================================
// 1. USUARIOS (Users)
// ==========================================
const userCreateSchema = z.object({
    username: requiredString('El nombre de usuario es obligatorio'),
    password: z.string({ error: 'La contraseña es obligatoria' })
        .min(4, 'La contraseña debe tener al menos 4 caracteres'),
    nombre: requiredString('El nombre del usuario es obligatorio'),
    email: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    telefono: z.preprocess(
        val => (val === undefined || val === null || val === '' ? null : String(val).trim()),
        z.string().nullable().optional().refine(val => {
            if (!val || val === '') return true;
            return phoneRegex.test(val);
        }, { message: 'El teléfono debe tener el formato 0000-0000' })
    ),
    role_id: z.coerce.number().optional(),
    branches: z.array(branchItemSchema).optional(),
    allowed_ips: z.any().optional()
}).passthrough();

const userUpdateSchema = z.object({
    username: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El nombre de usuario no puede estar vacío').max(50).optional()
    ),
    password: z.string().optional().refine(val => {
        if (!val || val.trim() === '') return true;
        return val.length >= 4;
    }, { message: 'La contraseña debe tener al menos 4 caracteres' }),
    nombre: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El nombre no puede estar vacío').max(100).optional()
    ),
    email: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    telefono: z.preprocess(
        val => (val === undefined || val === null || val === '' ? null : String(val).trim()),
        z.string().nullable().optional().refine(val => {
            if (!val || val === '') return true;
            return phoneRegex.test(val);
        }, { message: 'El teléfono debe tener el formato 0000-0000' })
    ),
    status: z.enum(['activo', 'inactivo'], { error: 'Estado de usuario inválido' }).optional(),
    role_id: z.coerce.number().optional(),
    branches: z.array(branchItemSchema).optional(),
    allowed_ips: z.any().optional()
}).passthrough();

const userProfileSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre no puede estar vacío').optional(),
    username: z.string().trim().min(1, 'El nombre de usuario no puede estar vacío').optional(),
    email: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    password: z.string().optional().refine(val => {
        if (!val || val.trim() === '') return true;
        return val.length >= 4;
    }, { message: 'La contraseña debe tener al menos 4 caracteres' })
}).passthrough();


// ==========================================
// 2. ASIGNACIÓN DE ACCESOS (User Access)
// ==========================================
const userAccessSchema = z.object({
    userId: z.coerce.number({ error: 'El ID de usuario es obligatorio' }),
    companyId: z.coerce.number({ error: 'El ID de empresa es obligatorio' }),
    roleId: z.coerce.number({ error: 'El rol es obligatorio' }),
    branches: z.array(branchItemSchema).optional().default([])
}).passthrough();

const bulkAccessSchema = z.object({
    userIds: z.array(z.coerce.number(), { error: 'Debe seleccionar al menos un usuario' })
        .min(1, 'Debe seleccionar al menos un usuario'),
    assignments: z.array(z.object({
        companyId: z.coerce.number({ error: 'El ID de empresa es obligatorio' }),
        roleId: z.coerce.number({ error: 'El ID de rol es obligatorio' }),
        branches: z.array(branchItemSchema).optional()
    }), { error: 'Debe especificar al menos una empresa con rol' })
        .min(1, 'Debe especificar al menos una empresa con rol')
}).passthrough();

const cloneAccessSchema = z.object({
    sourceUserId: z.coerce.number({ error: 'Debe especificar el usuario origen' }),
    targetUserIds: z.array(z.coerce.number(), { error: 'Debe seleccionar al menos un usuario destino' })
        .min(1, 'Debe seleccionar al menos un usuario destino'),
    mode: z.enum(['merge', 'replace']).optional().default('merge')
}).passthrough();

const bulkUpdateRoleSchema = z.object({
    items: z.array(z.object({
        userId: z.coerce.number(),
        companyId: z.coerce.number()
    }), { error: 'Debe seleccionar al menos un registro' })
        .min(1, 'Debe seleccionar al menos un registro'),
    newRoleId: z.coerce.number({ error: 'Debe seleccionar el nuevo rol' })
}).passthrough();

const bulkDeleteAccessSchema = z.object({
    items: z.array(z.object({
        userId: z.coerce.number(),
        companyId: z.coerce.number()
    }), { error: 'Debe seleccionar al menos un registro' })
        .min(1, 'Debe seleccionar al menos un registro')
}).passthrough();


// ==========================================
// 3. ROLES (Roles)
// ==========================================
const permissionsParser = z.any().superRefine((val, ctx) => {
    let perms = val;
    if (typeof val === 'string') {
        try {
            perms = JSON.parse(val);
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El formato de permisos no es válido'
            });
            return;
        }
    }
    if (!Array.isArray(perms)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El formato de permisos no es válido'
        });
        return;
    }
    if (new Set(perms).size !== perms.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'No se permiten IDs de permiso duplicados'
        });
    }
});

const roleCreateSchema = z.object({
    name: requiredString('El nombre del rol es obligatorio'),
    permissions: permissionsParser,
    default_dashboard: z.enum(['general', 'pista', 'tienda', 'andelsa', 'server']).optional().default('general')
}).passthrough();

const roleUpdateSchema = z.object({
    name: z.preprocess(
        val => (val === undefined || val === null ? undefined : String(val).trim()),
        z.string().min(1, 'El nombre del rol no puede estar vacío').max(100).optional()
    ),
    permissions: permissionsParser.optional(),
    default_dashboard: z.enum(['general', 'pista', 'tienda', 'andelsa', 'server']).optional()
}).passthrough();

module.exports = {
    userCreateSchema,
    userUpdateSchema,
    userProfileSchema,
    userAccessSchema,
    bulkAccessSchema,
    cloneAccessSchema,
    bulkUpdateRoleSchema,
    bulkDeleteAccessSchema,
    roleCreateSchema,
    roleUpdateSchema
};
