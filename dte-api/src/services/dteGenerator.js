/**
 * DTE Generator Service
 */

const { v4: uuidv4 } = require('uuid');
const { generateControlNumber } = require('./dte/controlNumberService');
const { calculateItem, calculateTotals, round, round4, round6, getAmountInWords } = require('../utils/calculations');
const { sanitizeText, cleanNumbers } = require('../utils/text');
const { validateDTE } = require('../validators/schemaValidator');
const pool = require('../../config/db');

async function generateDTE(payload) {
    const { tipoDte, companyId, branchId, userId, items, receptor, identificacionExtra = {} } = payload;

    // 1. Get Company and Branch Data
    const [companyRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const [branchRows] = await pool.query('SELECT * FROM branches WHERE id = ? AND company_id = ?', [branchId, companyId]);

    if (companyRows.length === 0 || branchRows.length === 0) {
        throw new Error('Empresa o sucursal no encontrada');
    }

    const company = companyRows[0];
    const branch = branchRows[0];

    // 2. Generate Identificacion
    const codigoGeneracion = uuidv4().toUpperCase();
    const branchCode = String(branch.codigo || '1').padStart(3, '0');
    const controlResult = await generateControlNumber(tipoDte, companyId, branchId, branchCode);
    const numeroControl = controlResult.numero_control;
    const now = new Date();
    // Force El Salvador timezone for Hacienda compliance
    const fecEmi = now.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
    const horEmi = now.toLocaleTimeString('en-GB', { timeZone: 'America/El_Salvador' }).substring(0, 8);

    // Versioning logic by type
    const version = tipoDte === '01' ? 1 : 3;

    const identificacion = {
        version: version,
        ambiente: company.ambiente === 'produccion' ? '01' : '00',
        tipoDte: tipoDte,
        numeroControl: numeroControl,
        codigoGeneracion: codigoGeneracion,
        tipoModelo: 1,
        tipoOperacion: 1,
        tipoContingencia: null,
        motivoContin: null,
        fecEmi: fecEmi,
        horEmi: horEmi,
        tipoMoneda: 'USD',
        ...identificacionExtra
    };

    // 3. Emisor - Validating and padding address codes
    const deptCode = String(branch.departamento || '06').padStart(2, '0');
    let munCode = String(branch.municipio || '01').padStart(2, '0');

    // Validation map for max municipios per dept (Hacienda Catalog)
    const munLimitMap = {
        '01': 19, '02': 13, '03': 16, '04': 22, '05': 33, '06': 16,
        '07': 16, '08': 9, '09': 13, '10': 23, '11': 23, '12': 20,
        '13': 26, '14': 18
    };

    const maxMun = munLimitMap[deptCode] || 99;
    if (parseInt(munCode) > maxMun) {
        const isTest = company.ambiente !== 'produccion';
        console.warn(`[DTE-API] Municipio inválido ${munCode} para departamento ${deptCode}.`);
        if (isTest) {
            console.warn(`[DTE-API] Aplicando fallback a municipio '01' para ambiente de pruebas.`);
            munCode = '01';
        } else {
            throw new Error(`Código de municipio ${munCode} no es válido para el departamento ${deptCode} según Hacienda.`);
        }
    }

    const emisorAdic = payload.emisor_adicional || {};
    const emisor = {
        nit: cleanNumbers(company.nit),
        nrc: cleanNumbers(company.nrc),
        nombre: sanitizeText(company.razon_social),
        codActividad: company.codigo_actividad || '47300',
        descActividad: sanitizeText(emisorAdic.descActividad || company.actividad_economica || 'Actividad no definida'),
        nombreComercial: sanitizeText(company.nombre_comercial || company.razon_social),
        tipoEstablecimiento: branch.tipo_establecimiento || '01',
        direccion: {
            departamento: deptCode,
            municipio: munCode,
            complemento: sanitizeText(branch.direccion || 'Direccion no definida').substring(0, 200)
        },
        telefono: cleanNumbers(branch.telefono || '22222222').substring(0, 30),
        correo: branch.correo || 'emisor@example.com'
    };

    // Estos campos NO van en Nota de Crédito (05)
    if (tipoDte !== '05') {
        emisor.codEstableMH = branch.codigo_mh || null;
        emisor.codEstable = String(branch.codigo || '1').padStart(4, '0');
        emisor.codPuntoVentaMH = emisorAdic.codPuntoVentaMH || null;
        emisor.codPuntoVenta = '0001';
    }

    // 4. Items (Cuerpo Documento) - Mapping strings to codes
    // Mapeo detallado de unidades de medida (Catálogo 014)
    const uniMedidaMap = {
        'unidad': 59,
        'unidades': 59,
        'servicio': 59,
        'kilogramo': 1,
        'kilogramos': 1,
        'libra': 11,
        'libras': 11,
        'onza': 12,
        'onzas': 12,
        'litro': 2,
        'litros': 2,
        'galon': 55,
        'galones': 55,
        'metro': 3,
        'metros': 3,
        'pulgada': 19,
        'pulgadas': 19,
        'pie': 17,
        'pies': 17,
        'yarda': 18,
        'yardas': 18
    };

    const corpoItems = items.map((item, index) => {
        const calcItem = calculateItem(item, tipoDte);
        
        // Detectar galones para combustible automáticamente si la descripción lo sugiere
        const desc = (item.descripcion || '').toLowerCase();
        let defaultUni = 59;
        if (desc.includes('gasolin') || desc.includes('diesel') || desc.includes('combust')) {
            defaultUni = 55; // Galones (común en El Salvador para combustible)
        }

        const uniMedida = typeof item.unidad_medida === 'number' 
            ? item.unidad_medida 
            : (uniMedidaMap[(item.unidad_medida || '').toLowerCase()] || defaultUni);

        // Asegurar que los tributos sean un arreglo de STRINGS (códigos) para el cuerpo del documento
        let itemTributos = item.tributos || (item.exento ? [] : ["20"]);
        if (Array.isArray(itemTributos)) {
            // Filtrar y limpiar para evitar "VALOR NO VALIDO"
            itemTributos = itemTributos
                .map(t => typeof t === 'object' ? t.codigo : String(t))
                .filter(t => t && t !== 'null' && t !== 'undefined' && t.trim() !== '');
            
            // ESPECIAL COMBUSTIBLES DTE 03: FOVIAL (D1) y COTRANS (C8) NO van en el cuerpoDocumento, solo IVA
            if (tipoDte === '03' || tipoDte === '05') {
                itemTributos = itemTributos.filter(t => t !== 'D1' && t !== 'C8');
                if (itemTributos.length === 0 && (item.tipoItem === 1 || !item.tipoItem)) {
                    itemTributos = ["20"];
                }
            }

            // Eliminar duplicados
            itemTributos = [...new Set(itemTributos)];
        }

        const relatedDoc = (payload.documentoRelacionado && payload.documentoRelacionado.length > 0)
            ? payload.documentoRelacionado[0].numeroDocumento
            : ".";

        const baseItem = {
            numItem: index + 1,
            tipoItem: item.tipoItem || 1, // 1: Gravada
            numeroDocumento: item.referencedDoc || (tipoDte === '05' ? relatedDoc : null),
            cantidad: round4(item.cantidad),
            codigo: item.codigo || `P-${index + 1}`,
            codTributo: item.codTributo || null,
            uniMedida: uniMedida,
            descripcion: sanitizeText(item.descripcion),
            precioUni: round6(calcItem.precioUnitario),
            montoDescu: round(calcItem.montoDescu),
            ventaNoSuj: round(calcItem.ventaNoSuj),
            ventaExenta: round(calcItem.ventaExenta),
            ventaGravada: round(calcItem.ventaGravada),
            tributos: (tipoDte === '04') ? null : ((tipoDte === '03' || tipoDte === '05') ? itemTributos : (item.tipoItem === 1 ? null : itemTributos))
        };

        if (tipoDte !== '05' && tipoDte !== '04') {
            baseItem.psv = 0;
            baseItem.noGravado = 0;
        }

        if (tipoDte === '01' || tipoDte === '03') {
            baseItem.ivaItem = round6(calcItem.ivaItem || 0);
        }

        return baseItem;
    });

    // 5. Resumen
    // FILTRO CRÍTICO: Para El Salvador, FOVIAL (D1) y COTRANS (C8) usualmente NO se reportan 
    // como tributos separados en el resumen para evitar errores de cuadre (099) en Hacienda.
    // Se absorben en la base gravada o se omiten si el POS ya los descuenta.
    const filteredTaxes = (payload.taxes || []).filter(t => t && t.codigo !== 'D1' && t.codigo !== 'C8');
    const calculatedItems = items.map(item => calculateItem(item, tipoDte));
    const totals = calculateTotals(calculatedItems, filteredTaxes, tipoDte);
    
    // No calculamos totales de fovial/cotran para el resumen oficial (se mantienen en el POS/DB interna)
    let totalFovial = 0;
    let totalCotran = 0;
    
    // Payments mapping
    const pagos = (payload.pagos || [
        {
            codigo: '01', // Efectivo
            monto: totals.totalPagar,
            referencia: null,
            plazo: null,
            periodo: null
        }
    ]).map(p => ({
        codigo: p.codigo,
        montoPago: round(p.monto || p.montoPago || totals.totalPagar),
        referencia: p.referencia || null,
        plazo: p.plazo || null,
        periodo: p.periodo || null
    }));

    const buildResumen = (type) => {
        const base = {
            totalNoSuj: totals.totalNoSuj,
            totalExenta: totals.totalExenta,
            totalGravada: totals.totalGravada,
            subTotalVentas: totals.subTotalVentas,
            descuNoSuj: 0,
            descuExenta: 0,
            descuGravada: 0,
            porcentajeDescuento: 0,
            totalDescu: totals.totalDescu,
            tributos: (() => {
                const isFactura = type === '01';
                if (isFactura) return []; // Factura 01 NO lleva tributos en el array del resumen

                // Para Crédito Fiscal y otros (03, 05, etc.)
                let taxes = [];
                
                // Asegurar IVA si hay monto gravado
                if (totals.montoPorIVA > 0) {
                    taxes.push({
                        codigo: '20',
                        descripcion: 'Impuesto al Valor Agregado 13%',
                        valor: round(totals.montoPorIVA)
                    });
                }
                
                // Solo añadir otros impuestos si NO son FOVIAL/COTRANS y vienen en el payload original
                const extraTaxes = (payload.taxes || []).filter(t => t && t.codigo !== '20' && t.codigo !== 'D1' && t.codigo !== 'C8');
                extraTaxes.forEach(t => {
                    taxes.push({
                        codigo: t.codigo,
                        descripcion: t.descripcion || `Impuesto ${t.codigo}`,
                        valor: round(parseFloat(t.valor) || 0)
                    });
                });

                return taxes;
            })(),
            subTotal: totals.subTotal,
            ivaRete1: 0,
            reteRenta: 0,
            montoTotalOperacion: totals.totalPagar,
            totalNoGravado: 0,
            totalPagar: totals.totalPagar,
            totalLetras: getAmountInWords(totals.totalPagar),
            saldoFavor: 0,
            condicionOperacion: (type === '04') ? null : parseInt(payload.condicionOperacion || 1),
            pagos: (() => {
                // CORRECCIÓN: Asegurar que el el pago sume exactamente el totalPagar
                if (pagos.length === 1) {
                    pagos[0].montoPago = totals.totalPagar;
                } else if (pagos.length > 1) {
                    let currentSum = 0;
                    for (let i = 0; i < pagos.length - 1; i++) {
                        currentSum = round(currentSum + pagos[i].montoPago);
                    }
                    pagos[pagos.length - 1].montoPago = round(totals.totalPagar - currentSum);
                }
                return pagos;
            })(),
            numPagoElectronico: null
        };

        if (type === '01') {
            base.totalIva = totals.montoPorIVA;
            base.saldoFavor = 0;
            base.numPagoElectronico = null;
        } else if (type === '03') {
            base.ivaPerci1 = 0;
            base.ivaRete1 = 0;
            base.saldoFavor = 0;
            base.numPagoElectronico = null;
        } else if (type === '05') {
            // Nota de Crédito es muy estricta, remover campos no permitidos
            delete base.porcentajeDescuento;
            delete base.totalNoGravado;
            delete base.totalPagar;
            delete base.saldoFavor;
            delete base.pagos;
            delete base.numPagoElectronico;
            base.ivaPerci1 = 0;
            base.ivaRete1 = 0;
        } else if (type === '04') {
            // Nota de Remisión es muy básica
            delete base.pagos;
            delete base.numPagoElectronico;
            delete base.saldoFavor;
            delete base.totalPagar;
            delete base.totalNoGravado;
            delete base.ivaRete1;
            delete base.reteRenta;
            delete base.condicionOperacion;
            base.totalLetras = getAmountInWords(totals.totalPagar);
        }
        return base;
    };

    const resumen = buildResumen(tipoDte);

    const docTypeMap = {
        'DUI': '13',
        'NIT': '36',
        'PASAPORTE': '03',
        'CARNET RESIDENT': '02',
        'CARNET RESIDENTE': '02',
        'OTRO': '37',
        '13': '13',
        '36': '36',
        '03': '03',
        '02': '02',
        '37': '37'
    };

    let rawDepto = String(receptor.direccion?.departamento || '06').replace(/\D/g, '').slice(-2).padStart(2, '0');
    let rawMuni = String(receptor.direccion?.municipio || '01').replace(/\D/g, '').slice(-2).padStart(2, '0');
    
    // Solo asegurar que no sean '00'
    if (rawDepto === '00' || parseInt(rawDepto) > 14) rawDepto = '06';
    if (rawMuni === '00') rawMuni = '01';

    let finalReceptor = {
        nombre: sanitizeText(receptor.nombre || 'Consumidor Final').substring(0, 250),
        codActividad: receptor.codActividad || '10005',
        descActividad: sanitizeText(receptor.descActividad || 'Otros'),
        direccion: {
            departamento: rawDepto,
            municipio: rawMuni,
            complemento: sanitizeText(receptor.direccion?.complemento || 'Direccion de entrega').substring(0, 200).padEnd(5, '.')
        },
        telefono: cleanNumbers(receptor.telefono || '00000000').substring(0, 30),
        correo: receptor.correo || 'receptor@example.com'
    };

    if (tipoDte === '04') {
        finalReceptor.bienTitulo = payload.bienTitulo || '01'; // 01: Venta/Traslado dominio
        finalReceptor.codActividad = receptor.codActividad || '10005';
        finalReceptor.descActividad = sanitizeText(receptor.descActividad || 'Otros');
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || finalReceptor.nombre;
    }

    if (tipoDte === '01' || tipoDte === '04' || (tipoDte === '05' && !receptor.nit)) {
        const rawDocType = (receptor.tipoDocumento || (receptor.nit ? '36' : '36')).toUpperCase();
        finalReceptor.tipoDocumento = docTypeMap[rawDocType] || '36';
        let rawNumDoc = cleanNumbers(receptor.numDocumento || receptor.nit || '000000000');
        if (finalReceptor.tipoDocumento === '13' && rawNumDoc.length === 9) {
            rawNumDoc = `${rawNumDoc.slice(0, 8)}-${rawNumDoc.slice(8)}`;
        }
        finalReceptor.numDocumento = rawNumDoc;
        finalReceptor.nrc = receptor.nrc ? cleanNumbers(receptor.nrc) : null; 
    } else {
        finalReceptor.nit = cleanNumbers(receptor.nit);
        finalReceptor.nrc = cleanNumbers(receptor.nrc);
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || null;
    }

    // 7. Final DTE Object
    const dte = {
        identificacion,
        documentoRelacionado: (payload.documentoRelacionado && payload.documentoRelacionado.length > 0) ? payload.documentoRelacionado : null,
        emisor,
        receptor: finalReceptor,
        otrosDocumentos: null,
        ventaTercero: null,
        cuerpoDocumento: corpoItems,
        resumen,
        extension: tipoDte === '01' || tipoDte === '04' ? {
            nombEntrega: 'EMISOR-01',
            docuEntrega: '00000000-0',
            nombRecibe: 'RECEPTOR-01',
            docuRecibe: '00000000-0',
            observaciones: sanitizeText(payload.transporter_name ? `Transporte: ${payload.transporter_name} / Placa: ${payload.vehicle_plate}` : '---'),
        } : null,
        apendice: null
    };

    // Sección de Transporte para Nota de Remisión (04)
    // REMOVIDO: El esquema local fe-nr-v3.json NO permite la propiedad 'transporte' a nivel raíz
    /*
    if (tipoDte === '04') {
        dte.transporte = {
            nombreChofer: sanitizeText(payload.transporter_name || 'CHOFER GENERICO').substring(0, 100),
            documentoChofer: '00000000-0',
            placaVehiculo: cleanNumbers(payload.vehicle_plate || 'P000000').substring(0, 10),
            tipoTransporte: '01'
        };
    }
    */

    if (tipoDte === '05' || tipoDte === '04') {
        delete dte.otrosDocumentos;
    }

    // 8. Validate
    const validationResult = validateDTE(tipoDte, dte);
    if (!validationResult.success) {
        console.error('Schema Validation Errors for DTE type', tipoDte, ':', JSON.stringify(validationResult.errors, null, 2));
        console.error('Generated DTE with errors:', JSON.stringify(dte, null, 2));
        const error = new Error('Validación de esquema falló');
        error.details = validationResult.errors;
        error.dte = dte;
        throw error;
    }

    return dte;
}

module.exports = { generateDTE };
