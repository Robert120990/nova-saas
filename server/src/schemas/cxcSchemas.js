const { z } = require('zod');

// CXC Payment Document Item
const cxcPaymentDocumentSchema = z.object({
    sale_id: z.coerce.number().int().positive().optional().nullable(),
    gas_credito_id: z.coerce.number().int().positive().optional().nullable(),
    monto: z.coerce.number({ message: 'El monto del documento debe ser numérico' })
});

// CXC Payment Registration Schema
const cxcPaymentShape = {
    customer_id: z.coerce.number().int().positive({ message: 'El cliente es requerido' }),
    branch_id: z.coerce.number().int().positive({ message: 'La sucursal es requerida' }),
    fecha_pago: z.string({ message: 'La fecha de pago es requerida' }).min(1, { message: 'La fecha de pago es requerida' }),
    metodo_pago: z.string({ message: 'El método de pago es requerido' }).trim().min(1, { message: 'El método de pago es requerido' }),
    referencia: z.string().optional().nullable(),
    notas: z.string().optional().nullable(),
    documentos: z.array(cxcPaymentDocumentSchema).min(1, { message: 'Debe incluir al menos un documento a abonar' })
};

const cxcPaymentSchema = z.object(cxcPaymentShape).superRefine((data, ctx) => {
    const validDocs = (data.documentos || []).filter(d => parseFloat(d.monto) > 0);
    if (validDocs.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Debe haber al menos un documento con monto de abono mayor a cero',
            path: ['documentos']
        });
    }
});

// CXC Single Payment Update Schema
const cxcPaymentUpdateShape = {
    monto: z.coerce.number().positive({ message: 'El monto debe ser mayor a 0' }),
    fecha_pago: z.string({ message: 'La fecha de pago es requerida' }).min(1, { message: 'La fecha de pago es requerida' }),
    metodo_pago: z.string({ message: 'El método de pago es requerido' }).trim().min(1, { message: 'El método de pago es requerido' }),
    referencia: z.string().optional().nullable(),
    notas: z.string().optional().nullable()
};

const cxcPaymentUpdateSchema = z.object(cxcPaymentUpdateShape).partial();

module.exports = {
    cxcPaymentDocumentSchema,
    cxcPaymentSchema,
    cxcPaymentUpdateSchema
};
