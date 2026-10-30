/**
 * Zod Schemas for Human Resources (RH) Module:
 * Employees, Personal Actions, Vacation Payroll, Aguinaldo Payroll, Discounts.
 */
const { z } = require('zod');
const { emptyToNull } = require('./schemaHelpers');

// Email regex pattern
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Phone regex (0000-0000)
const phoneRegex = /^\d{4}-\d{4}$/;

// DUI regex (00000000-0)
const duiRegex = /^(\d{8}-\d{1}|\d{9})$/;

// NIT regex
const nitRegex = /^(\d{4}-\d{6}-\d{3}-\d{1}|\d{14})$/;

// ==========================================
// 1. EMPLEADOS (Employees)
// ==========================================
const emergencyContactSchema = z.object({
    id: z.coerce.number().optional(),
    nombre: z.string().trim().min(1, 'El nombre del contacto es obligatorio'),
    telefono: z.preprocess(
        val => (val === undefined || val === null ? '' : String(val).trim()),
        z.string().optional().or(z.literal(''))
    ),
    parentesco: emptyToNull.nullable().optional()
}).passthrough();

const empleadoBaseShape = {
    codigo: emptyToNull.nullable().optional(),
    nombres: z.string({ error: 'Los nombres son obligatorios' })
        .trim()
        .min(1, 'Los nombres no pueden estar vacíos')
        .max(100, 'Los nombres no pueden exceder 100 caracteres'),
    apellidos: z.string({ error: 'Los apellidos son obligatorios' })
        .trim()
        .min(1, 'Los apellidos no pueden estar vacíos')
        .max(100, 'Los apellidos no pueden exceder 100 caracteres'),
    fecha_nacimiento: emptyToNull.nullable().optional(),
    num_dui: emptyToNull.nullable().optional(),
    num_nit: emptyToNull.nullable().optional(),
    afp_id: z.coerce.number().nullable().optional(),
    ocupacion: emptyToNull.nullable().optional(),
    direccion: emptyToNull.nullable().optional(),
    departamento: emptyToNull.nullable().optional(),
    municipio: emptyToNull.nullable().optional(),
    distrito: emptyToNull.nullable().optional(),
    telefono: z.preprocess(
        val => (val === undefined || val === null || val === '' ? null : String(val).trim()),
        z.string().nullable().optional().refine(val => {
            if (!val || val === '') return true;
            return phoneRegex.test(val);
        }, { message: 'El teléfono debe tener el formato 0000-0000' })
    ),
    correo: z.string().trim().nullable().optional().refine(val => {
        if (!val || val === '') return true;
        return emailRegex.test(val);
    }, { message: 'El correo electrónico no tiene un formato válido' }),
    cargo_id: z.coerce.number().nullable().optional(),
    departamento_personal_id: z.coerce.number().nullable().optional(),
    branch_id: z.coerce.number().nullable().optional(),
    num_isss: emptyToNull.nullable().optional(),
    num_nup: emptyToNull.nullable().optional(),
    fecha_ingreso: emptyToNull.nullable().optional(),
    tipo_contrato_id: z.coerce.number().nullable().optional(),
    sueldo_base: z.coerce.number().min(0, 'El sueldo base no puede ser negativo').optional().default(0),
    bonificacion_fija: z.coerce.number().min(0, 'La bonificación fija no puede ser negativa').optional().default(0),
    cuenta_planillera: emptyToNull.nullable().optional(),
    es_activo: z.coerce.number().optional().or(z.boolean()),
    es_jubilado: z.coerce.number().optional().or(z.boolean()),
    es_jubilado_con_afp: z.coerce.number().optional().or(z.boolean()),
    aplica_renta: z.coerce.number().optional().or(z.boolean()),
    en_vacaciones: z.coerce.number().optional().or(z.boolean()),
    incapacitado: z.coerce.number().optional().or(z.boolean()),
    comentarios: emptyToNull.nullable().optional(),
    emergency_contacts: z.array(emergencyContactSchema).optional()
};

const validateEmpleadoRefine = (data, ctx) => {
    if (data.num_dui && typeof data.num_dui === 'string' && data.num_dui.trim()) {
        const cleanDui = data.num_dui.trim();
        if (!duiRegex.test(cleanDui)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['num_dui'],
                message: 'Formato de DUI inválido (ej: 00000000-0)'
            });
        }
    }
    if (data.num_nit && typeof data.num_nit === 'string' && data.num_nit.trim()) {
        const cleanNit = data.num_nit.trim();
        if (!nitRegex.test(cleanNit) && !duiRegex.test(cleanNit)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['num_nit'],
                message: 'Formato de NIT inválido (ej: 0000-000000-000-0)'
            });
        }
    }
};

const empleadoSchema = z.object(empleadoBaseShape).passthrough().superRefine(validateEmpleadoRefine);
const empleadoUpdateSchema = z.object(empleadoBaseShape).partial().passthrough().superRefine(validateEmpleadoRefine);


// ==========================================
// 2. ACCIONES DE PERSONAL
// ==========================================
const accionPersonalSchema = z.object({
    empleado_id: z.coerce.number({ error: 'El empleado es obligatorio' }),
    fecha: z.string({ error: 'La fecha de la acción es obligatoria' })
        .trim()
        .min(1, 'La fecha no puede estar vacía'),
    descripcion_causa: z.string({ error: 'La descripción de la causa es obligatoria' })
        .trim()
        .min(1, 'La descripción de la causa es obligatoria'),
    jefe_inmediato: emptyToNull.nullable().optional(),
    lugar_trabajo: emptyToNull.nullable().optional(),
    tiempo_laborado: emptyToNull.nullable().optional(),
    tipo_accion: emptyToNull.nullable().optional().default('amonestacion'),
    infracciones: z.any().optional(),
    infraccion_otra: emptyToNull.nullable().optional(),
    articulo_codigo_trabajo: emptyToNull.nullable().optional(),
    accion_tomar: emptyToNull.nullable().optional().default('llamado_escrito_1'),
    dias_suspension: z.coerce.number().min(0, 'Los días de suspensión no pueden ser negativos').optional().default(0),
    fecha_inicio_suspension: emptyToNull.nullable().optional(),
    fecha_fin_suspension: emptyToNull.nullable().optional(),
    accion_otra: emptyToNull.nullable().optional(),
    recursos_humanos: emptyToNull.nullable().optional(),
    estado_firma: emptyToNull.nullable().optional(),
    testigo_nombre: emptyToNull.nullable().optional(),
    observaciones: emptyToNull.nullable().optional(),
    estado: emptyToNull.nullable().optional().default('aplicada')
}).passthrough();

const accionPersonalUpdateSchema = accionPersonalSchema.partial().passthrough();


// ==========================================
// 3. PLANILLA DE VACACIONES
// ==========================================
const planillaVacacionesSchema = z.object({
    empleado_id: z.coerce.number({ error: 'El empleado es obligatorio' }),
    periodo_año: z.coerce.number({ error: 'El año del período es obligatorio' }).int().min(2000),
    periodo_mes: z.coerce.number({ error: 'El mes del período es obligatorio' }).int().min(1).max(12),
    quincena: z.coerce.number({ error: 'La quincena es obligatoria' }).int().min(1).max(2),
    fecha_inicial: z.string({ error: 'La fecha inicial es obligatoria' })
        .trim()
        .min(1, 'La fecha inicial no puede estar vacía'),
    fecha_final: z.string({ error: 'La fecha final es obligatoria' })
        .trim()
        .min(1, 'La fecha final no puede estar vacía'),
    dias_transcurridos: z.coerce.number().optional().default(0),
    vacaciones_monto: z.coerce.number().min(0, 'El monto de vacaciones no puede ser negativo').optional().default(0),
    descuento_isss: z.coerce.number().optional().default(0),
    descuento_afp: z.coerce.number().optional().default(0),
    descuento_renta: z.coerce.number().optional().default(0),
    total_devengado: z.coerce.number().optional().default(0),
    total_deducciones: z.coerce.number().optional().default(0),
    monto_recibir: z.coerce.number().optional().default(0)
}).passthrough();

const planillaVacacionesUpdateSchema = planillaVacacionesSchema.partial().passthrough();


// ==========================================
// 4. PLANILLA DE AGUINALDOS
// ==========================================
const aguinaldoItemSchema = z.object({
    empleado_id: z.coerce.number({ error: 'El empleado es obligatorio en cada ítem' }),
    departamento_personal_id: z.coerce.number().nullable().optional(),
    sueldo_base: z.coerce.number().optional().default(0),
    dias_antiguedad: z.coerce.number().optional().default(0),
    dias_segun_tabla: z.coerce.number().optional().default(0),
    aguinaldo_calculado: z.coerce.number().min(0).optional().default(0),
    excedente: z.coerce.number().optional().default(0),
    renta: z.coerce.number().optional().default(0),
    monto_recibir: z.coerce.number().min(0).optional().default(0)
}).passthrough();

const planillaAguinaldosSchema = z.object({
    año: z.coerce.number({ error: 'El año del período es obligatorio' }).int().min(2000),
    mes: z.coerce.number().int().min(1).max(12).optional().default(12),
    filtro_departamento_id: z.coerce.number().nullable().optional(),
    items: z.array(aguinaldoItemSchema, { error: 'Los ítems son requeridos' })
        .min(1, 'Debe incluir al menos un empleado en la planilla')
}).passthrough();


// ==========================================
// 5. DESCUENTOS PROGRAMADOS
// ==========================================
// Catálogo general de descuentos programados (/rh/descuentos-programados)
const rhDescuentoProgramadoSchema = z.object({
    codigo: z.string({ error: 'El código es obligatorio' })
        .trim()
        .min(1, 'El código no puede estar vacío'),
    descripcion: z.string({ error: 'La descripción es obligatoria' })
        .trim()
        .min(1, 'La descripción no puede estar vacía'),
    cuenta_id: z.coerce.number().nullable().optional()
}).passthrough();

// Asignación de descuento a empleado (/rh/empleados/:id/descuentos)
const rhEmpleadoDescuentoSchema = z.object({
    descuento_id: z.coerce.number({ error: 'El descuento es obligatorio' })
        .int()
        .min(1, 'Debe seleccionar un descuento'),
    quincena: z.enum(['primera', 'segunda', 'ambas']).default('primera'),
    valor: z.coerce.number({ error: 'El valor debe ser numérico' })
        .gt(0, 'El valor debe ser mayor a 0'),
    numero_cuotas: z.coerce.number().int().min(1).default(1),
    cuotas_restantes: z.coerce.number().int().min(0).default(1),
    numero_credito: emptyToNull.nullable().optional()
}).passthrough();

// Mantener compatibilidad con rhDescuentoSchema
const rhDescuentoSchema = z.object({
    tipo_descuento: z.string({ error: 'El tipo de descuento es obligatorio' })
        .trim()
        .min(1, 'El tipo de descuento no puede estar vacío'),
    descripcion: emptyToNull.nullable().optional(),
    monto_total: z.coerce.number({ error: 'El monto total debe ser numérico' })
        .gt(0, 'El monto total debe ser mayor a 0'),
    monto_cuota: z.coerce.number({ error: 'El monto de la cuota debe ser numérico' })
        .gt(0, 'El monto de la cuota debe ser mayor a 0'),
    cuotas_totales: z.coerce.number().int().min(1).optional(),
    fecha_inicio: emptyToNull.nullable().optional()
}).passthrough();

// ==========================================
// 6. CONTRATOS LABORALES
// ==========================================
const dependienteContratoSchema = z.object({
    nombre: z.preprocess(val => (val === undefined || val === null ? '' : String(val).trim()), z.string().optional().default('')),
    apellido: z.preprocess(val => (val === undefined || val === null ? '' : String(val).trim()), z.string().optional().default('')),
    fecha_nacimiento: emptyToNull.nullable().optional(),
    edad: z.preprocess(val => (val === '' || val === null || val === undefined ? null : Number(val)), z.number().nullable().optional()),
    direccion: z.preprocess(val => (val === undefined || val === null ? '' : String(val).trim()), z.string().optional().default(''))
}).passthrough();

const contratoLaboralSchema = z.object({
    empleado_id: z.coerce.number().nullable().optional(),
    trabajador_nombre: z.string({ error: 'El nombre del trabajador es obligatorio' })
        .trim()
        .min(1, 'El nombre del trabajador no puede estar vacío'),
    fecha_nacimiento: emptyToNull.nullable().optional(),
    edad: z.coerce.number().nullable().optional(),
    sexo: emptyToNull.nullable().optional().default('MASCULINO'),
    estado_civil: emptyToNull.nullable().optional().default('SOLTERO'),
    profesion_oficio: emptyToNull.nullable().optional().default('ESTUDIANTE'),
    direccion: emptyToNull.nullable().optional(),
    nacionalidad: emptyToNull.nullable().optional().default('SALVADOREÑO'),
    num_dui: emptyToNull.nullable().optional(),
    dui_extendido_en: emptyToNull.nullable().optional(),
    num_nit: emptyToNull.nullable().optional(),
    num_isss: emptyToNull.nullable().optional(),
    cargo_laboral: z.string({ error: 'El cargo laboral es obligatorio' })
        .trim()
        .min(1, 'El cargo laboral no puede estar vacío'),
    obligaciones: emptyToNull.nullable().optional(),
    lugar_trabajo: z.string({ error: 'El lugar de trabajo es obligatorio' })
        .trim()
        .min(1, 'El lugar de trabajo no puede estar vacío'),
    jefe_inmediato: emptyToNull.nullable().optional(),
    plazo_contrato: emptyToNull.nullable().optional().default('TIEMPO INDEFINIDO'),
    fecha_inicio: z.string({ error: 'La fecha de inicio es obligatoria' })
        .trim()
        .min(1, 'La fecha de inicio es obligatoria'),
    lugar_creacion: emptyToNull.nullable().optional().default('SAN SALVADOR'),
    fecha_creacion: z.string({ error: 'La fecha de creación es obligatoria' })
        .trim()
        .min(1, 'La fecha de creación es obligatoria'),
    salario_mensual: z.coerce.number().min(0, 'El salario mensual no puede ser negativo').default(0),
    lugar_pago: emptyToNull.nullable().optional(),
    forma_pago: emptyToNull.nullable().optional().default('TRANFERENCIA BANCARIA'),
    horario_dia_inicio: emptyToNull.nullable().optional().default('LUNES'),
    horario_dia_fin: emptyToNull.nullable().optional().default('VIERNES'),
    horario_manana_desde: emptyToNull.nullable().optional().default('8:00 A.M.'),
    horario_manana_hasta: emptyToNull.nullable().optional().default('12:00 P.M.'),
    horario_tarde_desde: emptyToNull.nullable().optional().default('1:00 P.M.'),
    horario_tarde_hasta: emptyToNull.nullable().optional().default('5:00 P.M.'),
    horario_dia_extra: emptyToNull.nullable().optional().default('SABADO'),
    horario_extra_desde: emptyToNull.nullable().optional().default('8:00 A.M.'),
    horario_extra_hasta: emptyToNull.nullable().optional().default('12:00 P.M.'),
    total_horas_semana: z.coerce.number().min(0).optional().default(44),
    dependientes: z.array(dependienteContratoSchema).optional().default([]),
    patrono_nombre: emptyToNull.nullable().optional(),
    patrono_edad: z.coerce.number().nullable().optional(),
    patrono_sexo: emptyToNull.nullable().optional(),
    patrono_estado_civil: emptyToNull.nullable().optional(),
    patrono_profesion: emptyToNull.nullable().optional(),
    patrono_direccion: emptyToNull.nullable().optional(),
    patrono_nacionalidad: emptyToNull.nullable().optional(),
    patrono_dui: emptyToNull.nullable().optional(),
    patrono_dui_extendido: emptyToNull.nullable().optional(),
    patrono_nit: emptyToNull.nullable().optional(),
    herramientas_materiales: emptyToNull.nullable().optional(),
    otras_estipulaciones: emptyToNull.nullable().optional(),
    estado: emptyToNull.nullable().optional().default('vigente')
}).passthrough();

const contratoLaboralUpdateSchema = contratoLaboralSchema.partial().passthrough();

module.exports = {
    empleadoSchema,
    empleadoUpdateSchema,
    accionPersonalSchema,
    accionPersonalUpdateSchema,
    planillaVacacionesSchema,
    planillaVacacionesUpdateSchema,
    planillaAguinaldosSchema,
    rhDescuentoSchema,
    rhDescuentoProgramadoSchema,
    rhEmpleadoDescuentoSchema,
    contratoLaboralSchema,
    contratoLaboralUpdateSchema
};
