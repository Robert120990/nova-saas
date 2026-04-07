/**
 * DTE Invalidation Service
 */

const pool = require('../../config/db');
const signatureService = require('../services/signature/signatureService');
const { authenticate } = require('../transmission/transmissionService');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const haciendaConfig = require('../config/haciendaConfig');

async function invalidateDTE(payload, companyId, user) {
    const { codigoGeneracion, motivo, descripcion, nombreResponsable, tipDocResponsable, numDocResponsable, nombreSolicita, tipDocSolicita, numDocSolicita } = payload;

    // 1. Get original DTE
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

    // 2. Generate Invalidation JSON
    const now = new Date();
    const fecAnula = now.toISOString().split('T')[0];
    const horAnula = now.toTimeString().split(' ')[0];

    const invalidacionJson = {
        identificacion: {
            version: 2,
            ambiente: dte.ambiente,
            codigoGeneracion: uuidv4().toUpperCase(),
            fecAnula: fecAnula,
            horAnula: horAnula
        },
        emisor: {
            nit: company.nit.replace(/-/g, ''),
            nombre: company.razon_social,
            tipoEstablecimiento: dteJson.emisor.tipoEstablecimiento || '01',
            nomEstablecimiento: company.nombre_comercial || company.razon_social,
            codEstable: dteJson.emisor.codEstable || '001',
            codPuntoVenta: dteJson.emisor.codPuntoVenta || '001',
            telefono: company.telefono || '00000000',
            correo: company.correo || 'emisor@example.com'
        },
        documento: {
            tipoDte: dte.tipo_dte,
            codigoGeneracion: dte.codigo_generacion,
            selloRecibido: dte.sello_recepcion,
            numeroControl: dte.numero_control,
            fecEmi: dteJson.identificacion.fecEmi,
            montoIva: dteJson.resumen.totalIva || 0,
            codigoGeneracionR: null, // As specified in the else check of schema if type is not replacing
            tipoDocumento: dteJson.receptor.tipoDocumento || '36',
            numDocumento: dteJson.receptor.numDocumento || null,
            nombre: dteJson.receptor.nombre
        },
        motivo: {
            tipoAnulacion: parseInt(motivo), // CAT-024: 1 (Error en datos), 2 (Anulación por falta de pago), etc.
            motivoAnulacion: descripcion,
            nombreResponsable,
            tipDocResponsable,
            numDocResponsable,
            nombreSolicita,
            tipDocSolicita,
            numDocSolicita
        }
    };

    // 3. Sign Invalidation
    const signResult = await signatureService.signDTE(
        invalidacionJson, 
        {
            certificatePath: company.certificate_path,
            certificatePassword: company.certificate_password,
            nit: company.nit
        }
    );

    if (!signResult.success) {
        throw new Error(`Error al firmar invalidación: ${signResult.message}`);
    }

    // 4. Send to Hacienda
    const auth = await authenticate(company.api_user, company.api_password);
    if (!auth.success) {
        throw new Error(`Error de autenticación: ${auth.message}`);
    }

    const invalidationUrl = haciendaConfig.endpoints.invalidation;
    
    try {
        const response = await axios.post(invalidationUrl, {
            ambiente: dte.ambiente,
            idEnvio: 1,
            version: 2,
            documento: signResult.jws
        }, {
            headers: {
                'Authorization': auth.token,
                'Content-Type': 'application/json'
            }
        });

        const status = response.data.estado; // "PROCESADO" if accepted

        // 5. Save Invalidation
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
                now
            ]
        );

        if (status === 'PROCESADO') {
            await pool.query('UPDATE dtes SET status = "INVALIDADO" WHERE id = ?', [dte.id]);
            await pool.query('INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "INVALIDATED", ?)', [dte.id, `Invalidado: ${descripcion}`]);
        }

        return {
            success: true,
            status: status,
            data: response.data
        };

    } catch (error) {
        console.error('Invalidation MH Error:', error.response ? error.response.data : error.message);
        
        await pool.query(
            'INSERT INTO dte_invalidations (codigo_generacion_dte, tipo_documento, motivo, descripcion, estado, json_enviado, json_firmado, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                dte.codigo_generacion,
                dte.tipo_dte,
                motivo,
                descripcion,
                'ERROR',
                JSON.stringify(invalidacionJson),
                signResult.jws,
                error.message
            ]
        );

        throw new Error(`Error de transmisión con Hacienda: ${error.message}`);
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
