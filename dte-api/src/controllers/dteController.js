/**
 * DTE Controller
 */

const dteGenerator = require('../services/dteGenerator');
const schemaValidator = require('../validators/schemaValidator');
const signatureService = require('../services/signature/signatureService');
const transmissionService = require('../transmission/transmissionService');
const { getSchemaVersion } = require('../utils/versionMap');
const { getMHAmbiente } = require('../config/haciendaConfig');
const queue = require('../queue/transmissionQueue');
const pool = require('../../config/db');

function isNetworkError(errOrMsg) {
    if (!errOrMsg) return false;
    const str = typeof errOrMsg === 'string' ? errOrMsg : JSON.stringify(errOrMsg);
    const networkPatterns = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ECONNABORTED',
        'ENOTFOUND',
        'EAI_AGAIN',
        '502',
        '503',
        '504',
        'timeout',
        'Error de conexión con MH',
        'Network Error',
        'socket hang up'
    ];
    return networkPatterns.some(pattern => str.includes(pattern));
}

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
        const [company] = await pool.query('SELECT nit, api_user, api_password, certificate_path, certificate_password, ambiente FROM companies WHERE id = ?', [req.company_id]);
        const [branchEnv] = await pool.query('SELECT ambiente FROM branches WHERE id = ? AND company_id = ?', [req.branch_id, req.company_id]);
        const ambiente = (branchEnv.length > 0 && branchEnv[0].ambiente) || company[0].ambiente;
        console.log(`[DTE-EMIT-DEBUG] Company ${req.company_id} — ambiente DB: "${ambiente}"`);
        const certPass = bodyPassword || company[0].certificate_password;
        const signatureMode = process.env.SIGNATURE_MODE || 'internal';

        if (signatureMode === 'internal' && !company[0].certificate_path) {
            throw new Error('Certificado no configurado para la empresa (Modo Interno)');
        }

        // 3. Sign Document
        const signResult = await signatureService.signDTE(dte, {
            certificatePath: company[0].certificate_path,
            certificatePassword: certPass,
            nit: company[0].nit,
            ambiente: ambiente
        });

        if (!signResult.success) {
            throw new Error(`Falla en firma: ${signResult.message}`);
        }

        let jwsString = typeof signResult.jws === 'string' ? signResult.jws : signResult.jws?.body || JSON.stringify(signResult.jws);
        jwsString = jwsString.replace(/^"|"$/g, '').trim();

        // 4. MODO CONTINGENCIA ACTIVO (Período previamente abierto) -> Diferir transmisión síncrona
        if (dte.identificacion.tipoOperacion === 2) {
            console.log(`[ContingencyEmit] Empresa ${req.company_id} en modo contingencia activo. Registrando DTE ${codigoGeneracion} para retransmisión posterior...`);

            await pool.query(
                'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, json_firmado, sello_recepcion, fh_procesamiento, respuesta_hacienda) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    venta_id || null,
                    codigoGeneracion,
                    numeroControl,
                    tipoDte,
                    req.company_id,
                    req.branch_id,
                    req.user ? req.user.id : 0,
                    'CONTINGENCIA_PENDIENTE',
                    dte.identificacion.ambiente,
                    JSON.stringify(dte),
                    jwsString,
                    null,
                    null,
                    'EMITIDO_EN_CONTINGENCIA'
                ]
            );

            await pool.query(
                'INSERT INTO dte_contingency_documents (codigo_generacion, tipo_documento, json_dte, json_firmado, estado_envio, fecha_generacion) VALUES (?, ?, ?, ?, ?, NOW()) ' +
                'ON DUPLICATE KEY UPDATE json_firmado = VALUES(json_firmado), estado_envio = "PENDING"',
                [codigoGeneracion, tipoDte, JSON.stringify(dte), jwsString, 'PENDING']
            );

            return res.status(200).json({
                success: true,
                venta_id: venta_id || null,
                codigoGeneracion,
                numeroControl,
                estadoHacienda: 'CONTINGENCIA',
                contingency: true,
                data: {
                    selloRecibido: null,
                    estado: 'CONTINGENCIA',
                    mensaje: 'Documento emitido y firmado en contingencia.'
                }
            });
        }

        // 5. FLUJO NORMAL: Política de reintentos y transmisión síncrona a Hacienda (Normativa MH Secc. 3.3)
        let isConnectivityFailure = false;
        let connectivityMessage = '';
        let txResult = null;
        let auth = null;

        const MAX_ATTEMPTS = 3; // 1 intento inicial + hasta 2 reintentos normativos

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            console.log(`[Transmission] Intento ${attempt}/${MAX_ATTEMPTS} para DTE ${codigoGeneracion} (Empresa: ${req.company_id})...`);

            // Autenticación con Hacienda si aún no tenemos token
            if (!auth || !auth.success) {
                console.log(`[HaciendaAuth] Authentication request for company ${company[0].nit}...`);
                auth = await transmissionService.authenticate(company[0].api_user, company[0].api_password, ambiente);
                if (!auth.success) {
                    if (isNetworkError(auth.message)) {
                        isConnectivityFailure = true;
                        connectivityMessage = auth.message;
                        console.warn(`[HaciendaAuth] Falla de red en autenticación (Intento ${attempt}/${MAX_ATTEMPTS}): ${connectivityMessage}`);
                        if (attempt < MAX_ATTEMPTS) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        break;
                    } else {
                        throw new Error(`Error MH Auth: ${auth.message}`);
                    }
                }
            }

            // En los reintentos (intento > 1), consultar estado primero ante MH para evitar duplicidad de correlativos
            if (attempt > 1 && auth.success) {
                console.log(`[Transmission] Consultando estado previo en MH antes de reintentar DTE ${codigoGeneracion}...`);
                const consultResult = await transmissionService.consultDTE(auth.token, {
                    nitEmisor: company[0].nit,
                    tipoDte: tipoDte,
                    codigoGeneracion: codigoGeneracion
                }, ambiente);

                if (consultResult.success && consultResult.processed) {
                    console.log(`[Transmission] ✅ DTE ${codigoGeneracion} ya había sido procesado exitosamente por MH.`);
                    txResult = consultResult;
                    isConnectivityFailure = false;
                    break;
                }
            }

            // Transmisión a Hacienda
            console.log(`[Transmission] Enviando DTE a MH (Intento ${attempt}/${MAX_ATTEMPTS}): ${jwsString.substring(0, 50)}...`);
            txResult = await transmissionService.transmitDTE(auth.token, jwsString, {
                ambiente: getMHAmbiente(ambiente),
                tipoDte: tipoDte,
                codigoGeneracion: codigoGeneracion,
                version: getSchemaVersion(tipoDte)
            });

            // Si la transmisión fue aceptada o rechazada por validación tributaria (no por fallo de red)
            if (txResult.success || !isNetworkError(txResult.error)) {
                isConnectivityFailure = false;
                break;
            }

            // Si fue error de conectividad/timeout
            isConnectivityFailure = true;
            connectivityMessage = typeof txResult.error === 'string' ? txResult.error : JSON.stringify(txResult.error);
            console.warn(`[Transmission] Fallo de conectividad con MH (Intento ${attempt}/${MAX_ATTEMPTS}): ${connectivityMessage}`);

            if (attempt < MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Verificación defensiva final si agotó los intentos con falla de red pero MH pudo haberlo procesado
        if (isConnectivityFailure && auth && auth.success) {
            try {
                console.log(`[Transmission] Verificación final de estado en MH antes de contingencia para DTE ${codigoGeneracion}...`);
                const finalConsult = await transmissionService.consultDTE(auth.token, {
                    nitEmisor: company[0].nit,
                    tipoDte: tipoDte,
                    codigoGeneracion: codigoGeneracion
                }, ambiente);

                if (finalConsult.success && finalConsult.processed) {
                    console.log(`[Transmission] ✅ DTE ${codigoGeneracion} confirmado recibido por MH en verificación final.`);
                    txResult = finalConsult;
                    isConnectivityFailure = false;
                }
            } catch (e) {
                console.warn(`[Transmission] Error en consulta final: ${e.message}`);
            }
        }

        // 6. CIRCUITO DE CONTINGENCIA AUTOMÁTICA ANTE CAÍDA DE HACIENDA / RED
        if (isConnectivityFailure) {
            console.warn(`[AutoContingency] Falla de red con Hacienda detectada (${connectivityMessage}). Activando contingencia automática para empresa ${req.company_id}...`);

            // Abrir período de contingencia automático si no hay uno abierto
            const [openPeriods] = await pool.query(
                'SELECT id FROM dte_contingencies WHERE company_id = ? AND estado = "OPEN" LIMIT 1',
                [req.company_id]
            );
            if (openPeriods.length === 0) {
                await pool.query(
                    'INSERT INTO dte_contingencies (company_id, branch_id, fecha_inicio, motivo, tipo_contingencia, estado) VALUES (?, ?, NOW(), ?, 1, "OPEN")',
                    [req.company_id, req.branch_id || null, 'No disponibilidad del sistema de Hacienda (activación automática)']
                );
            }

            // Actualizar DTE a contingencia (tipoOperacion: 2, tipoModelo: 2)
            dte.identificacion.tipoOperacion = 2;
            dte.identificacion.tipoModelo = 2;
            dte.identificacion.tipoContingencia = 1;
            dte.identificacion.motivoContin = 'No disponibilidad de sistema del Ministerio de Hacienda';

            // Refirmar con tipoOperacion 2
            const reSignResult = await signatureService.signDTE(dte, {
                certificatePath: company[0].certificate_path,
                certificatePassword: certPass,
                nit: company[0].nit,
                ambiente: ambiente
            });
            if (reSignResult.success) {
                jwsString = typeof reSignResult.jws === 'string' ? reSignResult.jws : reSignResult.jws?.body || JSON.stringify(reSignResult.jws);
                jwsString = jwsString.replace(/^"|"$/g, '').trim();
            }

            await pool.query(
                'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, json_firmado, sello_recepcion, fh_procesamiento, respuesta_hacienda) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    venta_id || null,
                    codigoGeneracion,
                    numeroControl,
                    tipoDte,
                    req.company_id,
                    req.branch_id,
                    req.user ? req.user.id : 0,
                    'CONTINGENCIA_PENDIENTE',
                    dte.identificacion.ambiente,
                    JSON.stringify(dte),
                    jwsString,
                    null,
                    null,
                    `CONTINGENCIA_AUTOMATICA: ${connectivityMessage}`.substring(0, 500)
                ]
            );

            await pool.query(
                'INSERT INTO dte_contingency_documents (codigo_generacion, tipo_documento, json_dte, json_firmado, estado_envio, fecha_generacion) VALUES (?, ?, ?, ?, ?, NOW()) ' +
                'ON DUPLICATE KEY UPDATE json_firmado = VALUES(json_firmado), estado_envio = "PENDING"',
                [codigoGeneracion, tipoDte, JSON.stringify(dte), jwsString, 'PENDING']
            );

            return res.status(200).json({
                success: true,
                venta_id: venta_id || null,
                codigoGeneracion,
                numeroControl,
                estadoHacienda: 'CONTINGENCIA',
                contingency: true,
                data: {
                    selloRecibido: null,
                    estado: 'CONTINGENCIA',
                    mensaje: 'Hacienda no disponible. Documento resguardado en contingencia automática.'
                }
            });
        }

        // 7. RESPUESTA NORMAL DE HACIENDA (PROCESADO o RECHAZADO TRIBUTARIO)
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
            'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, json_firmado, sello_recepcion, fh_procesamiento, respuesta_hacienda) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                venta_id || null,
                codigoGeneracion,
                numeroControl,
                tipoDte,
                req.company_id,
                req.branch_id,
                req.user ? req.user.id : 0,
                dbStatus,
                dte.identificacion.ambiente,
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
            'INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                ventaId,
                dte.identificacion.codigoGeneracion,
                dte.identificacion.numeroControl,
                dte.identificacion.tipoDte,
                req.company_id,
                req.branch_id,
                req.user ? req.user.id : 0,
                'PENDING',
                dte.identificacion.ambiente,
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
        const [company] = await pool.query('SELECT nit, certificate_path, certificate_password, ambiente FROM companies WHERE id = ?', [req.company_id]);
        const [branchEnv] = await pool.query('SELECT ambiente FROM branches WHERE id = ? AND company_id = ?', [dte.branch_id, req.company_id]);
        const ambiente = (branchEnv.length > 0 && branchEnv[0].ambiente) || company[0].ambiente;
        
        const certPath = company[0].certificate_path;
        const certPass = bodyPassword || company[0].certificate_password;

        if (!certPath) {
            return res.status(400).json({ success: false, message: 'Ruta de certificado no configurada para la empresa' });
        }

        // 2. Call unified signature service
        const signResult = await signatureService.signDTE(dte.json_original, {
            certificatePath: certPath,
            certificatePassword: certPass,
            nit: company[0].nit,
            ambiente: ambiente
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
