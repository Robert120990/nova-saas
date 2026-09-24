const { z } = require('zod');

// CXP Payment Document Item
const cxpPaymentDocumentSchema = z.object({
    purchase_id: z.coerce.number().int().positive().optional().nullable(),
    expense_id: z.coerce.number().int().positive().optional().nullable(),
    monto: z.coerce.number({ message: 'El monto del documento debe ser numérico' })
});

// CXP Payment Registration Schema
const cxpPaymentShape = {
    provider_id: z.coerce.number().int().positive({ message: 'El proveedor es requerido' }),
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    fecha_pago: z.string({ message: 'La fecha de pago es requerida' }).min(1, { message: 'La fecha de pago es requerida' }),
    metodo_pago: z.string({ message: 'El método de pago es requerido' }).trim().min(1, { message: 'El método de pago es requerido' }),
    referencia: z.string().optional().nullable(),
    notas: z.string().optional().nullable(),
    documentos: z.array(cxpPaymentDocumentSchema).min(1, { message: 'Debe incluir al menos un documento a pagar' })
};

const cxpPaymentSchema = z.object(cxpPaymentShape).superRefine((data, ctx) => {
    const validDocs = (data.documentos || []).filter(d => parseFloat(d.monto) > 0);
    if (validDocs.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Debe haber al menos un documento con monto de pago mayor a cero',
            path: ['documentos']
        });
    }
});

// CXP Single Payment Update Schema
const cxpPaymentUpdateShape = {
    monto: z.coerce.number().positive({ message: 'El monto debe ser mayor a 0' }),
    fecha_pago: z.string({ message: 'La fecha de pago es requerida' }).min(1, { message: 'La fecha de pago es requerida' }),
    metodo_pago: z.string({ message: 'El método de pago es requerido' }).trim().min(1, { message: 'El método de pago es requerido' }),
    referencia: z.string().optional().nullable(),
    notas: z.string().optional().nullable()
};

const cxpPaymentUpdateSchema = z.object(cxpPaymentUpdateShape).partial();

module.exports = {
    cxpPaymentDocumentSchema,
    cxpPaymentSchema,
    cxpPaymentUpdateSchema
};
