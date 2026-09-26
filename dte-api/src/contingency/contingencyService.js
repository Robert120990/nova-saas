/**
 * DTE Contingency Service
 */

const pool = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../transmission/transmissionService');
const axios = require('axios');
const { getEndpoint, getMHAmbiente } = require('../config/haciendaConfig');

async function startContingency(payload) {
    const { motivo, tipoContingencia, companyId, branchId } = payload;

    const [result] = await pool.query(
        'INSERT INTO dte_contingencies (company_id, branch_id, fecha_inicio, motivo, tipo_contingencia, estado) VALUES (?, ?, NOW(), ?, ?, ?)',
        [companyId, branchId || null, motivo, tipoContingencia || 1, 'OPEN']
    );

    return {
        success: true,
        contingencyId: result.insertId,
        message: 'Modo contingencia activado'
    };
}

async function stopContingency(contingencyId) {
    await pool.query(
        'UPDATE dte_contingencies SET fecha_fin = NOW(), estado = ? WHERE id = ?',
        ['CLOSED', contingencyId]
    );

    return {
        success: true,
        contingencyId,
        message: 'Modo contingencia desactivado. Iniciando reenvío de documentos.'
    };
}

async function addToContingencyQueue(payload) {
    const { codigoGeneracion, tipoDocumento, jsonDte, jsonFirmado, contingencyId, companyId } = payload;
    const now = new Date();

    let targetContingencyId = contingencyId || null;
    if (!targetContingencyId && companyId) {
        const [openPeriods] = await pool.query(
            'SELECT id FROM dte_contingencies WHERE company_id = ? AND estado = "OPEN" ORDER BY id DESC LIMIT 1',
            [companyId]
        );
        if (openPeriods.length > 0) targetContingencyId = openPeriods[0].id;
    }

    await pool.query(
        'INSERT INTO dte_contingency_documents (contingency_id, codigo_generacion, tipo_documento, json_dte, json_firmado, estado_envio, fecha_generacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [targetContingencyId, codigoGeneracion, tipoDocumento, JSON.stringify(jsonDte), jsonFirmado, 'PENDING', now]
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
        'SELECT c.*, comp.nit, comp.razon_social, comp.correo, comp.telefono, comp.ambiente, ' +
        'comp.api_user, comp.api_password, comp.certificate_path, comp.certificate_password, ' +
        'b.tipo_establecimiento, b.codigo_mh, b.codigo as punto_venta_codigo, b.ambiente AS branch_ambiente ' +
        'FROM dte_contingencies c ' +
        'LEFT JOIN companies comp ON c.company_id = comp.id ' +
        'LEFT JOIN branches b ON c.branch_id = b.id ' +
        'WHERE c.id = ?',
        [contingencyId]
    );

    if (contingencyRows.length === 0) return { success: false, message: 'Contingencia no encontrada' };
    const con = contingencyRows[0];
    const ambiente = con.branch_ambiente || con.ambiente;

    const [docs] = await pool.query(
        'SELECT cd.codigo_generacion, cd.tipo_documento, cd.json_dte ' +
        'FROM dte_contingency_documents cd ' +
        'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
        'WHERE cd.contingency_id = ? ' +
        '  AND cd.estado_envio != "SENT"',
        [contingencyId]
    );

    if (docs.length === 0) {
        console.log(`[ContingencyReport] Período ${contingencyId} sin documentos pendientes (no requiere transmisión de evento a MH)`);
        return {
            success: true,
            message: 'Período cerrado sin documentos emitidos en contingencia (no requiere reporte a Hacienda)'
        };
    }

    // Extraer dinámicamente datos de emisor del primer DTE emitido en contingencia para máxima coherencia con MH
    let firstDteEmisor = null;
    try {
        if (docs[0]?.json_dte) {
            firstDteEmisor = typeof docs[0].json_dte === 'string' ? JSON.parse(docs[0].json_dte)?.emisor : docs[0].json_dte?.emisor;
        }
    } catch (_) {
        firstDteEmisor = null;
    }

    const resolvedCodEstable = firstDteEmisor?.codEstable || con.codigo_mh || null;
    const rawPuntoVenta = firstDteEmisor?.codPuntoVenta || con.punto_venta_codigo || null;
    const resolvedCodPuntoVenta = rawPuntoVenta
        ? (String(rawPuntoVenta).startsWith('P')
            ? String(rawPuntoVenta).padStart(4, '0').substring(0, 4)
            : `P${String(rawPuntoVenta).padStart(3, '0').substring(0, 3)}`)
        : null;

    const rawPhone = firstDteEmisor?.telefono || con.telefono || '22222222';
    const resolvedPhone = String(rawPhone).replace(/[^0-9]/g, '').padEnd(8, '0').substring(0, 30);
    const resolvedEmail = firstDteEmisor?.correo || con.correo || 'facturacion@empresa.com';

    const localNow = new Date();
    const fTransmision = localNow.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
    const hTransmision = localNow.toLocaleTimeString('en-GB', { timeZone: 'America/El_Salvador', hour12: false }).substring(0, 8);

    let inicio = new Date(con.fecha_inicio);
    let fin = con.fecha_fin ? new Date(con.fecha_fin) : localNow;

    // Normativa MH: La ventana [fInicio hInicio - fFin hFin] del evento debe cubrir
    // con total exactitud la fecha y hora de emisión (fecEmi / horEmi) de cada DTE detallado
    for (const doc of docs) {
        try {
            const parsed = typeof doc.json_dte === 'string' ? JSON.parse(doc.json_dte) : doc.json_dte;
            const ident = parsed?.identificacion;
            if (ident?.fecEmi && ident?.horEmi) {
                const docDateTime = new Date(`${ident.fecEmi}T${ident.horEmi}-06:00`);
                if (!isNaN(docDateTime.getTime())) {
                    if (docDateTime < inicio) inicio = new Date(docDateTime.getTime() - 1000); // 1s antes
                    if (docDateTime > fin) fin = new Date(docDateTime.getTime() + 1000); // 1s después
                }
            }
        } catch (_) {}
    }

    const fInicio = inicio.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
    const hInicio = inicio.toLocaleTimeString('en-GB', { timeZone: 'America/El_Salvador', hour12: false }).substring(0, 8);
    const fFin = fin.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
    const hFin = fin.toLocaleTimeString('en-GB', { timeZone: 'America/El_Salvador', hour12: false }).substring(0, 8);

    const cleanNit = (con.nit || '00000000000000').replace(/[^0-9]/g, '');

    const report = {
        identificacion: {
            version: 4,
            ambiente: getMHAmbiente(ambiente),
            codigoGeneracion: uuidv4().toUpperCase(),
            fTransmision: fTransmision,
            hTransmision: hTransmision
        },
        emisor: {
            nit: cleanNit,
            nombre: (con.razon_social || 'EMISOR').substring(0, 250),
            nombreResponsable: (con.razon_social || 'RESPONSABLE').substring(0, 100),
            tipoDocResponsable: '36',
            numeroDocResponsable: cleanNit.substring(0, 25),
            tipoEstablecimiento: con.tipo_establecimiento || '01',
            codEstableMH: resolvedCodEstable ? String(resolvedCodEstable).padStart(4, '0').substring(0, 4) : null,
            codPuntoVentaMH: resolvedCodPuntoVenta,
            telefono: resolvedPhone,
            correo: resolvedEmail.substring(0, 100)
        },
        detalleDTE: docs.map((doc, i) => ({
            noItem: i + 1,
            codigoGeneracion: doc.codigo_generacion,
            tipoDoc: doc.tipo_documento
        })),
        motivo: {
            fInicio: fInicio,
            fFin: fFin,
            hInicio: hInicio,
            hFin: hFin,
            tipoContingencia: con.tipo_contingencia || 1,
            motivoContingencia: (con.motivo || 'Falla de servicios').substring(0, 500)
        }
    };

    try {
        const signatureService = require('../services/signature/signatureService');
        const signResult = await signatureService.signDTE(report, {
            certificatePath: con.certificate_path,
            certificatePassword: con.certificate_password,
            nit: con.nit,
            ambiente: ambiente
        });

        if (!signResult.success) {
            throw new Error(`Falla en firma del reporte de contingencia: ${signResult.message}`);
        }

        const auth = await authenticate(con.api_user, con.api_password, ambiente);
        if (!auth.success) return { success: false, message: `Error de autenticación MH: ${auth.message}` };

        let jwsString = typeof signResult.jws === 'string' ? signResult.jws : signResult.jws?.body || JSON.stringify(signResult.jws);
        jwsString = jwsString.replace(/^"|"$/g, '').trim();

        const contingencyPayload = {
            ambiente: getMHAmbiente(ambiente),
            idEnvio: Math.floor(Date.now() / 1000),
            version: 4,
            nit: cleanNit,
            documento: jwsString
        };

        const url = getEndpoint('contingencia', ambiente);
        const response = await axios.post(url, contingencyPayload, {
            headers: { 'Authorization': auth.token, 'Content-Type': 'application/json' },
            timeout: 15000
        });

        console.log(`[ContingencyReport] ✅ Evento de contingencia ${report.identificacion.codigoGeneracion} transmitido a MH:`, response.data?.estado || 'OK');

        const selloRecepcion = response.data?.selloRecibido || null;
        await pool.query(
            'UPDATE dte_contingencies SET codigo_generacion = ?, sello_recepcion = ?, respuesta_hacienda = ? WHERE id = ?',
            [report.identificacion.codigoGeneracion, selloRecepcion, JSON.stringify(response.data), contingencyId]
        );

        return {
            success: true,
            reportCodigoGeneracion: report.identificacion.codigoGeneracion,
            selloRecepcion: selloRecepcion,
            haciendaResponse: response.data
        };
    } catch (error) {
        const errorData = error.response ? error.response.data : null;
        console.error('[ContingencyReport] Error enviando reporte:', errorData || error.message);
        return { 
            success: false, 
            message: errorData ? (errorData.descripcionMsg || JSON.stringify(errorData)) : error.message 
        };
    }
}

async function getContingencyStatus(companyId) {
    const [rows] = await pool.query(
        'SELECT id, company_id, branch_id, ' +
        'DATE_FORMAT(fecha_inicio, "%Y-%m-%d %H:%i:%s") as fecha_inicio, ' +
        'DATE_FORMAT(fecha_fin, "%Y-%m-%d %H:%i:%s") as fecha_fin, ' +
        'motivo, tipo_contingencia, estado, codigo_generacion, sello_recepcion, respuesta_hacienda, created_at, updated_at ' +
        'FROM dte_contingencies WHERE company_id = ? ORDER BY id DESC LIMIT 10',
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

    const { isSimulatedOutage } = require('../config/haciendaConfig');
    const [flagRows] = await pool.query('SELECT flag_value FROM system_runtime_flags WHERE flag_key = "simulated_outage" LIMIT 1');
    const dbOutage = flagRows.length > 0 && (flagRows[0].flag_value === 'true' || flagRows[0].flag_value === '1');

    return {
        success: true,
        history: rows,
        pendingDocs: pendingCount[0].count,
        sentDocs: sentCount[0].count,
        simulatedOutage: isSimulatedOutage() || dbOutage
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
