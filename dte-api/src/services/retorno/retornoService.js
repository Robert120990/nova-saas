const pool = require('../../../config/db');
const signatureService = require('../signature/signatureService');
const { authenticate } = require('../../transmission/transmissionService');
const axios = require('axios');
const { getEndpoint } = require('../../config/haciendaConfig');
const { validateDTE } = require('../../validators/schemaValidator');
const { getSchemaVersion } = require('../../utils/versionMap');
const { round, getAmountInWords } = require('../../utils/calculations');
const { sanitizeText, cleanNumbers } = require('../../utils/text');
const { v4: uuidv4 } = require('uuid');

async function generateERET(originalCodigoGeneracion, itemsToReturn, companyId) {
    const [dteRows] = await pool.query(
        'SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?',
        [originalCodigoGeneracion, companyId]
    );

    if (dteRows.length === 0) {
        throw new Error('DTE original no encontrado');
    }

    const dte = dteRows[0];
    if (dte.status !== 'ACCEPTED') {
        throw new Error('Solo se pueden emitir Eventos de Retorno para DTE aceptados por Hacienda');
    }

    const tiposPermitidos = ['01', '11', '14'];
    if (!tiposPermitidos.includes(dte.tipo_dte)) {
        throw new Error(`El tipo de DTE "${dte.tipo_dte}" no soporta Evento de Retorno. Tipos permitidos: Factura (01), FEX (11), FSE (14)`);
    }

    const dteJson = dte.json_original;
    const originalItems = dteJson.cuerpoDocumento || [];

    const [companyRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (companyRows.length === 0) {
        throw new Error('Empresa no encontrada');
    }
    const company = companyRows[0];

    const [branchRows] = await pool.query(
        'SELECT codigo, codigo_mh, departamento, municipio, direccion, telefono, correo FROM branches WHERE id = ? AND company_id = ?',
        [dte.branch_id, companyId]
    );
    const branch = branchRows.length > 0 ? branchRows[0] : { codigo: '1', codigo_mh: null, departamento: '06', municipio: '01' };

    const [posRows] = await pool.query(
        'SELECT codigo FROM points_of_sale WHERE branch_id = ? AND company_id = ? AND status = ? LIMIT 1',
        [dte.branch_id, companyId, 'activo']
    );
    const posCodigo = posRows.length > 0 ? posRows[0].codigo : null;

    const localNow = new Date(new Date().toLocaleString("en-US", {timeZone: "America/El_Salvador"}));
    const fecEmi = localNow.toISOString().split('T')[0];
    const horEmi = localNow.toTimeString().split(' ')[0];
    const codigoGeneracion = uuidv4().toUpperCase();

    let selectedItems;
    if (itemsToReturn && itemsToReturn.length > 0) {
        selectedItems = itemsToReturn.map(sel => {
            const orig = originalItems.find(o => o.numItem === sel.numItem);
            if (!orig) {
                throw new Error(`Item numItem ${sel.numItem} no encontrado en el DTE original`);
            }
            return {
                ...orig,
                cantidad: sel.cantidad != null ? sel.cantidad : orig.cantidad
            };
        });
    } else {
        selectedItems = originalItems;
    }

    const bodyItems = selectedItems.map((item, index) => ({
        numItem: index + 1,
        tipoItem: item.tipoItem || 1,
        codigoGeneracion: dte.codigo_generacion,
        cantidad: item.cantidad,
        precioUni: item.precioUni || 0,
        descripcion: item.descripcion || 'Item',
        codigo: item.codigo || null,
        uniMedida: item.uniMedida || 59,
        montoDescu: round(item.montoDescu || 0),
        codTributo: item.codTributo || null,
        ventaNoSuj: round(item.ventaNoSuj || 0),
        ventaExenta: round(item.ventaExenta || 0),
        ventaGravada: round(item.ventaGravada || 0),
        compra: round(item.compra || 0),
        tributos: null,
        psv: round(item.psv || 0),
        ivaItem: round(item.ivaItem || 0),
        noGravado: round(item.noGravado || 0),
        seguro: round(item.seguro || 0),
        flete: round(item.flete || 0),
        ivaRete: round(item.ivaRete || 0),
        reteRenta: round(item.reteRenta || 0)
    }));

    let totalNoSuj = 0, totalExenta = 0, totalGravada = 0, totalCompraExcluidos = 0;
    let subTotalVentas = 0, totalIva = 0, totalPagar = 0;
    let totalNoGravado = 0;

    bodyItems.forEach(item => {
        totalNoSuj += item.ventaNoSuj;
        totalExenta += item.ventaExenta;
        totalGravada += item.ventaGravada;
        totalCompraExcluidos += item.compra;
        totalIva += item.ivaItem;
        totalNoGravado += item.noGravado;
    });

    totalNoSuj = round(totalNoSuj);
    totalExenta = round(totalExenta);
    totalGravada = round(totalGravada);
    totalCompraExcluidos = round(totalCompraExcluidos);
    totalIva = round(totalIva);
    totalNoGravado = round(totalNoGravado);

    subTotalVentas = round(totalNoSuj + totalExenta + totalGravada + totalCompraExcluidos);

    let montoTotalOperacion = round(subTotalVentas + totalIva);
    totalPagar = round(montoTotalOperacion);

    const tributos = totalIva > 0 ? [{
        codigo: '20',
        descripcion: 'Impuesto al Valor Agregado 13%',
        valor: totalIva
    }] : null;

    const receptor = dteJson.receptor || dteJson.documento || null;
    let documento;
    if (receptor && receptor.tipoDocumento && receptor.numDocumento) {
        documento = {
            tipoDocumento: receptor.tipoDocumento,
            numDocumento: receptor.numDocumento || '0000000000000',
            nombre: sanitizeText(receptor.nombre || 'Consumidor Final').substring(0, 250),
            codPais: '9320',
            nombrePais: 'EL SALVADOR',
            telefono: receptor.telefono || '00000000',
            correo: receptor.correo || 'receptor@example.com'
        };
    } else {
        documento = null;
    }

    const eretJson = {
        identificacion: {
            version: 1,
            ambiente: dte.ambiente,
            tipoModelo: 1,
            tipoOperacion: 1,
            tipoEvento: '18',
            tipoContingencia: null,
            motivoContin: null,
            codigoGeneracion: codigoGeneracion,
            fecEmi: fecEmi,
            horEmi: horEmi,
            fusion: null,
            tipoMoneda: 'USD'
        },
        documentoRelacionado: [{
            tipoDocumento: dte.tipo_dte,
            codigoGeneracion: dte.codigo_generacion,
            fechaEmision: dteJson.identificacion.fecEmi
        }],
        emisor: {
            nit: cleanNumbers(company.nit),
            nombre: sanitizeText(company.razon_social),
            codEstableMH: branch.codigo_mh || String(branch.codigo || '1').padStart(4, '0'),
            codEstable: String(branch.codigo || '1').padStart(4, '0'),
            codPuntoVentaMH: posCodigo ? String(posCodigo).padStart(4, '0').substring(0, 4) : '0001',
            codPuntoVenta: '0001',
            recintoFiscal: null,
            tipoRegimen: null,
            regimen: null,
            tipoItemExpor: null
        },
        documento: documento,
        ventaTercero: null,
        compraTercero: null,
        cuerpoDocumento: bodyItems,
        resumen: {
            totalNoSuj: totalNoSuj,
            totalExenta: totalExenta,
            totalGravada: totalGravada,
            totalCompraExcluidos: totalCompraExcluidos,
            subTotalVentas: subTotalVentas,
            tributos: tributos,
            totalSeguro: null,
            totalFlete: null,
            montoTotalOperacion: montoTotalOperacion,
            ivaRete: 0,
            reteRenta: 0,
            totalNoGravado: totalNoGravado,
            totalPagar: totalPagar,
            totalLetras: getAmountInWords(totalPagar),
            totalNoOnerosas: 0,
            totalIva: totalIva,
            saldoFavor: 0
        },
        apendice: null
    };

    const validationResult = validateDTE('18', eretJson);
    if (!validationResult.success) {
        console.error('ERET Schema Validation Errors:', JSON.stringify(validationResult.errors, null, 2));
        const error = new Error('Validación de esquema de Evento de Retorno falló');
        error.details = validationResult.errors;
        error.dte = eretJson;
        throw error;
    }

    return eretJson;
}

async function emitERET(payload, companyId, user) {
    const { codigoGeneracionOriginal, items, password } = payload;

    const eretJson = await generateERET(codigoGeneracionOriginal, items, companyId);
    const { codigoGeneracion } = eretJson.identificacion;

    const [origDte] = await pool.query(
        'SELECT branch_id FROM dtes WHERE codigo_generacion = ? AND company_id = ?',
        [codigoGeneracionOriginal, companyId]
    );
    const branchId = origDte.length > 0 ? origDte[0].branch_id : null;

    const [company] = await pool.query(
        'SELECT nit, api_user, api_password, certificate_path, certificate_password FROM companies WHERE id = ?',
        [companyId]
    );

    if (company.length === 0) {
        throw new Error('Empresa no encontrada');
    }

    const certPass = password || company[0].certificate_password;
    const signatureMode = process.env.SIGNATURE_MODE || 'internal';

    if (signatureMode === 'internal' && !company[0].certificate_path) {
        throw new Error('Certificado no configurado para la empresa (Modo Interno)');
    }

    const signResult = await signatureService.signDTE(eretJson, {
        certificatePath: company[0].certificate_path,
        certificatePassword: certPass,
        nit: company[0].nit,
        ambiente: eretJson.identificacion.ambiente
    });

    if (!signResult.success) {
        throw new Error(`Falla en firma: ${signResult.message}`);
    }

    const auth = await authenticate(company[0].api_user, company[0].api_password, eretJson.identificacion.ambiente);
    if (!auth.success) {
        throw new Error(`Error MH Auth: ${auth.message}`);
    }

    let jwsString = typeof signResult.jws === 'string' ? signResult.jws : signResult.jws?.body || JSON.stringify(signResult.jws);
    jwsString = jwsString.replace(/^"|"$/g, '').trim();

    const receptionUrl = getEndpoint('recepcion', eretJson.identificacion.ambiente);

    let txResult;
    try {
        const response = await axios.post(receptionUrl, {
            ambiente: eretJson.identificacion.ambiente,
            idEnvio: Math.floor(Date.now() / 1000),
            version: 2,
            tipoDte: '18',
            documento: jwsString,
            codigoGeneracion: codigoGeneracion
        }, {
            headers: {
                'Authorization': auth.token,
                'Content-Type': 'application/json'
            }
        });

        txResult = {
            success: true,
            status: response.data.estado,
            selloRecepcion: response.data.selloRecibido,
            fhProcesamiento: response.data.fhProcesamiento,
            data: response.data
        };
    } catch (error) {
        const mhErrorData = error.response ? error.response.data : { message: error.message };
        console.error('ERET MH Transmission Error:', mhErrorData);
        txResult = {
            success: false,
            error: mhErrorData
        };
    }

    const dbStatus = txResult.success && txResult.status === 'PROCESADO' ? 'ACCEPTED' : 'REJECTED';
    const haciendaError = txResult.error || txResult.data;

    let formattedDate = txResult.fhProcesamiento || null;
    if (formattedDate && formattedDate.includes('/')) {
        const [datePart, timePart] = formattedDate.split(' ');
        const [day, month, year] = datePart.split('/');
        formattedDate = `${year}-${month}-${day} ${timePart}`;
    }

    await pool.query(
        'INSERT INTO dtes (codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, json_firmado, sello_recepcion, fh_procesamiento, respuesta_hacienda) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            codigoGeneracion,
            `ERET-${codigoGeneracion.substring(0, 8)}`,
            '18',
            companyId,
            branchId,
            user ? user.id : 0,
            dbStatus,
            eretJson.identificacion.ambiente,
            JSON.stringify(eretJson),
            jwsString,
            txResult.selloRecepcion || null,
            formattedDate,
            haciendaError ? JSON.stringify(haciendaError) : null
        ]
    );

    return {
        success: dbStatus === 'ACCEPTED',
        codigoGeneracion,
        estadoHacienda: txResult.status || 'REJECTED',
        data: txResult.data || txResult.error
    };
}

async function getRetornoStatus(codigoGeneracion, companyId) {
    const [rows] = await pool.query(
        'SELECT codigo_generacion, tipo_dte, status, sello_recepcion, fh_procesamiento, respuesta_hacienda FROM dtes WHERE codigo_generacion = ? AND company_id = ? AND tipo_dte = ?',
        [codigoGeneracion, companyId, '18']
    );

    if (rows.length === 0) {
        throw new Error('Evento de Retorno no encontrado');
    }

    return { success: true, data: rows[0] };
}

module.exports = { generateERET, emitERET, getRetornoStatus };
