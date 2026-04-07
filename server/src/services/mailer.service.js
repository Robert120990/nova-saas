const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { 
    generateProviderStatementPDF, 
    generateProviderAgingPDF,
    generatePaymentReceiptPDF,
    generateStatementPDF,
    generateAgingPDF
} = require('./pdf.service');

// ── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Encapsulates the logic to find the correct SMTP account for a branch or its company.
 * Throws Error if not found.
 */
const getSMTPSettings = async (branchId, companyId) => {
    if (!branchId) throw new Error('Se requiere el ID de sucursal para obtener SMTP');
    
    // 1. Try branch-specific first
    const [branchRows] = await pool.query('SELECT * FROM smtp_settings WHERE branch_id = ?', [branchId]);
    if (branchRows.length > 0) return branchRows[0];

    // 2. Fallback to any SMTP within the same company
    if (companyId) {
        const [companyRows] = await pool.query(`
            SELECT s.* FROM smtp_settings s
            JOIN branches b ON s.branch_id = b.id
            WHERE b.company_id = ?
            LIMIT 1
        `, [companyId]);
        if (companyRows.length > 0) {
            console.log(`[Mailer] Using company fallback SMTP for branch ${branchId}`);
            return companyRows[0];
        }
    }
    
    throw new Error('No se encontró configuración SMTP para esta sucursal ni para la empresa. Por favor, configure el correo en el panel de sucursales.');
};

/**
 * Creates a nodemailer transporter from smtp settings.
 */
const createTransporter = (smtp) => {
    return nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port),
        secure: smtp.encryption === 'ssl' || parseInt(smtp.port) === 465,
        auth: {
            user: smtp.user,
            pass: smtp.password
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1'
        }
    });
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sends a customer statement email with a PDF attachment
 */
const sendCustomerStatementEmail = async (customerId, branchId, companyId) => {
    try {
        const [companyRows] = await pool.query('SELECT razon_social, nombre_comercial FROM companies WHERE id = ?', [companyId]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
        const [customerRows] = await pool.query('SELECT nombre, correo FROM customers WHERE id = ?', [customerId]);

        if (!customerRows.length || !customerRows[0].correo) {
            throw new Error('El cliente no tiene un correo electrónico registrado.');
        }

        const customer = customerRows[0];
        const smtp = await getSMTPSettings(branchId, companyId);

        // Fetch movements data
        const [sales] = await pool.query(`
            SELECT h.fecha_emision as fecha, h.tipo_documento as tipo, COALESCE(d.numero_control, h.id) as numero,
                   h.total_pagar as cargo, 0 as abono, 'VENTA' as concepto
            FROM sales_headers h
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ? 
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2) AND h.estado != 'ANULADO'
        `, [companyId, branchId, customerId]);

        const [payments] = await pool.query(`
            SELECT p.fecha_pago as fecha, 'RECIBO' as tipo, p.referencia as numero,
                   0 as cargo, p.monto as abono, 'ABONO' as concepto
            FROM customer_payments p
            WHERE p.company_id = ? AND p.branch_id = ? AND p.customer_id = ?
        `, [companyId, branchId, customerId]);

        const movementsAll = [...sales, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let currentBalance = 0;
        const history = movementsAll.map(m => {
            const cargo = parseFloat(m.cargo || 0);
            const abono = parseFloat(m.abono || 0);
            currentBalance += (cargo - abono);
            return { ...m, cargo, abono, balance: currentBalance };
        });

        const pdfBuffer = await generateStatementPDF({
            company_name: companyRows[0]?.nombre_comercial || companyRows[0]?.razon_social || 'Empresa',
            branch_name: branchRows[0]?.nombre || 'Sucursal',
            customer_name: customer.nombre,
            customer_email: customer.correo,
            total_balance: currentBalance,
            movements: history
        });

        const transporter = createTransporter(smtp);
        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: customer.correo,
            subject: `Estado de Cuenta - ${companyRows[0]?.nombre_comercial || companyRows[0]?.razon_social || 'CXC'}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px; max-width: 600px; margin: auto;">
                    <h2 style="color: #4f46e5; text-align: center;">Estado de Cuenta</h2>
                    <p>Hola <b>${customer.nombre}</b>,</p>
                    <p>Adjunto encontrará su estado de cuenta actualizado a la fecha: <b>${new Date().toLocaleDateString('es-SV')}</b>.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">Saldo Total Pendiente</span>
                        <div style="font-size: 32px; font-weight: 800; color: #1e293b;">$${parseFloat(currentBalance).toFixed(2)}</div>
                    </div>
                    <p style="font-size: 13px; color: #666;">Adjunto encontrará el archivo PDF con el desglose de sus movimientos.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">Este es un mensaje automático de <b>${branchRows[0].nombre}</b>.</p>
                </div>
            `,
            attachments: [{ filename: `Estado_Cuenta_${customer.nombre.replace(/ /g, '_')}.pdf`, content: pdfBuffer }]
        });
    } catch (error) {
        console.error(`[Mailer] ERROR in sendCustomerStatementEmail:`, error);
        throw error;
    }
};

/**
 * Sends a provider statement email with a PDF attachment
 */
const sendProviderStatementEmail = async (providerId, branchId, companyId) => {
    try {
        const [companyRows] = await pool.query('SELECT razon_social, nombre_comercial FROM companies WHERE id = ?', [companyId]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
        const [providerRows] = await pool.query('SELECT nombre, correo FROM providers WHERE id = ?', [providerId]);

        if (!providerRows.length || !providerRows[0].correo) {
            throw new Error('El proveedor no tiene un correo electrónico registrado.');
        }

        const provider = providerRows[0];
        const smtp = await getSMTPSettings(branchId, companyId);

        const [purchases] = await pool.query(`
            SELECT p.fecha_emision as fecha, p.tipo_documento as tipo, p.numero_documento as numero,
                   p.total as cargo, 0 as abono, 'COMPRA' as concepto
            FROM purchases p
            WHERE p.company_id = ? AND p.branch_id = ? AND p.provider_id = ? AND p.estado != 'ANULADO'
        `, [companyId, branchId, providerId]);

        const [payments] = await pool.query(`
            SELECT pp.fecha_pago as fecha, 'RECIBO' as tipo, pp.referencia as numero,
                   0 as cargo, pp.monto as abono, 'PAGO' as concepto
            FROM provider_payments pp
            WHERE pp.company_id = ? AND pp.branch_id = ? AND pp.provider_id = ?
        `, [companyId, branchId, providerId]);

        const movementsAll = [...purchases, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let currentBalance = 0;
        const history = movementsAll.map(m => {
            currentBalance += (parseFloat(m.cargo || 0) - parseFloat(m.abono || 0));
            return { ...m, balance: currentBalance };
        });

        const pdfBuffer = await generateProviderStatementPDF({
            company_name: companyRows[0]?.nombre_comercial || companyRows[0]?.razon_social || 'Empresa',
            branch_name: branchRows[0]?.nombre || 'Sucursal',
            provider_name: provider.nombre,
            provider_email: provider.correo,
            total_balance: currentBalance,
            movements: history
        });

        const transporter = createTransporter(smtp);
        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: provider.correo,
            subject: `Estado de Cuenta CXP - ${companyRows[0]?.nombre_comercial || companyRows[0]?.razon_social}`,
            html: `<p>Hola <b>${provider.nombre}</b>, adjunto su estado de cuenta de sus compromisos con nosotros.</p>`,
            attachments: [{ filename: `Estado_Cuenta_Proveedor.pdf`, content: pdfBuffer }]
        });
    } catch (error) {
        console.error(`[Mailer] ERROR in sendProviderStatementEmail:`, error);
        throw error;
    }
};

/**
 * Sends a payment receipt email (Customer Abono)
 */
const sendPaymentReceiptEmail = async (paymentId) => {
    console.log(`[Mailer] Iniciando proceso de envío de recibo para Pago ID: ${paymentId}`);
    try {
        const [paymentRows] = await pool.query(`
            SELECT p.*, 
                   c.nombre AS customer_name, c.correo AS customer_email,
                   b.nombre AS branch_name, b.logo_url AS branch_logo_url, b.company_id,
                   comp.razon_social AS company_name, comp.logo_url AS company_logo_url, comp.nit AS company_nit,
                   COALESCE(cat.description, h.tipo_documento) as documento_tipo,
                   COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento_aplicado
            FROM customer_payments p
            JOIN customers c ON p.customer_id = c.id
            JOIN branches b ON p.branch_id = b.id
            JOIN companies comp ON b.company_id = comp.id
            LEFT JOIN sales_headers h ON p.sale_id = h.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE p.id = ?
        `, [paymentId]);

        if (paymentRows.length === 0) throw new Error('No se encontró el registro del abono indicado.');
        const payment = paymentRows[0];

        if (!payment.customer_email) {
            throw new Error('El cliente no tiene un correo electrónico configurado.');
        }

        const smtp = await getSMTPSettings(payment.branch_id, payment.company_id);
        const pdfBuffer = await generatePaymentReceiptPDF(payment);
        const transporter = createTransporter(smtp);

        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: payment.customer_email,
            subject: `Comprobante de Abono - ${payment.company_name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px; max-width: 600px; margin: auto;">
                    <h2 style="color: #4f46e5; text-align: center;">Confirmación de Abono</h2>
                    <p>Hola <b>${payment.customer_name}</b>,</p>
                    <p>Le notificamos que hemos registrado satisfactoriamente su abono.</p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                         <table style="width: 100%; font-size: 14px;">
                            <tr><td style="color: #64748b; padding-bottom: 5px;">Monto:</td><td style="font-weight: bold; text-align: right;">$${parseFloat(payment.monto).toFixed(2)}</td></tr>
                            <tr><td style="color: #64748b; padding-bottom: 5px;">Método:</td><td style="font-weight: bold; text-align: right;">${payment.metodo_pago}</td></tr>
                            <tr><td style="color: #64748b;">Fecha:</td><td style="font-weight: bold; text-align: right;">${new Date(payment.fecha_pago).toLocaleDateString('es-SV')}</td></tr>
                         </table>
                    </div>
                    <p style="font-size: 13px; color: #666; text-align: center;">Adjuntamos su comprobante en PDF.</p>
                </div>
            `,
            attachments: [{ filename: `Abono_${String(paymentId).padStart(6, '0')}.pdf`, content: pdfBuffer }]
        });
    } catch (error) {
        console.error(`[Mailer] Error in sendPaymentReceiptEmail for payment ${paymentId}:`, error);
        throw error;
    }
};

/**
 * Sends a provider payment receipt email
 */
const sendProviderPaymentReceiptEmail = async (paymentId) => {
    console.log(`[Mailer] Iniciando proceso de envío de recibo PROVIDER para Pago ID: ${paymentId}`);
    try {
        const [paymentRows] = await pool.query(`
            SELECT p.*, 
                   prov.nombre AS proveedor_name, prov.correo AS proveedor_email,
                   b.nombre AS branch_name, b.logo_url AS branch_logo_url, b.company_id,
                   comp.razon_social AS company_name, comp.logo_url AS company_logo_url,
                   h.tipo_documento as documento_tipo,
                   h.numero_documento as documento_aplicado
            FROM provider_payments p
            JOIN providers prov ON p.provider_id = prov.id
            JOIN branches b ON p.branch_id = b.id
            JOIN companies comp ON b.company_id = comp.id
            LEFT JOIN purchase_headers h ON p.purchase_id = h.id
            WHERE p.id = ?
        `, [paymentId]);

        if (paymentRows.length === 0) throw new Error('No se encontró el registro del pago al proveedor.');
        const p = paymentRows[0];
        if (!p.proveedor_email) throw new Error('El proveedor no tiene un correo electrónico registrado.');

        const smtp = await getSMTPSettings(p.branch_id, p.company_id);
        
        // Re-use payment receipt PDF (adjust labels if needed in pdf.service, or provide specifically)
        // For now using general labels.
        const pdfBuffer = await generatePaymentReceiptPDF({
            ...p,
            customer_name: p.proveedor_name, // Map for PDF service compatibility
        });

        const transporter = createTransporter(smtp);
        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: p.proveedor_email,
            subject: `Comprobante de Pago Entregado - ${p.company_name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                    <h2 style="color: #4f46e5; text-align: center;">Comprobante de Pago</h2>
                    <p>Hola <b>${p.proveedor_name}</b>,</p>
                    <p>Le informamos que se ha procesado un pago hacia su cuenta con el siguiente detalle:</p>
                    <div style="background: #fdf2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
                        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                            <li style="margin-bottom: 5px;"><b>Pago ID:</b> PAG-${String(paymentId).padStart(6, '0')}</li>
                            <li style="margin-bottom: 5px;"><b>Monto:</b> $${parseFloat(p.monto).toFixed(2)}</li>
                            <li style="margin-bottom: 5px;"><b>Método:</b> ${p.metodo_pago}</li>
                            <li><b>Referencia:</b> ${p.referencia || 'N/A'}</li>
                        </ul>
                    </div>
                    <p style="font-size: 12px; color: #666; text-align: center;">Gracias por ser nuestro proveedor estratégico.</p>
                </div>
            `,
            attachments: [{ filename: `Pago_Proveedor_${paymentId}.pdf`, content: pdfBuffer }]
        });
    } catch (error) {
        console.error(`[Mailer] Error in sendProviderPaymentReceiptEmail for payment ${paymentId}:`, error);
        throw error;
    }
};

/**
 * Generic mail sender for other reports or manual needs
 */
const sendMail = async ({ branchId, to, subject, text, html, attachments }) => {
    try {
        const smtp = await getSMTPSettings(branchId);
        const transporter = createTransporter(smtp);

        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to, subject, text, html, attachments
        });
    } catch (error) {
        console.error('[Mailer] Generic sendMail error:', error);
        throw error;
    }
};

module.exports = { 
    sendCustomerStatementEmail,
    sendProviderStatementEmail,
    sendPaymentReceiptEmail,
    sendProviderPaymentReceiptEmail,
    sendMail,
    // Aliases or specific reports can be added below
    sendCustomerAgingEmail: async (pdfData, branchId, toEmail) => {
        const smtp = await getSMTPSettings(branchId);
        const pdfBuffer = await generateAgingPDF(pdfData);
        const transporter = createTransporter(smtp);
        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: toEmail,
            subject: `Reporte de Antigüedad de Saldos - ${pdfData.customer_name}`,
            html: `<p>Hola, se adjunta el reporte de antigüedad de saldos para <b>${pdfData.customer_name}</b>.</p>`,
            attachments: [{ filename: `Antigüedad_Saldos_${pdfData.customer_name}.pdf`, content: pdfBuffer }]
        });
    },
    sendProviderAgingEmail: async (providerData, branchId, toEmail) => {
        const smtp = await getSMTPSettings(branchId);
        const pdfBuffer = await generateProviderAgingPDF(providerData);
        const transporter = createTransporter(smtp);
        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: toEmail,
            subject: `Reporte de Antigüedad de Saldos - Proveedor`,
            html: `<p>Hola, se adjunta el reporte de antigüedad de saldos detallando nuestros compromisos.</p>`,
            attachments: [{ filename: `Antigüedad_Saldos_CXP.pdf`, content: pdfBuffer }]
        });
    }
};
