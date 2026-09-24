const { z } = require('zod');

/**
 * Validation schemas for Sales & Invoicing (Ventas y Facturación)
 */

const saleItemSchema = z.object({
    product_id: z.coerce.number().int().positive().nullable().optional(),
    codigo: z.string().trim().nullable().optional(),
    combo_id: z.coerce.number().int().positive().nullable().optional(),
    descripcion: z.string({ required_error: 'La descripción del ítem es requerida' })
        .trim().min(1, 'La descripción no puede estar vacía'),
    cantidad: z.coerce.number({ required_error: 'La cantidad es requerida' })
        .positive('La cantidad debe ser mayor a cero'),
    precio_unitario: z.coerce.number({ required_error: 'El precio unitario es requerido' })
        .min(0, 'El precio no puede ser negativo'),
    monto_descuento: z.coerce.number().min(0).default(0).optional(),
    venta_gravada: z.coerce.number().default(0).optional(),
    venta_exenta: z.coerce.number().default(0).optional(),
    venta_nosujeta: z.coerce.number().default(0).optional(),
    tributos: z.any().optional()
});

const salePaymentSchema = z.object({
    codigo: z.string().trim().optional(),
    metodo_pago: z.string().trim().optional(),
    monto: z.coerce.number({ required_error: 'El monto de pago es requerido' })
        .positive('El monto de pago debe ser mayor a cero'),
    referencia: z.string().trim().nullable().optional()
});

const saleLinkedDocumentSchema = z.object({
    doc_type: z.string().trim().nullable().optional(),
    doc_number: z.string().trim().nullable().optional(),
    emission_date: z.string().trim().nullable().optional(),
    generation_type: z.coerce.number().int().nullable().optional(),
    monto_sujeto: z.coerce.number().nullable().optional(),
    montoSujeto: z.coerce.number().nullable().optional(),
    iva_retenido: z.coerce.number().nullable().optional(),
    ivaRetenido: z.coerce.number().nullable().optional(),
    descripcion: z.string().trim().nullable().optional()
});

const saleCreateSchema = z.object({
    header: z.object({
        customer_id: z.coerce.number().int().positive().nullable().optional(),
        customer_branch_id: z.coerce.number().int().positive().nullable().optional(),
        seller_id: z.coerce.number().int().positive().nullable().optional(),
        pos_id: z.coerce.number().int().positive().nullable().optional(),
        shift_id: z.coerce.number().int().positive().nullable().optional(),
        branch_id: z.coerce.number().int().positive().nullable().optional(),
        dte_type: z.string({ required_error: 'El tipo de DTE es requerido' }).trim().min(1, 'El tipo de DTE es requerido'),
        tipo_documento: z.string().trim().optional(),
        condicion_operacion: z.coerce.number().int().optional(),
        payment_condition: z.coerce.number().int().optional(),
        total_gravado: z.coerce.number().default(0).optional(),
        total_exento: z.coerce.number().default(0).optional(),
        total_nosujetas: z.coerce.number().default(0).optional(),
        total_nosujeto: z.coerce.number().default(0).optional(),
        fovial: z.coerce.number().default(0).optional(),
        total_fovial: z.coerce.number().default(0).optional(),
        cotrans: z.coerce.number().default(0).optional(),
        total_cotrans: z.coerce.number().default(0).optional(),
        total_iva: z.coerce.number().default(0).optional(),
        descuento_general: z.coerce.number().default(0).optional(),
        total_descuento: z.coerce.number().default(0).optional(),
        total_percepcion: z.coerce.number().default(0).optional(),
        iva_percibido: z.coerce.number().default(0).optional(),
        total_retencion: z.coerce.number().default(0).optional(),
        iva_retenido: z.coerce.number().default(0).optional(),
        total_pagar: z.coerce.number({ required_error: 'El total a pagar es requerido' }),
        total: z.coerce.number().optional(),
        observaciones: z.string().trim().nullable().optional(),
        export_item_type: z.any().nullable().optional(),
        fiscal_enclosure: z.any().nullable().optional(),
        export_regime: z.any().nullable().optional(),
        dest_country_code: z.any().nullable().optional(),
        remission_type: z.any().nullable().optional(),
        transporter_name: z.string().trim().nullable().optional(),
        vehicle_plate: z.string().trim().nullable().optional(),
        cliente_nombre: z.string().trim().nullable().optional()
    }, { required_error: 'La cabecera de la venta es requerida' }),
    items: z.array(saleItemSchema, { required_error: 'Los ítems de la venta son requeridos' })
        .min(1, 'La venta debe contener al menos un producto'),
    payments: z.array(salePaymentSchema).optional().default([]),
    linkedDocuments: z.array(saleLinkedDocumentSchema).optional().default([])
});

const saleChangeShiftSchema = z.object({
    ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), sale_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive({ message: 'ID de venta inválido' })
        ]), {
        required_error: 'Debe seleccionar al menos una venta'
    }).min(1, 'Debe seleccionar al menos una venta'),
    shift_id: z.coerce.number({ required_error: 'Debe indicar el turno destino' })
        .int('El ID de turno debe ser un número entero')
        .positive('Debe indicar un turno destino válido')
});

const saleCustomerUpdateSchema = z.object({
    nombre: z.string().trim().nullable().optional(),
    nombre_comercial: z.string().trim().nullable().optional(),
    tipo_documento: z.string().trim().nullable().optional(),
    numero_documento: z.string().trim().nullable().optional(),
    nit: z.string().trim().nullable().optional(),
    nrc: z.string().trim().nullable().optional(),
    codigo_actividad: z.string().trim().nullable().optional(),
    departamento: z.string().trim().nullable().optional(),
    municipio: z.string().trim().nullable().optional(),
    direccion: z.string().trim().nullable().optional(),
    telefono: z.string().trim().nullable().optional(),
    correo: z.string().trim().email('Correo electrónico no válido').nullable().optional().or(z.literal('')),
    retransmit: z.boolean().optional()
});

const salesSettingsSchema = z.record(z.string(), z.any());

const salesRemesaDeliveryShape = {
    fecha: z.string({ required_error: 'La fecha es requerida' })
        .regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    hora: z.string({ required_error: 'La hora es requerida' }).min(1, 'La hora es requerida'),
    referencia: z.string({ required_error: 'El número de referencia es requerido' })
        .trim().min(1, 'El número de referencia es requerido'),
    responsable: z.string().trim().nullable().optional(),
    comentario: z.string().trim().nullable().optional(),
    remesa_ids: z.array(
        z.union([
            z.object({ id: z.coerce.number().int().positive().optional(), remesa_id: z.coerce.number().int().positive().optional() }).passthrough(),
            z.coerce.number().int().positive()
        ])
    ).optional(),
    monto_entregado: z.coerce.number().positive().nullable().optional()
};

const salesRemesaDeliverySchema = z.object(salesRemesaDeliveryShape);
const salesRemesaDeliveryUpdateSchema = z.object(salesRemesaDeliveryShape).partial();

const salesTiendaRrsSchema = z.object({
    fecha: z.string({ required_error: 'La fecha es requerida' })
        .regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    monto: z.coerce.number({ required_error: 'El monto es requerido' }),
    branch_id: z.coerce.number().int().positive().nullable().optional()
});

const editDTEItemsSchema = z.object({
    items: z.array(z.object({
        sales_item_id: z.coerce.number().int().positive().optional(),
        descripcion: z.string({ required_error: 'La descripción es requerida' })
            .trim().min(1, 'La descripción no puede estar vacía'),
        cantidad: z.coerce.number().positive().optional(),
        precio_unitario: z.coerce.number().min(0).optional()
    }), { required_error: 'items es requerido' }).min(1, 'Debe incluir al menos un ítem')
});

module.exports = {
    saleCreateSchema,
    saleItemSchema,
    salePaymentSchema,
    saleChangeShiftSchema,
    saleCustomerUpdateSchema,
    salesSettingsSchema,
    salesRemesaDeliverySchema,
    salesRemesaDeliveryUpdateSchema,
    salesTiendaRrsSchema,
    editDTEItemsSchema
};
