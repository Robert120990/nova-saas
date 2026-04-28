/**
 * DTE Controller
 */

const dteGenerator = require('../services/dteGenerator');
const schemaValidator = require('../validators/schemaValidator');
const signatureService = require('../services/signature/signatureService');
const transmissionService = require('../transmission/transmissionService');
const queue = require('../queue/transmissionQueue');
const pool = require('../../config/db');

async function emit(req, res) {
    try {
        const { venta_id, dte: dteInput, password: bodyPassword } = req.body;
        
        // SECURITY: Reject tenant-level fields in the body to prevent manipulation
        if (req.body.company_id || req.body.companyId || req.body.branch_id || req.body.branchId || req.body.usuario_id || req.body.userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'No está permitido enviar IDs de empresa, sucursal o usuario en el cuerpo de la solicitud. Estos se obtienen de su token de autenticación.' 
            });
        }

        // 1. Generate DTE using strictly authenticated context
        const payload = {
            ...req.body,
            companyId: req.company_id,
            branchId: req.branch_id,
            userId: req.user.id
        };
        
        console.log(`[SecurityAudit] Creating DTE for Company: ${req.company_id}, Branch: ${req.branch_id}, User: ${req.user.id}`);
        const dte = await dteGenerator.generateDTE(payload);
        const { codigoGeneracion, numeroControl, tipoDte } = dte.identificacion;

        // 2. Get Company/Branch credentials for signing and transmission
        const [company] = await pool.query('SELECT nit, api_user, api_password, certificate_path, certificate_password FROM companies WHERE id = ?', [req.company_id]);
        const certPass = bodyPassword || company[0].certificate_password;
        const signatureMode = process.env.SIGNATURE_MODE || 'internal';

        if (signatureMode === 'internal' && !company[0].certificate_path) {
            throw new Error('Certificado no configurado para la empresa (Modo Interno)');
        }

        // 3. Sign Document
        const signResult = await signatureService.signDTE(dte, {
            certificatePath: company[0].certificate_path,
            certificatePassword: certPass,
            nit: company[0].nit
        });

        if (!signResult.success) {
            throw new Error(`Falla en firma: ${signResult.message}`);
        }

        // 4. Authenticate with Hacienda
        console.log(`[HaciendaAuth] Authenticaton request for company ${company[0].nit}...`);
        const auth = await transmissionService.authenticate(company[0].api_user, company[0].api_password);
        if (!auth.success) {
            throw new Error(`Error MH Auth: ${auth.message}`);
        }

        // 5. Transmit to Hacienda
        let jwsString = typeof signResult.jws === 'string' ? signResult.jws : signResult.jws?.body || JSON.stringify(signResult.jws);
        
        // Final cleaning: Ensure it's a pure string without extra quotes or spaces if returned as JSON string
        jwsString = jwsString.replace(/^"|"$/g, '').trim();
        
        console.log(`[Transmission] JWS identified (starting with): ${jwsString.substring(0, 50)}...`);

        const txResult = await transmissionService.transmitDTE(auth.token, jwsString, {
            ambiente: company[0].ambiente === 'produccion' ? '01' : '00',
            tipoDte: tipoDte,
            codigoGeneracion: codigoGeneracion,
            version: tipoDte === '01' ? 1 : 3
        });

        // 6. Store in Database
        const dbStatus = txResult.success && txResult.status === 'PROCESADO' ? 'ACCEPTED' : 'REJECTED';
        const haciendaError = txResult.error || txResult.data;

        // Format fhProcesamiento from Hacienda (DD/MM/YYYY HH:MM:SS) to DB format (YYYY-MM-DD HH:MM:SS)
        let formattedDate = txResult.fhProcesamiento || null;
        if (formattedDate && formattedDate.includes('/')) {
            const [datePart, timePart] = formattedDate.split(' ');
            const [day, month, year] = datePart.split('/');
            formattedDate = `${year}-${month}-${day} ${timePart}`;
        }

        await pool.query(
            'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, json_original, json_firmado, sello_recepcion, fh_procesamiento, respuesta_hacienda) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                venta_id || null,
                codigoGeneracion,
                numeroControl,
                tipoDte,
                req.company_id,
                req.branch_id,
                req.user ? req.user.id : 0,
                dbStatus,
                JSON.stringify(dte),
                jwsString,
                txResult.selloRecepcion || null,
                formattedDate,
                haciendaError ? JSON.stringify(haciendaError) : null
            ]
        );

        res.status(200).json({
            success: dbStatus === 'ACCEPTED',
            venta_id: venta_id || null,
            codigoGeneracion,
            numeroControl,
            estadoHacienda: txResult.status || 'REJECTED',
            data: txResult.data || txResult.error
        });

    } catch (error) {
        console.error('Emit Error:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.details || []
        });
    }
}

async function generate(req, res) {
    try {
        // SECURITY: Reject tenant-level fields in the body
        if (req.body.companyId || req.body.branchId || req.body.userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Los parámetros de empresa, sucursal y usuario deben provenir únicamente del token.' 
            });
        }

        const payload = {
            ...req.body,
            companyId: req.company_id,
            branchId: req.branch_id,
            userId: req.user.id
        };
        
        console.log(`[SecurityAudit] Generating DTE for Company: ${req.company_id}, User: ${req.user.id}`);

        const dte = await dteGenerator.generateDTE(payload);

        // 2. Save to DB
        const ventaId = req.body.venta_id || null;
        const [result] = await pool.query(
            'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, json_original) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                ventaId,
                dte.identificacion.codigoGeneracion,
                dte.identificacion.numeroControl,
                dte.identificacion.tipoDte,
                req.company_id,
                req.branch_id,
                req.user ? req.user.id : 0,
                'PENDING',
                JSON.stringify(dte)
            ]
        );

        res.status(201).json({
            success: true,
            codigoGeneracion: dte.identificacion.codigoGeneracion,
            numeroControl: dte.identificacion.numeroControl,
            dte: dte
        });
    } catch (error) {
        console.error('Generate Error:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.details || []
        });
    }
}

async function validate(req, res) {
    const { tipoDte, dte } = req.body;
    try {
        const result = schemaValidator.validateDTE(tipoDte, dte);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function sign(req, res) {
    const { codigoGeneracion, password: bodyPassword } = req.body;
    try {
        // 1. Get DTE from DB
        const [rows] = await pool.query('SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        const dte = rows[0];
        const [company] = await pool.query('SELECT nit, certificate_path, certificate_password FROM companies WHERE id = ?', [req.company_id]);
        
        const certPath = company[0].certificate_path;
        const certPass = bodyPassword || company[0].certificate_password;

        if (!certPath) {
            return res.status(400).json({ success: false, message: 'Ruta de certificado no configurada para la empresa' });
        }

        // 2. Call unified signature service
        const signResult = await signatureService.signDTE(dte.json_original, {
            certificatePath: certPath,
            certificatePassword: certPass,
            nit: company[0].nit
        });

        if (signResult.success) {
            await pool.query('UPDATE dtes SET status = "SIGNED", json_firmado = ? WHERE id = ?', [signResult.jws, dte.id]);
            await pool.query('INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "SIGNED", "Documento firmado digitalmente (interno)")', [dte.id]);
            
            res.json({ success: true, jws: signResult.jws });
        } else {
            res.status(400).json({ success: false, message: signResult.message });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function transmit(req, res) {
    const { codigoGeneracion } = req.body;
    try {
        const [rows] = await pool.query('SELECT id, status FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        if (rows[0].status !== 'SIGNED') {
            return res.status(400).json({ success: false, message: 'El documento debe estar firmado antes de transmitir' });
        }

        await queue.addToQueue(rows[0].id);
        await pool.query('UPDATE dtes SET status = "SENT" WHERE id = ?', [rows[0].id]);

        res.json({ success: true, message: 'Documento en cola para transmisión' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getStatus(req, res) {
    const { codigoGeneracion } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT d.codigo_generacion, d.numero_control, d.status, d.sello_recepcion, d.fh_procesamiento, ' +
            'tq.attempts, tq.last_error ' +
            'FROM dtes d ' +
            'LEFT JOIN transmission_queue tq ON d.id = tq.dte_id ' +
            'WHERE d.codigo_generacion = ? AND d.company_id = ?',
            [codigoGeneracion, req.company_id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getDTE(req, res) {
    const { codigoGeneracion } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function generatePDF(req, res) {
    const { codigoGeneracion } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        const dteData = rows[0].json_original;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=DTE-${codigoGeneracion}.pdf`);

        const pdfService = require('../services/pdfService');
        await pdfService.generateDTEPDF(dteData, res);

    } catch (error) {
        console.error('PDF Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = { emit, generate, validate, sign, transmit, getStatus, getDTE, generatePDF };
