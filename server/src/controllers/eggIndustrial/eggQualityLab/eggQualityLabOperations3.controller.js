const { pool, nodemailer } = require('./shared');

const sendUnifiedCoaEmail = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const {
            customer_email, customer_name, subject, message, log_ids, attachments
        } = req.body;

        if (!customer_email) {
            return res.status(400).json({ message: 'Debe especificar el correo electrónico del cliente.' });
        }

        if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos un lote / análisis de calidad.' });
        }

        // 1. Obtener configuración SMTP
        let smtp = null;
        try {
            const [branchRows] = await pool.query(`
                SELECT s.* FROM smtp_settings s
                JOIN branches b ON s.branch_id = b.id
                WHERE b.company_id = ?
                LIMIT 1
            `, [company_id]);
            if (branchRows.length > 0) smtp = branchRows[0];
            if (!smtp) {
                const [allSmtp] = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
                if (allSmtp.length > 0) smtp = allSmtp[0];
            }
        } catch (e) {
            console.warn('Error buscando configuración SMTP:', e.message);
        }

        if (!smtp) {
            return res.status(400).json({
                message: 'No se encontró configuración SMTP activa para enviar correos. Configure el correo en el panel de sucursales/configuración.'
            });
        }

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port, 10),
            secure: smtp.encryption === 'ssl' || parseInt(smtp.port, 10) === 465,
            auth: {
                user: smtp.user,
                pass: smtp.password
            },
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1'
            }
        });

        // 2. Obtener información de la empresa y de los lotes
        const [[company]] = await pool.query('SELECT razon_social, nombre_comercial, nit, nrc FROM companies WHERE id = ?', [company_id]);
        const companyLegalName = company?.razon_social || 'ANDELSA, S.A. DE C.V.';
        const companyCommercialName = company?.nombre_comercial || 'ANDELSA';

        const [logs] = await pool.query(`
            SELECT l.*, b.batch_code_display, b.product_type, b.batch_uuid, b.started_at
            FROM egg_lab_micro_logs l
            JOIN egg_production_batches b ON l.batch_id = b.id
            WHERE l.id IN (?) AND l.company_id = ?
        `, [log_ids, company_id]);

        if (logs.length === 0) {
            return res.status(404).json({ message: 'No se encontraron los análisis de calidad especificados.' });
        }

        // 3. Procesar adjuntos en base64
        const mailAttachments = [];
        if (attachments && Array.isArray(attachments)) {
            for (const att of attachments) {
                if (att.filename && att.content) {
                    const cleanBase64 = att.content.replace(/^data:application\/pdf;base64,/, '');
                    mailAttachments.push({
                        filename: att.filename,
                        content: Buffer.from(cleanBase64, 'base64'),
                        contentType: 'application/pdf'
                    });
                }
            }
        }

        // Construir tabla HTML de los lotes incluidos en el despacho
        const lotsRowsHtml = logs.map(l => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #0f172a; font-family: monospace;">${l.batch_code_display || l.batch_uuid}</td>
                <td style="padding: 10px 12px; text-transform: uppercase; color: #334155;">${l.product_type}</td>
                <td style="padding: 10px 12px; color: #475569;">${l.presentation || 'Cubeta 30 Lb'}</td>
                <td style="padding: 10px 12px; color: #475569;">${l.sample_date ? new Date(l.sample_date).toLocaleDateString() : 'N/A'}</td>
                <td style="padding: 10px 12px; text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
                        ${l.status || 'APROBADO'}
                    </span>
                </td>
            </tr>
        `).join('');

        const emailSubject = subject || `Certificados de Calidad (COA) - ${companyCommercialName} | ${logs.length} Lote(s) Despachado(s)`;
        const emailBodyHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                <div style="background: #0f172a; padding: 18px 24px; border-radius: 12px; color: #ffffff; margin-bottom: 24px;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">${companyLegalName}</h2>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1;">Departamento de Control de Calidad & Inocuidad Alimentaria | Planta de Ovoproductos</p>
                    <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8;">NRC: ${company?.nrc || '224745-0'} | NIT: ${company?.nit || '0614-070513-102-1'}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="font-size: 14px; color: #1e293b; margin: 0 0 10px;">Estimado(a) <strong>${customer_name || 'Cliente'}</strong>,</p>
                    <p style="font-size: 13px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
                        ${message || 'Adjunto encontrará los Certificados de Análisis de Calidad y Liberación (COA) correspondientes a los lotes despachados a sus instalaciones. Cada certificado avala la conformidad microbiológica y físico-química bajo normativas internacionales FDA, HACCP y Codex Alimentarius.'}
                    </p>
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #4338ca; margin: 0 0 8px; letter-spacing: 0.5px;">
                        Detalle de Lotes Amparados en este Envío (${logs.length} Lotes):
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569; font-size: 11px; text-transform: uppercase;">
                                <th style="padding: 10px 12px;">Lote Juliano</th>
                                <th style="padding: 10px 12px;">Producto</th>
                                <th style="padding: 10px 12px;">Presentación</th>
                                <th style="padding: 10px 12px;">Fecha Análisis</th>
                                <th style="padding: 10px 12px; text-align: center;">Dictamen</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lotsRowsHtml}
                        </tbody>
                    </table>
                </div>

                <div style="background: #f0fdfa; border: 1px solid #5eead4; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #0f766e; font-weight: 600;">
                        ✓ Todos los lotes han sido evaluados y liberados satisfactoriamente para su consumo y procesamiento industrial.
                    </p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #115e59;">
                        Documentos adjuntos: <strong>${mailAttachments.length} archivo(s) PDF individuales</strong> (uno por cada lote para su debido archivo y trazabilidad).
                    </p>
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
                    Este es un mensaje emitido automáticamente por el Sistema de Inocuidad y Calidad de ${companyLegalName}.
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"${companyCommercialName} - Calidad" <${smtp.from_email || smtp.user}>`,
            to: customer_email,
            subject: emailSubject,
            html: emailBodyHtml,
            attachments: mailAttachments
        };

        const info = await transporter.sendMail(mailOptions);

        res.json({
            message: `Correo unificado enviado exitosamente a ${customer_email}`,
            messageId: info.messageId,
            attachmentsCount: mailAttachments.length,
            lotsCount: logs.length
        });
    } catch (error) {
        console.error('Error enviando correo unificado de COA:', error);
        res.status(500).json({ message: error.message || 'Error al enviar el correo electrónico.' });
    }
};

const getSolidsCalculation = async (req, res) => {
    try {
        const { base_egg_solids = 24.2, target_solids = 21.5, batch_weight_lbs = 12000 } = req.query;
        const baseSolids = parseFloat(base_egg_solids);
        const targetSolids = parseFloat(target_solids);
        const batchWeight = parseFloat(batch_weight_lbs);

        // Fórmula matemática de HUEVO ENTERO PLUS (Mario - Calidad ANDELSA):
        const waterPct = ((baseSolids - targetSolids) / baseSolids) * 100;
        const eggBaseLbs = batchWeight * (targetSolids / baseSolids);
        const waterLbs = batchWeight - eggBaseLbs;
        const waterGarrafones = waterLbs / 42.0; // 1 garrafón = 42 lbs
        const citricAcidLbs = batchWeight * 0.001; // 0.1% ácido cítrico

        res.json({
            base_egg_solids: baseSolids,
            target_solids: targetSolids,
            batch_weight_lbs: batchWeight,
            water_percentage: Math.max(0, waterPct),
            egg_base_lbs: eggBaseLbs,
            water_lbs: Math.max(0, waterLbs),
            water_garrafones: Math.max(0, waterGarrafones),
            citric_acid_lbs: citricAcidLbs,
            is_compliant: targetSolids >= 21.0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getReturnableBalances = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT r.*, c.nombre as customer_full_name, c.telefono,
                    COALESCE(r.current_tapaderas, 0) as current_tapaderas,
                    (r.current_balance - COALESCE(r.current_tapaderas, 0)) as missing_tapaderas
             FROM egg_returnable_packaging r
             LEFT JOIN customers c ON r.customer_id = c.id
             WHERE r.company_id = ?
             ORDER BY r.current_balance DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveReturnableCustomer = async (req, res) => {
    try {
        const { id, customer_id, customer_name, packaging_type, initial_balance, initial_tapaderas, notes } = req.body;
        const initCub = parseInt(initial_balance, 10) || 0;
        const initTap = parseInt(initial_tapaderas !== undefined ? initial_tapaderas : initial_balance, 10) || 0;

        if (id) {
            await pool.query(
                `UPDATE egg_returnable_packaging
                 SET customer_id = ?, customer_name = ?, packaging_type = ?, initial_balance = ?, initial_tapaderas = ?, notes = ?
                 WHERE id = ? AND company_id = ?`,
                [customer_id || null, customer_name, packaging_type || 'cubeta_30lb', initCub, initTap, notes || null, id, req.company_id]
            );
            res.json({ message: 'Registro actualizado con éxito.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_returnable_packaging (company_id, customer_id, customer_name, packaging_type, initial_balance, initial_tapaderas, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, customer_id || null, customer_name, packaging_type || 'cubeta_30lb', initCub, initTap, notes || null]
            );
            res.status(201).json({ message: 'Cliente registrado para control de retornables.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { sendUnifiedCoaEmail, getSolidsCalculation, getReturnableBalances, saveReturnableCustomer };
