/**
 * DTE Contingency Service
 */

const pool = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../transmission/transmissionService');
const axios = require('axios');
const haciendaConfig = require('../config/haciendaConfig');

async function startContingency(payload) {
    const { motivo, tipoContingencia, companyId, branchId } = payload;
    const now = new Date();

    const [result] = await pool.query(
        'INSERT INTO dte_contingencies (company_id, branch_id, fecha_inicio, motivo, tipo_contingencia, estado) VALUES (?, ?, ?, ?, ?, ?)',
        [companyId, branchId || null, now, motivo, tipoContingencia || 1, 'OPEN']
    );

    return {
        success: true,
        contingencyId: result.insertId,
        message: 'Modo contingencia activado'
    };
}

async function stopContingency(contingencyId) {
    const now = new Date();

    await pool.query(
        'UPDATE dte_contingencies SET fecha_fin = ?, estado = ? WHERE id = ?',
        [now, 'CLOSED', contingencyId]
    );

    return {
        success: true,
        contingencyId,
        message: 'Modo contingencia desactivado. Iniciando reenvío de documentos.'
    };
}

async function addToContingencyQueue(payload) {
    const { codigoGeneracion, tipoDocumento, jsonDte, jsonFirmado } = payload;
    const now = new Date();

    await pool.query(
        'INSERT INTO dte_contingency_documents (codigo_generacion, tipo_documento, json_dte, json_firmado, estado_envio, fecha_generacion) VALUES (?, ?, ?, ?, ?, ?)',
        [codigoGeneracion, tipoDocumento, JSON.stringify(jsonDte), jsonFirmado, 'PENDING', now]
    );

    await pool.query(
        'UPDATE dtes SET status = "CONTINGENCIA_PENDIENTE" WHERE codigo_generacion = ?',
        [codigoGeneracion]
    );

    return { success: true };
}

async function getActiveContingency(companyId) {
    const [rows] = await pool.query(
        'SELECT * FROM dte_contingencies WHERE company_id = ? AND estado = ? ORDER BY created_at DESC LIMIT 1',
        [companyId, 'OPEN']
    );
    return rows.length > 0 ? rows[0] : null;
}

async function sendContingencyReport(contingencyId) {
    const [contingencyRows] = await pool.query(
        'SELECT c.*, comp.nit, comp.razon_social, comp.correo, comp.telefono, ' +
        'b.tipo_establecimiento, b.codigo_mh, b.codigo as punto_venta_codigo ' +
        'FROM dte_contingencies c ' +
        'LEFT JOIN companies comp ON c.company_id = comp.id ' +
        'LEFT JOIN branches b ON c.branch_id = b.id ' +
        'WHERE c.id = ?',
        [contingencyId]
    );

    if (contingencyRows.length === 0) return { success: false, message: 'Contingencia no encontrada' };
    const con = contingencyRows[0];

    const [docs] = await pool.query(
        'SELECT codigo_generacion, tipo_documento FROM dte_contingency_documents WHERE estado_envio = ?',
        ['PENDING']
    );

    const inicio = new Date(con.fecha_inicio);
    const fin = new Date();

    const report = {
        identificacion: {
            version: 3,
            ambiente: con.ambiente || '00',
            codigoGeneracion: uuidv4().toUpperCase(),
            fTransmision: fin.toISOString().split('T')[0],
            hTransmision: fin.toTimeString().split(' ')[0]
        },
        emisor: {
            nit: con.nit || '00000000000000',
            nombre: con.razon_social || 'Emisor',
            nombreResponsable: 'Responsable',
            tipoDocResponsable: '36',
            numeroDocResponsable: con.nit || '00000000000000',
            tipoEstablecimiento: con.tipo_establecimiento || '02',
            codEstableMH: con.codigo_mh || null,
            codPuntoVenta: con.punto_venta_codigo || '0001',
            telefono: con.telefono || '00000000',
            correo: con.correo || 'emisor@example.com'
        },
        detalleDTE: docs.map((doc, i) => ({
            noItem: i + 1,
            codigoGeneracion: doc.codigo_generacion,
            tipoDoc: doc.tipo_documento
        })),
        motivo: {
            fInicio: inicio.toISOString().split('T')[0],
            fFin: fin.toISOString().split('T')[0],
            hInicio: inicio.toTimeString().split(' ')[0],
            hFin: fin.toTimeString().split(' ')[0],
            tipoContingencia: con.tipo_contingencia || 1,
            motivoContingencia: con.motivo || null
        }
    };

    try {
        const auth = await authenticate(con.api_user, con.api_password);
        if (!auth.success) return { success: false, message: 'Error de autenticación MH' };

        const url = haciendaConfig.contingency;
        const response = await axios.post(url, report, {
            headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        });

        return {
            success: true,
            reportCodigoGeneracion: report.identificacion.codigoGeneracion,
            haciendaResponse: response.data
        };
    } catch (error) {
        console.error('[ContingencyReport] Error enviando reporte:', error.message);
        return { success: false, message: error.message };
    }
}

async function getContingencyStatus(companyId) {
    const [rows] = await pool.query(
        'SELECT * FROM dte_contingencies WHERE company_id = ? ORDER BY created_at DESC LIMIT 10',
        [companyId]
    );

    const [pendingCount] = await pool.query(
        'SELECT COUNT(*) as count FROM dte_contingency_documents WHERE estado_envio = ?',
        ['PENDING']
    );
    const [sentCount] = await pool.query(
        'SELECT COUNT(*) as count FROM dte_contingency_documents WHERE estado_envio = ?',
        ['SENT']
    );

    return {
        success: true,
        history: rows,
        pendingDocs: pendingCount[0].count,
        sentDocs: sentCount[0].count
    };
}

module.exports = {
    startContingency,
    stopContingency,
    addToContingencyQueue,
    getActiveContingency,
    sendContingencyReport,
    getContingencyStatus
};
