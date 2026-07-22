/**
 * DTE Invalidation Service
 * Normativa MH El Salvador v2.0 - Schema invalidacion-schema-v3.json
 */

const pool = require('../../config/db');
const signatureService = require('../services/signature/signatureService');
const { authenticate } = require('../transmission/transmissionService');
const { validateDTE } = require('../validators/schemaValidator');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getEndpoint } = require('../config/haciendaConfig');

async function invalidateDTE(payload, companyId, user) {
    const {
        codigoGeneracion,
        motivo,
        descripcion,
        nombreResponsable,
        tipDocResponsable,
        numDocResponsable,
        nombreSolicita,
        tipDocSolicita,
        numDocSolicita,
        codigoGeneracionR
    } = payload;

    // 1. Obtener el DTE original
    const [dteRows] = await pool.query(
        'SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?',
        [codigoGeneracion, companyId]
    );

    if (dteRows.length === 0) {
        throw new Error('DTE no encontrado');
    }

    const dte = dteRows[0];
    if (dte.status === 'INVALIDADO') {
        throw new Error('El DTE ya se encuentra invalidado');
    }

    if (dte.status !== 'ACCEPTED') {
        throw new Error('Solo se pueden invalidar documentos aceptados por Hacienda');
    }

    const dteJson = dte.json_original;
    const [companyRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const company = companyRows[0];
    const [branchRows] = await pool.query('SELECT codigo, codigo_mh FROM branches WHERE id = ? AND company_id = ?', [dte.branch_id, companyId]);
    const branch = branchRows.length > 0 ? branchRows[0] : { codigo: '1', codigo_mh: null };
    const [posRows] = await pool.query('SELECT codigo FROM points_of_sale WHERE id = ?', [dte.pos_id]);
    const pos = posRows.length > 0 ? posRows[0] : { codigo: null };

    // 2. Generar JSON de Invalidación (hora actual en zona de El Salvador UTC-6)
    const localNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/El_Salvador" }));
    const fecEmi = localNow.toISOString().split('T')[0];
    const horEmi = localNow.toTimeString().split(' ')[0]; // HH:MM:SS

    const emisorOrig = dteJson?.emisor || {};
    const receptor = dteJson?.receptor || {};

    // Usar los códigos EXACTAMENTE como figuran en el DTE original firmado.
    // Hacienda valida que coincidan con los del documento a invalidar.
    // Solo se usa fallback a branch/pos si el DTE original no tiene esos datos.
    const codEstableMH = emisorOrig.codEstableMH
        || (branch.codigo_mh ? String(branch.codigo_mh).padStart(4, '0').substring(0, 4) : null)
        || (branch.codigo ? String(branch.codigo).padStart(4, '0').substring(0, 4) : '0001');

    const codEstable = emisorOrig.codEstable
        || (branch.codigo ? String(branch.codigo).substring(0, 10) : null);

    const codPuntoVentaMH = emisorOrig.codPuntoVentaMH
        || (pos.codigo ? String(pos.codigo).padStart(4, '0').substring(0, 4) : null)
        || '0001';

    const codPuntoVenta = emisorOrig.codPuntoVenta
        || (pos.codigo ? String(pos.codigo).substring(0, 15) : null);

    // Datos del receptor — permitir null cuando sea consumidor final sin identificación
    const receptorTipoDoc = receptor.tipoDocumento !== undefined ? receptor.tipoDocumento : (receptor.nit ? '36' : null);
    const receptorNumDoc = receptor.numDocumento !== undefined
        ? (receptor.numDocumento || null)
        : (receptor.nit || null);
    const receptorNombre = receptor.nombre ? String(receptor.nombre).substring(0, 250) : null;

    // telefono receptor: minLength 8 si no es null
    let receptorTelefono = receptor.telefono || null;
    if (receptorTelefono !== null && String(receptorTelefono).length < 8) {
        receptorTelefono = null; // descartar si no cumple minLength:8
    }

    // codigoGeneracionR: null si no se proporciona o si es tipo 2 o 3 de anulación
    const tipoAnulacion = parseInt(motivo, 10); // CAT-024: 1, 2, 3
    const codigoGeneracionRFinal = (tipoAnulacion === 1 && codigoGeneracionR) ? codigoGeneracionR : null;

    // Responsable y solicitante — minLength:1 requerido por el schema
    const safeNombreResponsable = (nombreResponsable ? String(nombreResponsable).substring(0, 100) : '') || (user?.nombre ? String(user.nombre).substring(0, 100) : 'RESPONSABLE');
    const safeNumDocResponsable = (numDocResponsable ? String(numDocResponsable).substring(0, 20) : '') || '00000000-0';
    const safeNombreSolicita = (nombreSolicita ? String(nombreSolicita).substring(0, 100) : '') || 'SOLICITANTE';
    const safeNumDocSolicita = (numDocSolicita ? String(numDocSolicita).substring(0, 20) : '') || '00000000-0';
    const safeTipDocResponsable = String(tipDocResponsable || '36');
    const safeTipDocSolicita = String(tipDocSolicita || '36');

    const invalidacionJson = {
        identificacion: {
            version: 3,
            ambiente: dte.ambiente,
            codigoGeneracion: uuidv4().toUpperCase(),
            fecEmi: fecEmi,
            horEmi: horEmi,
            fusion: null
        },
        emisor: {
            nit: company.nit.replace(/-/g, ''),
            nombre: String(company.razon_social).substring(0, 250),
            codEstableMH: codEstableMH,
            codEstable: codEstable,
            codPuntoVentaMH: codPuntoVentaMH,
            codPuntoVenta: codPuntoVenta,
            telefono: String(company.telefono || '00000000').substring(0, 30),
            correo: String(company.correo || 'emisor@example.com').substring(0, 100)
        },
        documento: {
            tipoDte: dte.tipo_dte,
            codigoGeneracion: dte.codigo_generacion,
            selloRecibido: dte.sello_recepcion,
            numeroControl: dte.numero_control,
            fecEmi: dteJson.identificacion.fecEmi,
            codigoGeneracionR: codigoGeneracionRFinal,
            tipoDocumento: receptorTipoDoc,
            numDocumento: receptorNumDoc,
            nombre: receptorNombre,
            telefono: receptorTelefono,
            correo: receptor.correo ? String(receptor.correo).substring(0, 100) : null
        },
        motivo: {
            tipoAnulacion: tipoAnulacion,
            motivoAnulacion: descripcion ? String(descripcion).substring(0, 200) : null,
            nombreResponsable: safeNombreResponsable,
            tipDocResponsable: safeTipDocResponsable,
            numDocResponsable: safeNumDocResponsable,
            nombreSolicita: safeNombreSolicita,
            tipDocSolicita: safeTipDocSolicita,
            numDocSolicita: safeNumDocSolicita
        }
    };

    // 2.1 Validar JSON contra el esquema local antes de firmar
    const schemaValidation = validateDTE('16', invalidacionJson);
    if (!schemaValidation.success) {
        const errorMsgs = schemaValidation.errors
            ? schemaValidation.errors.map(e => e.message).join('; ')
            : 'Error en estructura JSON de invalidación';
        throw new Error(`Validación de esquema de invalidación fallida: ${errorMsgs}`);
    }

    // 3. Firmar la Invalidación
    const signResult = await signatureService.signDTE(
        invalidacionJson,
        {
            certificatePath: company.certificate_path,
            certificatePassword: company.certificate_password,
            nit: company.nit,
            ambiente: company.ambiente
        }
    );

    if (!signResult.success) {
        throw new Error(`Error al firmar invalidación: ${signResult.message}`);
    }

    // 4. Enviar a Hacienda
    const auth = await authenticate(company.api_user, company.api_password, company.ambiente);
    if (!auth.success) {
        throw new Error(`Error de autenticación: ${auth.message}`);
    }

    const invalidationUrl = getEndpoint('invalidacion', dte.ambiente);

    try {
        const response = await axios.post(invalidationUrl, {
            ambiente: dte.ambiente,
            idEnvio: Math.floor(Date.now() / 1000),
            version: 3,
            tipoDte: dte.tipo_dte,
            documento: signResult.jws
        }, {
            headers: {
                'Authorization': auth.token,
                'Content-Type': 'application/json'
            }
        });

        const status = response.data.estado; // "PROCESADO" si es aceptado

        // 5. Guardar evento de invalidación
        await pool.query(
            'INSERT INTO dte_invalidations (codigo_generacion_dte, tipo_documento, motivo, descripcion, estado, json_enviado, json_firmado, respuesta_hacienda, fecha_envio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                dte.codigo_generacion,
                dte.tipo_dte,
                motivo,
                descripcion,
                status === 'PROCESADO' ? 'ACCEPTED' : 'REJECTED',
                JSON.stringify(invalidacionJson),
                signResult.jws,
                JSON.stringify(response.data),
                localNow
            ]
        );

        if (status === 'PROCESADO') {
            await pool.query('UPDATE dtes SET status = "INVALIDADO" WHERE id = ?', [dte.id]);
            await pool.query(
                'INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "INVALIDATED", ?)',
                [dte.id, `Invalidado: ${descripcion}`]
            );
        }

        return {
            success: true,
            status: status,
            data: response.data
        };

    } catch (error) {
        const mhErrorData = error.response ? error.response.data : { message: error.message };
        console.error('Invalidation MH Error:', mhErrorData);

        try {
            await pool.query(
                'INSERT INTO dte_invalidations (codigo_generacion_dte, tipo_documento, motivo, descripcion, estado, json_enviado, json_firmado, respuesta_hacienda, fecha_envio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    dte.codigo_generacion,
                    dte.tipo_dte,
                    motivo,
                    descripcion,
                    'ERROR',
                    JSON.stringify(invalidacionJson),
                    signResult.jws,
                    JSON.stringify(mhErrorData),
                    localNow
                ]
            );
        } catch (dbErr) {
            console.error('Error al guardar registro de error de invalidación:', dbErr.message);
        }

        const detail = mhErrorData.descripcionMsg || mhErrorData.error || mhErrorData.message || error.message;
        throw new Error(`Error de transmisión con Hacienda: ${detail}`);
    }
}

async function getInvalidationStatus(codigoGeneracion, companyId) {
    const [rows] = await pool.query(
        'SELECT * FROM dte_invalidations WHERE codigo_generacion_dte = ? ORDER BY created_at DESC LIMIT 1',
        [codigoGeneracion]
    );

    if (rows.length === 0) {
        return { success: false, message: 'No hay eventos de invalidación para este DTE' };
    }

    return {
        success: true,
        data: rows[0]
    };
}

module.exports = { invalidateDTE, getInvalidationStatus };
