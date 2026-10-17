const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const dteService = require('../services/dte.service');

const CONTRACT_API_VERSION = '2.4.0';
const CONTRACT_UPDATED_AT = '2026-10-13T00:00:00.000Z';

const MH_SCHEMA_VERSIONS = {
    '01': 1,
    '03': 3,
    '05': 3,
    '06': 3,
    '07': 1,
    '11': 1,
    '14': 1
};

const CONTRACT_SCHEMA = {
    endpoint: '/api/dte/emit',
    salesEndpoint: '/api/sales',
    coldroomBillingEndpoint: '/api/integration/coldroom-billing',
    requiredHeaders: ['Authorization', 'x-company-id', 'x-branch-id'],
    requiredPayloadFields: ['tipoDte', 'condicionOperacion', 'customer', 'items'],
    requiredItemFields: ['tipoItem', 'cantidad', 'uniMedida', 'descripcion', 'precioUnitario', 'tributos'],
    supportedDteTypes: ['01', '03', '05', '06'],
    serviceDefaults: {
        tipoItem: 2,
        uniMedida: 99,
        tributos: ['20'],
        ivaRate: 0.13
    }
};

const CONTRACT_CHANGELOG = [
    {
        version: '2.4.0',
        date: '2026-10-13',
        summary: 'Contrato de integración facturación Cuarto Frío Inversiones LIL (DTE 03)'
    }
];

function hashNormalizedFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim();
            return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
        }
    } catch (_) {
        // Ignore read error
    }
    return null;
}

function computeContractHash() {
    const dteGenPath = path.resolve(__dirname, '../../../dte-api/src/services/dteGenerator.js');
    const dteCtrlPath = path.resolve(__dirname, '../../../dte-api/src/controllers/dteController.js');

    const dteGeneratorDigest = hashNormalizedFile(dteGenPath);
    const dteControllerDigest = hashNormalizedFile(dteCtrlPath);

    const hashInput = {
        apiVersion: CONTRACT_API_VERSION,
        mhSchemaVersions: MH_SCHEMA_VERSIONS,
        schema: {
            endpoint: CONTRACT_SCHEMA.endpoint,
            salesEndpoint: CONTRACT_SCHEMA.salesEndpoint,
            requiredHeaders: CONTRACT_SCHEMA.requiredHeaders,
            requiredPayloadFields: CONTRACT_SCHEMA.requiredPayloadFields,
            requiredItemFields: CONTRACT_SCHEMA.requiredItemFields,
            supportedDteTypes: CONTRACT_SCHEMA.supportedDteTypes,
            serviceDefaults: CONTRACT_SCHEMA.serviceDefaults
        },
        sourceDigests: {
            dteGenerator: dteGeneratorDigest,
            dteController: dteControllerDigest
        }
    };

    const contractHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(hashInput), 'utf8')
        .digest('hex');

    return {
        contractHash,
        sourceDigests: {
            dteGenerator: dteGeneratorDigest,
            dteController: dteControllerDigest
        }
    };
}

function formatAmbienteLabel(rawAmbiente) {
    const str = String(rawAmbiente || '').trim().toLowerCase();
    if (str === '2' || str === '01' || str === 'prod' || str === 'production' || str === 'produccion') {
        return 'Producción (01)';
    }
    return 'Pruebas (00)';
}

/**
 * GET /api/integration/contract
 * Devuelve el contrato vivo de integración SIPE + metadatos de emisor (Inversiones LIL) y receptor (Avícola Salvadoreña).
 */
const getIntegrationContract = async (req, res) => {
    const auth = verifyIntegrationAuth(req);
    if (!auth.authorized) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado. Proporcione Authorization Bearer token o x-service-key válida.'
        });
    }

    try {
        const { contractHash, sourceDigests } = computeContractHash();

        const [companies] = await pool.query(
            'SELECT id, razon_social, nombre_comercial, nit, nrc, codigo_actividad, actividad_economica, ambiente, dte_active FROM companies WHERE id = 1 LIMIT 1'
        );
        const [branches] = await pool.query(
            'SELECT id, company_id, nombre, codigo, codigo_mh, tipo_establecimiento, departamento, municipio, distrito, direccion, telefono, correo, ambiente FROM branches WHERE company_id = 1 ORDER BY id ASC'
        );
        const [customers] = await pool.query(
            'SELECT id, company_id, nombre, nombre_comercial, nit, nrc, tipo_documento, numero_documento, codigo_actividad, direccion, departamento, municipio, distrito, telefono, correo, condicion_fiscal, es_credito, dias_credito FROM customers WHERE id = 5038 LIMIT 1'
        );
        const [contingencies] = await pool.query(
            'SELECT id, branch_id, fecha_inicio, motivo, tipo_contingencia, estado FROM dte_contingencies WHERE company_id = 1 AND estado = ? ORDER BY id DESC',
            ['OPEN']
        );
        const [dteCountRows] = await pool.query(
            'SELECT COUNT(*) AS total FROM dtes WHERE company_id = 1'
        );

        const company = companies[0] || {};
        const primaryBranch = branches.find(b => Number(b.id) === 1) || branches[0] || {};
        const customer = customers[0] || {};
        const totalDtesEmitted = Number(dteCountRows[0]?.total || 0);
        const contingencyOpen = contingencies.length > 0;

        res.json({
            success: true,
            apiVersion: CONTRACT_API_VERSION,
            contractHash,
            sourceDigests,
            updatedAt: CONTRACT_UPDATED_AT,
            checkedAt: new Date().toISOString(),
            mhSchemaVersions: MH_SCHEMA_VERSIONS,
            issuer: {
                id: company.id || 1,
                razonSocial: 'Inversiones Lil, S.A. de C.V.',
                rawRazonSocial: company.razon_social || 'Inversiones Lil, S,A, de C,V.',
                nombreComercial: company.nombre_comercial || 'INV LIL',
                nit: company.nit || '0614-270114-103-3',
                nrc: company.nrc || '230360-6',
                codActividad: company.codigo_actividad || '47300',
                ambiente: formatAmbienteLabel(primaryBranch.ambiente || company.ambiente),
                dteActive: Boolean(company.dte_active),
                branchId: primaryBranch.id || 1,
                branchName: primaryBranch.id === 1
                    ? 'Puma San Martin II (Km 19 San Martín)'
                    : (primaryBranch.nombre || 'Puma San Martin II'),
                codigoMh: primaryBranch.codigo_mh || 'S001',
                direccion: primaryBranch.direccion || 'CARR. PANAMERICANA CA01 KM 19',
                departamento: primaryBranch.departamento || '06',
                municipio: primaryBranch.municipio || '22',
                distrito: primaryBranch.distrito || '13',
                telefono: primaryBranch.telefono || '2222-2222',
                correo: primaryBranch.correo || 'pumasanmartin@sipesv.com',
                contingencyOpen,
                openContingencies: contingencies,
                totalDtesEmitted,
                branches: branches.map(b => ({
                    id: b.id,
                    nombre: b.nombre,
                    codigo: b.codigo,
                    codigoMh: b.codigo_mh,
                    direccion: b.direccion,
                    departamento: b.departamento,
                    municipio: b.municipio,
                    distrito: b.distrito,
                    ambiente: formatAmbienteLabel(b.ambiente || company.ambiente)
                }))
            },
            defaultCustomer: {
                id: customer.id || 5038,
                nombre: customer.nombre || 'AVICOLA SALVADOREÑA, S.A DE C.V',
                nombreComercial: customer.nombre_comercial || 'AVICOLA SALVADOREÑA',
                nit: customer.nit || '0614-130571-001-2',
                nrc: customer.nrc || '233-0',
                codActividad: customer.codigo_actividad || '10103',
                correo: customer.correo || 'FRANCISCO.PORTILLO@SOMOSCMI.COM',
                telefono: customer.telefono || '6988-3158',
                direccion: customer.direccion || 'CANTON EL ROSARIO, GRANJA OMOA',
                departamento: customer.departamento || '06',
                municipio: customer.municipio || '23',
                distrito: customer.distrito || '14',
                condicionFiscal: customer.condicion_fiscal || 'gran contribuyente',
                esCredito: Boolean(customer.es_credito ?? 1),
                diasCredito: Number(customer.dias_credito || 15)
            },
            schema: CONTRACT_SCHEMA,
            changelog: CONTRACT_CHANGELOG
        });
    } catch (error) {
        console.error('[IntegrationContract] Error en getIntegrationContract:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener contrato de integración SIPE',
            error: error.message
        });
    }
};

/**
 * Verifica autorización para facturación externa de Cuarto Frío (Token JWT o Service Key).
 */
function verifyIntegrationAuth(req) {
    const serviceKey = req.headers['x-service-key'] || req.headers['x-integration-key'] || req.headers['x-restart-key'];
    const allowedKeys = [
        process.env.SIPE_INTEGRATION_KEY,
        process.env.RESTART_KEY
    ].filter(Boolean);

    if (serviceKey && typeof serviceKey === 'string') {
        const keyBuf = Buffer.from(serviceKey, 'utf8');
        const isMatched = allowedKeys.some((allowedKey) => {
            const allowedBuf = Buffer.from(String(allowedKey), 'utf8');
            return keyBuf.byteLength === allowedBuf.byteLength && crypto.timingSafeEqual(keyBuf, allowedBuf);
        });
        if (isMatched) {
            return {
                authorized: true,
                companyId: Number(req.headers['x-company-id'] || 1),
                branchId: Number(req.headers['x-branch-id'] || 1),
                userId: 1
            };
        }
    }

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        const secrets = [
            process.env.JWT_SECRET,
            process.env.DTE_JWT_SECRET
        ].filter(Boolean);

        for (const secret of secrets) {
            try {
                const decoded = jwt.verify(token, secret);
                return {
                    authorized: true,
                    companyId: Number(req.headers['x-company-id'] || decoded.company_id || 1),
                    branchId: Number(req.headers['x-branch-id'] || decoded.branch_id || 1),
                    userId: Number(decoded.id || 1)
                };
            } catch (_) {
                // Try next secret
            }
        }
    }

    return { authorized: false };
}

const round2 = (n) => Number(Math.round(Number(n || 0) + 'e+2') + 'e-2');

/**
 * POST /api/integration/coldroom-billing
 * Registra la venta de Cuarto Frío en SIPE (sales_headers, sales_items, sales_payments)
 * y emite o registra en pre-factura/contingencia el DTE 03 para Inversiones LIL -> Avícola Salvadoreña.
 */
const createColdroomBilling = async (req, res) => {
    const auth = verifyIntegrationAuth(req);
    if (!auth.authorized) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado. Proporcione Authorization Bearer token o x-service-key válida.'
        });
    }

    const payload = req.body || {};
    const {
        tipoDte = '03',
        condicionOperacion = 2,
        diasCredito = 15,
        customer,
        items,
        observaciones,
        emissionMode = 'sipe_draft',
        cutId = null,
        cutType = 'daily_cut',
        dtePreview = null
    } = payload;

    // Validar campos requeridos del contrato
    for (const field of CONTRACT_SCHEMA.requiredPayloadFields) {
        if (payload[field] === undefined || payload[field] === null) {
            return res.status(400).json({
                success: false,
                message: `Campo obligatorio faltante en payload: "${field}"`
            });
        }
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'El arreglo "items" debe contener al menos una línea de facturación.'
        });
    }

    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        for (const reqField of CONTRACT_SCHEMA.requiredItemFields) {
            if (it[reqField] === undefined || it[reqField] === null) {
                return res.status(400).json({
                    success: false,
                    message: `Ítem #${i + 1} no incluye el campo requerido "${reqField}".`
                });
            }
        }
    }

    const companyId = auth.companyId || 1;
    const branchId = auth.branchId || 1;
    const customerId = Number(customer?.id || 5038);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [compRows] = await connection.query(
            `SELECT c.*, cat.description as actividad_economica
             FROM companies c
             LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
             WHERE c.id = ? LIMIT 1`,
            [companyId]
        );
        const company = compRows[0];
        if (!company) {
            throw new Error(`Empresa ID ${companyId} no encontrada en SIPE`);
        }

        const totalGravado = round2(
            items.reduce((acc, it) => acc + round2(Number(it.ventaGravada ?? (Number(it.cantidad) * Number(it.precioUnitario)))), 0)
        );
        const totalIva = round2(totalGravado * 0.13);
        const totalPagar = round2(totalGravado + totalIva);
        const now = new Date();
        const horaEmision = now.toTimeString().split(' ')[0];

        const [saleResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
            company_id: companyId,
            branch_id: branchId,
            customer_id: customerId,
            seller_id: 3,
            pos_id: 1,
            dte_type: tipoDte,
            tipo_documento: tipoDte,
            condicion_operacion: Number(condicionOperacion) || 2,
            fecha_emision: now,
            hora_emision: horaEmision,
            estado: 'emitido',
            total_gravado: totalGravado,
            total_exento: 0,
            total_nosujetas: 0,
            fovial: 0,
            cotrans: 0,
            total_iva: totalIva,
            descuento_general: 0,
            iva_percibido: 0,
            iva_retenido: 0,
            total_pagar: totalPagar,
            payment_condition: Number(condicionOperacion) || 2,
            observaciones: observaciones || `Facturación Cuarto Frío (${cutType}: ${cutId || 'N/A'})`,
            cliente_nombre: customer?.nombre || 'AVICOLA SALVADOREÑA, S.A DE C.V',
            created_at: now
        }]);

        const saleId = saleResult.insertId;

        // Nota: en sales_items de SIPE, cuando dteService.emitDTE calcula CCF (03),
        // dteGenerator extrae precioUnitario / 1.13. Guardamos el precio_unitario con IVA en sales_items
        // para que dteService/dteGenerator produzca exactamente precioUnitario neto y ventaGravada exacta.
        for (const it of items) {
            const cant = Number(it.cantidad) || 1;
            const netUnit = Number(it.precioUnitario) || 0;
            const gravada = round2(it.ventaGravada ?? (cant * netUnit));
            const inclusiveUnit = Number((netUnit * 1.13).toFixed(6));

            await connection.query('INSERT INTO sales_items SET ?', [{
                sale_id: saleId,
                product_id: null,
                codigo: it.codigo || 'SRV-CF',
                combo_id: null,
                descripcion: it.descripcion,
                cantidad: cant,
                precio_unitario: inclusiveUnit,
                monto_descuento: 0,
                venta_gravada: gravada,
                venta_exenta: 0,
                tributos: JSON.stringify(it.tributos || ['20'])
            }]);
        }

        await connection.query('INSERT INTO sales_payments SET ?', [{
            sale_id: saleId,
            metodo_pago: Number(condicionOperacion) === 2 ? '13' : '01',
            monto: totalPagar,
            referencia: cutId ? `CUT:${cutId}` : null
        }]);

        let codigoGeneracion = (dtePreview?.identificacion?.codigoGeneracion || uuidv4()).toUpperCase();
        let numeroControl = dtePreview?.identificacion?.numeroControl || null;
        let selloRecepcion = null;
        let fhProcesamiento = null;
        let estadoHacienda = 'PRE_FACTURA';
        let dteJsonSaved = dtePreview || payload;

        if (emissionMode === 'sipe_api' || emissionMode === 'live_mh') {
            const dtePayload = {
                header: {
                    dte_type: tipoDte,
                    customer_id: customerId,
                    cliente_nombre: customer?.nombre || 'AVICOLA SALVADOREÑA, S.A DE C.V',
                    branch_id: branchId,
                    user_id: auth.userId || 1,
                    condicion_operacion: Number(condicionOperacion) || 2,
                    dias_credito: Number(diasCredito) || 15,
                    total_gravado: totalGravado,
                    total_iva: totalIva,
                    total_pagar: totalPagar,
                    observaciones: observaciones || null
                },
                dias_credito: Number(diasCredito) || 15,
                items: items.map(it => ({
                    codigo: it.codigo || 'SRV-CF',
                    descripcion: it.descripcion,
                    cantidad: Number(it.cantidad) || 1,
                    precio_unitario: Number((Number(it.precioUnitario) * 1.13).toFixed(6)),
                    monto_descuento: 0,
                    venta_gravada: round2(it.ventaGravada ?? (Number(it.cantidad) * Number(it.precioUnitario))),
                    venta_exenta: 0,
                    exento: false,
                    tributos: it.tributos || ['20']
                })),
                payments: [{
                    codigo: Number(condicionOperacion) === 2 ? '13' : '01',
                    monto: totalPagar,
                    plazo: Number(condicionOperacion) === 2 ? '01' : null,
                    periodo: Number(condicionOperacion) === 2 ? (Number(diasCredito) || 15) : null
                }],
                emisor_adicional: {
                    descActividad: company.actividad_economica || 'Almacenamiento y depósito',
                    codPuntoVentaMH: 'P001'
                }
            };

            const emitRes = await dteService.emitDTE(company, dtePayload, saleId);
            if (emitRes && emitRes.success) {
                codigoGeneracion = emitRes.data.codigo_generacion;
                numeroControl = emitRes.data.numero_control;
                selloRecepcion = emitRes.data.sello_recepcion || null;
                fhProcesamiento = emitRes.data.fh_procesamiento || null;
                estadoHacienda = emitRes.contingency ? 'CONTINGENCIA' : 'PROCESADO';
            } else if (payload.allowStagingFallback !== false) {
                // Si dte-api no está levantado localmente, registrar en dtes como PENDING / PRE_FACTURA
                const year = now.getFullYear();
                const [corrRows] = await connection.query(
                    'SELECT current_number FROM dte_correlativos WHERE company_id = ? AND tipo_dte = ? AND year = ? LIMIT 1',
                    [companyId, tipoDte, year]
                );
                const previewCorr = (Number(corrRows[0]?.current_number || 0) + 1).toString().padStart(15, '0');
                numeroControl = numeroControl || `DTE-${tipoDte}-S001P001-${previewCorr}`;
                estadoHacienda = 'PENDIENTE_TRANSMISION';

                await connection.query(
                    `INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, respuesta_hacienda)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        saleId,
                        codigoGeneracion,
                        numeroControl,
                        tipoDte,
                        companyId,
                        branchId,
                        auth.userId || 1,
                        'PENDING',
                        '01',
                        JSON.stringify(dteJsonSaved),
                        JSON.stringify({ estado: 'PENDIENTE_TRANSMISION', nota: emitRes?.error || 'Registrado para transmisión en SIPE' })
                    ]
                );
            } else {
                throw new Error(emitRes?.error || 'Error al emitir DTE en dte-api');
            }
        } else {
            // Modo Pre-Factura / Borrador en SIPE (sin consumir correlativo oficial definitivo hasta firma)
            const year = now.getFullYear();
            const [corrRows] = await connection.query(
                'SELECT current_number FROM dte_correlativos WHERE company_id = ? AND tipo_dte = ? AND year = ? LIMIT 1',
                [companyId, tipoDte, year]
            );
            const previewCorr = (Number(corrRows[0]?.current_number || 0) + 1).toString().padStart(15, '0');
            numeroControl = numeroControl || `DTE-${tipoDte}-S001P001-${previewCorr}`;
            estadoHacienda = 'PRE_FACTURA';

            await connection.query(
                `INSERT INTO dtes (venta_id, codigo_generacion, numero_control, tipo_dte, company_id, branch_id, usuario_id, status, ambiente, json_original, respuesta_hacienda)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    saleId,
                    codigoGeneracion,
                    numeroControl,
                    tipoDte,
                    companyId,
                    branchId,
                    auth.userId || 1,
                    'PENDING',
                    '01',
                    JSON.stringify(dteJsonSaved),
                    JSON.stringify({ estado: 'PRE_FACTURA', cutId, cutType })
                ]
            );
        }

        await connection.query(
            'UPDATE sales_headers SET codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
            [codigoGeneracion, numeroControl, selloRecepcion, fhProcesamiento, saleId]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            saleId,
            codigoGeneracion,
            numeroControl,
            selloRecepcion,
            fhProcesamiento,
            estadoHacienda,
            totalGravado,
            totalIva,
            totalPagar
        });
    } catch (error) {
        await connection.rollback();
        console.error('[IntegrationContract] Error en createColdroomBilling:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar facturación de Cuarto Frío en SIPE',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    getIntegrationContract,
    createColdroomBilling,
    verifyIntegrationAuth,
    computeContractHash,
    CONTRACT_API_VERSION,
    MH_SCHEMA_VERSIONS,
    CONTRACT_SCHEMA
};
