/**
 * Company DTE Test Service
 * Handles test emission generation for DGII/Hacienda accreditation testing.
 */

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { TEST_CATALOG, buildTestPayload, buildFacturaPayload } = require('./companyDteTestPayloads');

const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || 'saas_dte_api_secret_2024';

async function getTestSummary(companyId) {
    const [companies] = await pool.query(
        'SELECT id, razon_social, nombre_comercial, nit, nrc, ambiente, api_user, certificate_path FROM companies WHERE id = ?',
        [companyId]
    );
    if (!companies.length) throw new Error('Empresa no encontrada');
    const company = companies[0];

    const [branches] = await pool.query(
        'SELECT id, codigo, nombre, codigo_mh, ambiente, departamento, municipio, distrito FROM branches WHERE company_id = ? ORDER BY es_casa_matriz DESC, id ASC LIMIT 1',
        [companyId]
    );
    const branch = branches[0] || null;

    // Conteo de DTEs en ambiente de pruebas (00 o 1)
    const [dteRows] = await pool.query(
        `SELECT tipo_dte, COUNT(*) as count 
         FROM dtes 
         WHERE company_id = ? AND status = 'ACCEPTED' AND (ambiente = '00' OR ambiente = '1' OR ambiente = 'test')
         GROUP BY tipo_dte`,
        [companyId]
    );
    const countMap = {};
    dteRows.forEach(r => { countMap[r.tipo_dte] = Number(r.count); });

    // Invalidaciones en ambiente de pruebas
    const [invRows] = await pool.query(
        `SELECT COUNT(*) as count 
         FROM dtes 
         WHERE company_id = ? AND status = 'INVALIDADO' AND (ambiente = '00' OR ambiente = '1' OR ambiente = 'test')`,
        [companyId]
    );
    const invalidationCount = Number(invRows[0]?.count || 0);

    // Contingencias registradas con reporte aceptado o período cerrado
    const [contRows] = await pool.query(
        'SELECT COUNT(*) as count FROM dte_contingencies WHERE company_id = ? AND (sello_recepcion IS NOT NULL OR estado = "CLOSED")',
        [companyId]
    );
    const contingencyCount = Number(contRows[0]?.count || 0);

    let mandatoryCompleted = 0;
    let totalCompleted = 0;

    const tests = TEST_CATALOG.map(t => {
        let completed = 0;
        if (t.key === 'invalidacion') completed = invalidationCount;
        else if (t.key === 'contingencia') completed = contingencyCount;
        else if (t.key === 'retorno') completed = countMap['18'] || 0;
        else if (t.key === 'operaciones_especiales') completed = countMap['17'] || 0;
        else completed = countMap[t.code] || 0;

        const effectiveCompleted = Math.min(completed, t.required);
        if (t.isMandatory) mandatoryCompleted += effectiveCompleted;
        totalCompleted += effectiveCompleted;

        return {
            ...t,
            completed,
            pending: Math.max(0, t.required - completed),
            percentage: Math.min(100, Math.round((completed / t.required) * 100)),
            isFinished: completed >= t.required
        };
    });

    const isTestEnv = company.ambiente === '1' || company.ambiente === 'test' || company.ambiente === '00';

    return {
        company: {
            id: company.id,
            razon_social: company.razon_social,
            nombre_comercial: company.nombre_comercial,
            nit: company.nit,
            nrc: company.nrc,
            ambiente: company.ambiente,
            isTestEnv,
            hasCertificate: Boolean(company.certificate_path),
            hasApiUser: Boolean(company.api_user)
        },
        branch: branch ? { id: branch.id, codigo: branch.codigo, nombre: branch.nombre, codigo_mh: branch.codigo_mh } : null,
        tests,
        mandatorySummary: {
            required: 215,
            completed: mandatoryCompleted,
            percentage: Math.min(100, Math.round((mandatoryCompleted / 215) * 100)),
            isFinished: mandatoryCompleted >= 215
        },
        totalSummary: {
            required: 615,
            completed: totalCompleted,
            percentage: Math.min(100, Math.round((totalCompleted / 615) * 100)),
            isFinished: totalCompleted >= 615
        }
    };
}

async function emitSingleTest(companyId, testType, user) {
    const [companies] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!companies.length) throw new Error('Empresa no encontrada');
    const company = companies[0];

    const [branches] = await pool.query(
        'SELECT * FROM branches WHERE company_id = ? ORDER BY es_casa_matriz DESC, id ASC LIMIT 1',
        [companyId]
    );
    const branch = branches[0];
    if (!branch) throw new Error('La empresa no tiene ninguna sucursal registrada');

    const token = jwt.sign(
        { id: user.id || 1, username: user.username || 'admin', company_id: companyId, branch_id: branch.id },
        DTE_JWT_SECRET,
        { expiresIn: '15m' }
    );

    // 1. Evento de Invalidación
    if (testType === 'invalidacion') {
        const [acceptedDocs] = await pool.query(
            'SELECT codigo_generacion FROM dtes WHERE company_id = ? AND status = "ACCEPTED" ORDER BY id DESC LIMIT 1',
            [companyId]
        );
        let targetCodGen = acceptedDocs[0]?.codigo_generacion;
        if (!targetCodGen) {
            const prevTest = await executeTestEmit(token, companyId, buildFacturaPayload(company, branch));
            if (!prevTest.success) throw new Error(`No se pudo emitir documento previo para invalidación: ${prevTest.message || prevTest.error}`);
            targetCodGen = prevTest.codigoGeneracion;
        }

        const invPayload = {
            codigoGeneracion: targetCodGen,
            motivo: 2,
            descripcion: 'Prueba de invalidación para acreditación de Hacienda',
            nombreResponsable: company.razon_social || 'RESPONSABLE PRUEBA',
            tipDocResponsable: '36',
            numDocResponsable: (company.nit || '').replace(/\D/g, ''),
            nombreSolicita: 'MINISTERIO DE HACIENDA',
            tipDocSolicita: '36',
            numDocSolicita: (company.nit || '').replace(/\D/g, '')
        };

        const res = await callDteApi('/invalidation/invalidate', 'POST', invPayload, token, companyId);
        return {
            success: res.success,
            testType: 'invalidacion',
            codigoGeneracion: targetCodGen,
            estadoHacienda: res.data?.estado || (res.success ? 'PROCESADO' : 'RECHAZADO'),
            selloRecepcion: res.data?.selloRecibido || res.selloRecepcion || null,
            message: res.message || (res.success ? 'Invalidación procesada exitosamente por MH' : 'Rechazo de invalidación'),
            data: res.data || res
        };
    }

    // 2. Evento de Contingencia (19)
    if (testType === 'contingencia') {
        const startRes = await callDteApi('/contingency/start', 'POST', {
            motivo: 'Prueba de contingencia acreditación MH',
            tipoContingencia: 1
        }, token, companyId);
        if (!startRes.success || !startRes.contingencyId) {
            throw new Error(`No se pudo iniciar modo contingencia: ${startRes.message || 'Error desconocido'}`);
        }
        const contingencyId = startRes.contingencyId;

        // Emitir DTE bajo contingencia (tipoModelo: 2, tipoOperacion: 2)
        const dtePayload = buildFacturaPayload(company, branch);
        const dteRes = await callDteApi('/dte/emit', 'POST', dtePayload, token, companyId);
        if (!dteRes.success) {
            await pool.query('DELETE FROM dte_contingencies WHERE id = ?', [contingencyId]);
            throw new Error(`Falla al emitir DTE en contingencia: ${dteRes.message || dteRes.error}`);
        }

        // Cerrar período y transmitir reporte de contingencia firmado a Hacienda
        const stopRes = await callDteApi(`/contingency/stop/${contingencyId}`, 'POST', null, token, companyId);
        const report = stopRes.report || {};

        return {
            success: Boolean(stopRes.success && report.success),
            testType: 'contingencia',
            codigoGeneracion: report.reportCodigoGeneracion || dteRes.codigoGeneracion,
            numeroControl: null,
            estadoHacienda: report.haciendaResponse?.estado || (stopRes.success ? 'PROCESADO' : 'RECHAZADO'),
            selloRecepcion: report.selloRecepcion || report.haciendaResponse?.selloRecibido || null,
            message: report.success ? 'Evento de contingencia recibido y procesado por Hacienda' : (stopRes.message || 'Error en reporte de contingencia'),
            data: report.haciendaResponse || stopRes
        };
    }

    // 3. Evento de Retorno (ERET)
    if (testType === 'retorno') {
        const [retDocs] = await pool.query(
            'SELECT codigo_generacion FROM dtes WHERE company_id = ? AND tipo_dte = "01" AND status = "ACCEPTED" ORDER BY id DESC LIMIT 1',
            [companyId]
        );
        let originalCodGen = retDocs[0]?.codigo_generacion;
        if (!originalCodGen) {
            const prevTest = await executeTestEmit(token, companyId, buildFacturaPayload(company, branch));
            if (!prevTest.success) throw new Error('No se pudo emitir factura previa para retorno');
            originalCodGen = prevTest.codigoGeneracion;
        }

        const res = await callDteApi('/retorno/emit', 'POST', {
            codigoGeneracionOriginal: originalCodGen,
            items: [{ numItem: 1, cantidad: 1, motivo: 'Devolución de mercadería de prueba' }]
        }, token, companyId);

        return {
            success: res.success,
            testType: 'retorno',
            codigoGeneracion: res.codigoGeneracion || originalCodGen,
            estadoHacienda: res.data?.estado || (res.success ? 'PROCESADO' : 'RECHAZADO'),
            selloRecepcion: res.data?.selloRecibido || null,
            message: res.message || (res.success ? 'Evento de Retorno procesado' : 'Rechazo de retorno'),
            data: res.data || res
        };
    }

    // 4. Documentos DTE Estándar (01, 03, 04, 05, 06, 07, 11, etc.)
    const dtePayload = await buildTestPayload(testType, company, branch);
    return await executeTestEmit(token, companyId, dtePayload, testType);
}

async function callDteApi(endpoint, method, body, token, companyId) {
    try {
        const res = await fetch(`${DTE_API_URL}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-company-id': String(companyId)
            },
            body: body ? JSON.stringify(body) : undefined
        });
        return await res.json();
    } catch (e) {
        if (e.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
            throw new Error('El microservicio dte-api (puerto 5000) no responde o está apagado. Inícialo con pnpm run dev en dte-api.');
        }
        throw e;
    }
}

async function executeTestEmit(token, companyId, payload, testType = '01') {
    const res = await callDteApi('/dte/emit', 'POST', payload, token, companyId);
    return {
        success: Boolean(res.success),
        testType: payload.tipoDte || testType,
        codigoGeneracion: res.codigoGeneracion || null,
        numeroControl: res.numeroControl || null,
        selloRecepcion: res.data?.selloRecibido || null,
        fhProcesamiento: res.data?.fhProcesamiento || null,
        estadoHacienda: res.estadoHacienda || res.data?.estado || (res.success ? 'PROCESADO' : 'RECHAZADO'),
        message: res.message || (res.success ? 'DTE de prueba procesado por Hacienda' : 'Error en transmisión'),
        details: res.data || res
    };
}

module.exports = {
    getTestSummary,
    emitSingleTest
};
