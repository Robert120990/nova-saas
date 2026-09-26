/**
 * Zod Schemas for CRM Module:
 * Agreements, CRM Settings, Quotations, Status, Signatures, Emails.
 */
const { z } = require('zod');
const { emptyToNull } = require('./schemaHelpers');

// ==========================================
// 1. ACUERDOS COMERCIALES (Agreements)
// ==========================================
const agreementItemSchema = z.object({
    id: z.coerce.number().optional(),
    product_id: z.coerce.number().nullable().optional(),
    product_type: emptyToNull.nullable().optional(),
    presentation: emptyToNull.nullable().optional(),
    agreed_price_per_lb: z.coerce.number().min(0, 'El precio por libra no puede ser negativo').optional(),
    agreed_unit_price: z.coerce.number().min(0, 'El precio unitario no puede ser negativo').optional(),
    monthly_volume_lbs: z.coerce.number().min(0, 'El volumen mensual no puede ser negativo').optional(),
    target_margin_pct: z.coerce.number().optional(),
    notes: emptyToNull.nullable().optional()
}).passthrough();

const agreementSchema = z.object({
    id: z.coerce.number().optional(),
    customer_id: z.coerce.number().nullable().optional(),
    customer_name: z.string({ error: 'El nombre del cliente es obligatorio' })
        .trim()
        .min(1, 'El nombre del cliente es obligatorio'),
    product_id: z.coerce.number().nullable().optional(),
    product_type: emptyToNull.nullable().optional(),
    presentation: emptyToNull.nullable().optional(),
    agreed_price_per_lb: z.coerce.number().min(0, 'El precio por libra no puede ser negativo').optional(),
    agreed_unit_price: z.coerce.number().min(0, 'El precio unitario no puede ser negativo').optional(),
    monthly_volume_lbs: z.coerce.number().min(0, 'El volumen mensual no puede ser negativo').optional(),
    target_margin_pct: z.coerce.number().optional(),
    freight_cost_per_lb: z.coerce.number().min(0, 'El costo de flete no puede ser negativo').optional(),
    payment_terms_days: z.coerce.number().min(0, 'Los días de crédito no pueden ser negativos').optional(),
    valid_from: emptyToNull.nullable().optional(),
    valid_to: emptyToNull.nullable().optional(),
    change_reason: emptyToNull.nullable().optional(),
    notes: emptyToNull.nullable().optional(),
    status: z.enum(['activo', 'inactivo', 'vencido', 'borrador']).optional().or(z.string()),
    items: z.array(agreementItemSchema).optional()
}).passthrough();


// ==========================================
// 2. CONFIGURACIÓN CRM (CRM Settings)
// ==========================================
const crmSettingsSchema = z.object({
    default_target_margin_pct: z.coerce.number().optional(),
    default_payment_terms_days: z.coerce.number().optional(),
    default_freight_per_lb: z.coerce.number().optional(),
    min_monthly_volume_lbs: z.coerce.number().optional(),
    contract_alert_days: z.coerce.number().optional(),
    auto_apply_agreements_in_pos: z.coerce.number().optional(),
    require_supervisor_override: z.coerce.number().optional(),
    grace_period_days: z.coerce.number().optional(),
    default_terms_conditions: emptyToNull.nullable().optional(),
    notification_email: emptyToNull.nullable().optional()
}).passthrough();


// ==========================================
// 3. COTIZACIONES (Quotations)
// ==========================================
const quotationItemSchema = z.object({
    product_id: z.coerce.number().nullable().optional(),
    product_code: emptyToNull.nullable().optional(),
    product_name: z.string({ error: 'El nombre del ítem es obligatorio' })
        .trim()
        .min(1, 'El nombre del ítem es obligatorio'),
    presentation: emptyToNull.nullable().optional(),
    quantity: z.coerce.number({ error: 'La cantidad debe ser numérica' })
        .gt(0, 'La cantidad debe ser mayor a 0'),
    unit_measure: emptyToNull.nullable().optional(),
    current_cost: z.coerce.number().min(0, 'El costo actual no puede ser negativo').optional(),
    unit_price: z.coerce.number({ error: 'El precio unitario debe ser numérico' })
        .min(0, 'El precio unitario no puede ser negativo'),
    suggested_price: z.coerce.number().optional(),
    discount_amount: z.coerce.number().min(0, 'El descuento no puede ser negativo').optional(),
    notes: emptyToNull.nullable().optional()
}).passthrough();

const quotationCreateSchema = z.object({
    customer_id: z.coerce.number().nullable().optional(),
    customer_name: z.string({ error: 'El nombre del cliente es obligatorio' })
        .trim()
        .min(1, 'El nombre del cliente es obligatorio'),
    customer_contact: emptyToNull.nullable().optional(),
    customer_email: emptyToNull.nullable().optional(),
    customer_phone: emptyToNull.nullable().optional(),
    customer_address: emptyToNull.nullable().optional(),
    customer_nrc: emptyToNull.nullable().optional(),
    customer_nit: emptyToNull.nullable().optional(),
    date: emptyToNull.nullable().optional(),
    validity_days: z.coerce.number().min(1, 'La vigencia debe ser de al menos 1 día').optional(),
    payment_terms: emptyToNull.nullable().optional(),
    delivery_time: emptyToNull.nullable().optional(),
    our_commitments: emptyToNull.nullable().optional(),
    notes: emptyToNull.nullable().optional(),
    signature_data: emptyToNull.nullable().optional(),
    signature_author_name: emptyToNull.nullable().optional(),
    signature_author_title: emptyToNull.nullable().optional(),
    signature_author_phone: emptyToNull.nullable().optional(),
    delicate_reason: emptyToNull.nullable().optional(),
    items: z.array(quotationItemSchema, { error: 'Los ítems de la cotización son requeridos' })
        .min(1, 'La cotización debe contener al menos un producto o ítem')
}).passthrough();

const quotationUpdateSchema = quotationCreateSchema.extend({
    status: z.enum(['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'], {
        error: 'Estado de cotización inválido'
    }).optional()
}).passthrough();

const quotationStatusSchema = z.object({
    status: z.enum(['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'], {
        error: 'Estado de cotización inválido (permitidos: borrador, enviada, aprobada, rechazada, vencida)'
    })
}).passthrough();

const userSignatureSchema = z.object({
    signature_data: emptyToNull.nullable().optional(),
    signature_title: emptyToNull.nullable().optional(),
    phone: emptyToNull.nullable().optional()
}).passthrough();

const quotationEmailSchema = z.object({
    to: z.string({ error: 'El correo del destinatario es obligatorio' })
        .trim()
        .min(1, 'El correo del destinatario es obligatorio'),
    cc: emptyToNull.nullable().optional(),
    subject: emptyToNull.nullable().optional(),
    message: emptyToNull.nullable().optional(),
    include_pdf: z.coerce.boolean().optional(),
    include_docx: z.coerce.boolean().optional()
}).passthrough();

module.exports = {
    agreementSchema,
    crmSettingsSchema,
    quotationCreateSchema,
    quotationUpdateSchema,
    quotationStatusSchema,
    userSignatureSchema,
    quotationEmailSchema
};
