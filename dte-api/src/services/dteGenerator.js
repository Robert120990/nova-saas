/**
 * DTE Generator Service
 */

const { v4: uuidv4 } = require('uuid');
const { generateControlNumber } = require('./dte/controlNumberService');
const { calculateItem, calculateTotals, round, round4, round6, getAmountInWords } = require('../utils/calculations');
const { sanitizeText, cleanNumbers } = require('../utils/text');

function sanitizeNrc(value) {
    const clean = cleanNumbers(value || '');
    return /^\d{6,10}$/.test(clean) ? clean : null;
}
const { validateDTE } = require('../validators/schemaValidator');
const { getSchemaVersion } = require('../utils/versionMap');
const { getMHAmbiente } = require('../config/haciendaConfig');
const pool = require('../../config/db');

/**
 * Resuelve el código MH de país y su nombre consultando cat_020_pais.
 * Busca coincidencia exacta por code, luego por descripción, y si no encuentra
 * devuelve el primer código válido de la tabla.
 * Retorna { code, name }.
 */
async function resolveCountryCode(rawInput) {
    if (!rawInput) {
        // Sin entrada: devolver el primer código disponible
        const [rows] = await pool.query('SELECT code, description FROM cat_020_pais LIMIT 1');
        if (rows.length > 0) return { code: rows[0].code, name: rows[0].description };
        return { code: '9320', name: 'ESTADOS UNIDOS' };
    }

    const input = String(rawInput).trim();

    // 1. Coincidencia exacta por code
    const [byCode] = await pool.query('SELECT code, description FROM cat_020_pais WHERE code = ?', [input]);
    if (byCode.length > 0) return { code: byCode[0].code, name: byCode[0].description };

    // 2. Coincidencia por descripción (case-insensitive)
    const [byDesc] = await pool.query(
        'SELECT code, description FROM cat_020_pais WHERE LOWER(description) LIKE ?',
        [`%${input.toLowerCase()}%`]
    );
    if (byDesc.length > 0) {
        console.warn(`[DTE-API] País "${input}" resuelto como "${byDesc[0].code}" (${byDesc[0].description})`);
        return { code: byDesc[0].code, name: byDesc[0].description };
    }

    // 3. Fallback: primer código MH (4 dígitos) de la tabla
    const [first] = await pool.query(
        "SELECT code, description FROM cat_020_pais WHERE code REGEXP '^[0-9]{4}$' LIMIT 1"
    );
    if (first.length > 0) {
        console.warn(`[DTE-API] País "${input}" no encontrado en cat_020_pais, usando fallback "${first[0].code}"`);
        return { code: first[0].code, name: first[0].description };
    }

    console.warn(`[DTE-API] Sin códigos MH de 4 dígitos en cat_020_pais, usando fallback absoluto "9320"`);
    return { code: '9320', name: 'ESTADOS UNIDOS' };
}

// CR (07): totales específicos para comprobante de retención
function calculateTotalsCR(items) {
    let totalSujeto = 0;
    let totalIva = 0;
    items.forEach(item => {
        totalSujeto += parseFloat(item.montoSujetoGrav) || 0;
        totalIva += parseFloat(item.ivaRetenido) || 0;
    });
    return {
        totalSujetoRetencion: round(totalSujeto),
        totalIVAretenido: round(totalIva),
        totalIVAretenidoLetras: getAmountInWords(round(totalIva))
    };
}

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

    // Obtener configuración de impuestos
    const [taxRows] = await pool.query('SELECT iva_rate FROM tax_configurations WHERE company_id = ?', [companyId]);
    const ivaRate = taxRows.length > 0 ? parseFloat(taxRows[0].iva_rate) : 13;

    // Verificar contingencia activa
    const [contRows] = await pool.query(
        'SELECT id, tipo_contingencia, motivo FROM dte_contingencies WHERE company_id = ? AND estado = ? LIMIT 1',
        [companyId, 'OPEN']
    );
    const activeContingency = contRows.length > 0 ? contRows[0] : null;

    // 2. Generate Identificacion
    const codigoGeneracion = uuidv4().toUpperCase();
    const emisorAdic = payload.emisor_adicional || {};
    const codPuntoVentaMH = emisorAdic.codPuntoVentaMH || '001';
    const controlResult = await generateControlNumber(
        tipoDte,
        companyId,
        branch.tipo_establecimiento || '01',
        branch.codigo_mh || String(branch.codigo || '1'),
        codPuntoVentaMH
    );
    const numeroControl = controlResult.numero_control;
    const now = new Date();
    // Force El Salvador timezone for Hacienda compliance
    const fecEmi = now.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
    const horEmi = now.toLocaleTimeString('en-GB', { timeZone: 'America/El_Salvador' }).substring(0, 8);

    // Versioning according to Normativa V2.0 (2026)
    const version = getSchemaVersion(tipoDte);

    const identificacion = {
        version: version,
        ambiente: getMHAmbiente(branch.ambiente || company.ambiente),
        tipoDte: tipoDte,
        numeroControl: numeroControl,
        codigoGeneracion: codigoGeneracion,
        tipoModelo: activeContingency ? 2 : 1,
        tipoOperacion: activeContingency ? 2 : 1,
        tipoContingencia: activeContingency ? activeContingency.tipo_contingencia : null,
        motivoContin: null,
        fecEmi: fecEmi,
        horEmi: horEmi,
        tipoMoneda: 'USD',
        ...identificacionExtra
    };

    // Si hay contingencia activa y tipo=5, poner motivo
    if (activeContingency && activeContingency.tipo_contingencia === 5) {
        identificacion.motivoContin = activeContingency.motivo || 'Contingencia';
    }

    // FEX usa "motivoContigencia", los demás usan "motivoContin"
    if (tipoDte === '11') {
        identificacion.motivoContigencia = identificacion.motivoContin;
        delete identificacion.motivoContin;
    }

    // NC (05): fusion requerida por schema v4
    if (tipoDte === '05') {
        identificacion.fusion = null;
    }

    // 3. Emisor - Validating and padding address codes
    const deptCode = String(branch.departamento || '06').padStart(2, '0');
    const munCode = String(branch.municipio || '01').padStart(2, '0');

    const distritoEmisor = emisorAdic.distrito || branch.distrito;
    if (!distritoEmisor) {
        throw new Error(`La sucursal "${branch.nombre || branch.codigo}" no tiene un distrito asignado. Asigne un distrito antes de emitir el DTE.`);
    }
    if (!/^\d+$/.test(distritoEmisor)) {
        throw new Error(`La sucursal "${branch.nombre || branch.codigo}" tiene un distrito inválido: "${distritoEmisor}". Debe ser un código numérico del catálogo CAT-008 (ej. 13 para San Martín).`);
    }

    const emisor = {
        nit: cleanNumbers(company.nit),
        nrc: cleanNumbers(company.nrc),
        nombre: sanitizeText(company.razon_social),
        codActividad: company.codigo_actividad || '47300',
        descActividad: sanitizeText(emisorAdic.descActividad || company.actividad_economica || 'Actividad no definida'),
        nombreComercial: sanitizeText(company.nombre_comercial || company.razon_social),
        direccion: {
            departamento: deptCode,
            municipio: munCode,
            distrito: String(distritoEmisor).padStart(2, '0'),
            complemento: sanitizeText(branch.direccion || 'Direccion no definida').substring(0, 200)
        },
        telefono: cleanNumbers(branch.telefono || '22222222').substring(0, 30),
        correo: branch.correo || 'emisor@example.com'
    };

    // Estos campos NO van en Nota de Crédito (05) ni en CR (07)
    if (tipoDte !== '05' && tipoDte !== '07') {
        emisor.codEstable = (branch.codigo_mh || String(branch.codigo || '1')).padStart(4, '0');
        emisor.codPuntoVenta = String(codPuntoVentaMH || '0001').padStart(4, '0');
    }

    // CR (07): usa campos con nombres diferentes
    if (tipoDte === '07') {
        emisor.codigoMH = branch.codigo_mh || null;
        emisor.codigo = String(branch.codigo || '1').padStart(4, '0');
        emisor.puntoVentaMH = emisorAdic.codPuntoVentaMH || null;
        emisor.puntoVenta = '0001';
    }

    // FEX: agregar campos requeridos por Hacienda en el emisor
    if (tipoDte === '11') {
        const expData = payload.exportacion || {};
        emisor.tipoItemExpor = expData.tipoItemExpor || 3;
        emisor.recintoFiscal = expData.recintoFiscal || null;
        emisor.tipoRegimen = expData.tipoRegimen || null;
        emisor.regimen = expData.regimen || null;
    }

    // 4. Items (Cuerpo Documento)
    // --- CR (07) manejo especial: items son referencias a documentos con retención ---
    let corpoItems;
    let totals;
    let pagos;
    let resumenTaxes = [];

    if (tipoDte === '07') {
        corpoItems = (items || []).map((item, index) => ({
            numItem: index + 1,
            tipoDte: String(item.tipoDte || item.docType || item.doc_type || '03'),
            tipoDoc: parseInt(item.tipoDoc) || 1,
            numDocumento: String(item.numDocumento || item.docNumber || item.doc_number || item.numeroDocumento || ''),
            fechaEmision: item.fechaEmision || item.emissionDate || item.emission_date || item.fecEmi || '',
            montoSujetoGrav: round(parseFloat(item.montoSujetoGrav || item.montoSujeto || item.ventaGravada || 0)),
            codigoRetencionMH: String(item.codigoRetencionMH || item.codigoRetencion || '22'),
            ivaRetenido: round(parseFloat(item.ivaRetenido || 0)),
            descripcion: sanitizeText(item.descripcion || `RETENCION AL DOCUMENTO ${item.numDocumento || item.docNumber || item.doc_number || ''}`)
        }));
        totals = calculateTotalsCR(corpoItems);
        pagos = [];
    } else {
        // --- Standard items mapping para todos los demás DTEs ---
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

    corpoItems = items.map((item, index) => {
        const calcItem = calculateItem(item, tipoDte, ivaRate);
        
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

            // FOVIAL (D1) y COTRANS (C8) SI van en el cuerpoDocumento (consistente con el resumen)
            // Hacienda rechaza con "ERROR NO CATALOGADO" si el resumen los declara y el ítem no.

            // Eliminar duplicados
            itemTributos = [...new Set(itemTributos)];
        }

        // Ítem gravado: asegurar que el IVA (20) esté declarado en los tributos del ítem
        // Usar el valor calculado (calcItem) — el payload puede omitir venta_gravada (ver dte.service.js)
        if (!item.exento && itemTributos.length > 0 && !itemTributos.includes('20') &&
            parseFloat(calcItem.ventaGravada || 0) > 0) {
            itemTributos = ['20', ...itemTributos];
        }

        // Ítem gravado sin tributos: el esquema exige mínimo 1 (minItems) — forzar IVA
        if (!item.exento && itemTributos.length === 0) {
            itemTributos = ['20'];
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
            tributos: (tipoDte === '04' || tipoDte === '11') ? null : ((tipoDte === '03' || tipoDte === '05') ? itemTributos : (item.tipoItem === 1 ? null : itemTributos))
        };

        if (tipoDte === '11') {
            // FEX: solo estos campos van en el cuerpo (según JSON aceptado por Hacienda)
            delete baseItem.tipoItem;
            delete baseItem.numeroDocumento;
            delete baseItem.codTributo;
            delete baseItem.ventaNoSuj;
            delete baseItem.ventaExenta;
            baseItem.noGravado = 0;
        } else if (tipoDte !== '05' && tipoDte !== '04') {
            baseItem.psv = 0;
            baseItem.noGravado = 0;
        }

        if (tipoDte === '01') {
            baseItem.ivaItem = round6(calcItem.ivaItem || 0);
        }

        return baseItem;
    });
        } // Fin del else (tipoDte !== '07')

    // 5. Resumen
    if (tipoDte !== '07') {
    const calculatedItems = items.map(item => calculateItem(item, tipoDte));
    
    // Para Crédito Fiscal (03) y Nota de Crédito (05) con combustible, FOVIAL (D1) y COTRANS (C8)
    // se reportan como tributos del resumen. Ya se quitaron del precio en calculateItem (base + IVA
    // correctos) y aquí se suman al total, de modo que totalPagar = base + IVA + FOVIAL + COTRANS.
    // En los demás DTEs (01, 04, 11) se mantienen fuera del resumen oficial.
    const taxMap = {};
    (payload.taxes || []).forEach(t => {
        if (t && t.codigo) taxMap[t.codigo] = t;
    });
    const itemFuelTax = { D1: 0, C8: 0 };
    if (tipoDte === '03' || tipoDte === '05') {
        calculatedItems.forEach(it => {
            (it.tributos || []).forEach(t => {
                if (t && typeof t === 'object') {
                    const v = parseFloat(t.valor) || 0;
                    if (t.codigo === 'D1') itemFuelTax.D1 += v;
                    else if (t.codigo === 'C8') itemFuelTax.C8 += v;
                }
            });
        });
    }
    resumenTaxes = (payload.taxes || [])
        .filter(t => t && t.codigo && t.codigo !== '20')
        .filter(t => (tipoDte === '03' || tipoDte === '05') || (t.codigo !== 'D1' && t.codigo !== 'C8'));
    // Fallback por ítem (cubre retransmisiones que no envían taxes de cabecera)
    if (tipoDte === '03' || tipoDte === '05') {
        if (!taxMap['D1'] && itemFuelTax.D1 > 0) {
            resumenTaxes.push({ codigo: 'D1', descripcion: 'FEFE (FOVIAL)', valor: round(itemFuelTax.D1) });
        }
        if (!taxMap['C8'] && itemFuelTax.C8 > 0) {
            resumenTaxes.push({ codigo: 'C8', descripcion: 'COTRANS', valor: round(itemFuelTax.C8) });
        }
    }
    totals = calculateTotals(calculatedItems, resumenTaxes, tipoDte);
    
    // Payments mapping
    pagos = (payload.pagos || [
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
    } // Fin del if (tipoDte !== '07')

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
            observaciones: 'Ninguna',
            tributos: (() => {
                const isFactura = type === '01';
                const isFex = type === '11';
                if (isFactura || isFex) return []; // Factura 01 y FEX no llevan tributos en el resumen

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
                
                // Añadir los demás impuestos del resumen (ya incluye D1/C8 para 03/05)
                const extraTaxes = resumenTaxes;
                extraTaxes.forEach(t => {
                    taxes.push({
                        codigo: t.codigo,
                        descripcion: t.descripcion || `Impuesto ${t.codigo}`,
                        valor: round(parseFloat(t.valor) || 0)
                    });
                });

                return taxes;
            })(),
            subTotal: round(totals.subtotal || totals.subTotal || 0),
            montoTotalOperacion: round(totals.totalPagar),
            totalNoGravado: 0,
            totalPagar: round(totals.totalPagar),
            totalLetras: getAmountInWords(totals.totalPagar),
            saldoFavor: 0,
            condicionOperacion: (type === '04' || type === '11') ? null : parseInt(payload.condicionOperacion || 1),
            pagos: (() => {
                if (type === '11') return null;
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
            base.ivaRete = 0;
            base.saldoFavor = 0;
            base.numPagoElectronico = null;
        } else if (type === '03') {
            base.ivaPerci = 0;
            base.ivaRete = 0;
            base.saldoFavor = 0;
            base.numPagoElectronico = null;
        } else if (type === '05') {
            base.ivaPerci = 0;
            base.ivaRete = 0;
            base.codigoRetencionMH = '22';
            base.totalPagar = round(totals.totalPagar);
        } else if (type === '04') {
            // Nota de Remisión es muy básica
            delete base.pagos;
            delete base.numPagoElectronico;
            delete base.saldoFavor;
            delete base.totalPagar;
            delete base.totalNoGravado;
            delete base.ivaRete;
            delete base.reteRenta;
            delete base.condicionOperacion;
            base.totalLetras = getAmountInWords(totals.totalPagar);
        } else if (type === '11') {
            // FEX: estructura real de resumen aceptada por Hacienda
            delete base.totalNoSuj;
            delete base.totalExenta;
            delete base.subTotalVentas;
            delete base.descuNoSuj;
            delete base.descuExenta;
            delete base.descuGravada;
            delete base.subTotal;
            delete base.ivaRete;
            delete base.reteRenta;
            // Campos que sí van en FEX
            base.descuento = round(base.totalDescu || 0);
            base.totalNoGravado = 0;
            base.totalNoOnerosas = 0;
            base.condicionOperacion = parseInt(payload.condicionOperacion || 1);
            base.pagos = pagos;
            base.codIncoterms = (payload.exportacion && payload.exportacion.incoterms) || '01';
            base.descIncoterms = (payload.exportacion && payload.exportacion.descIncoterms) || 'EXW- En fabrica';
            base.flete = round((payload.exportacion && payload.exportacion.flete) || 0);
            base.seguro = round((payload.exportacion && payload.exportacion.seguro) || 0);
            base.observaciones = sanitizeText((payload.exportacion && payload.exportacion.observaciones) || 'Ninguna').substring(0, 3000);
            base.numPagoElectronico = null;
        } else if (type === '07') {
            // CR: estructura del schema v2
            return {
                totalSujetoRetencion: totals.totalSujetoRetencion,
                totalIva: totals.totalIVAretenido,
                totalIvaRetenido: totals.totalIVAretenido,
                totalLetras: totals.totalIVAretenidoLetras,
                observaciones: 'Ninguna'
            };
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

    let rawDistrito = null;
    if (receptor.direccion && receptor.direccion.distrito && !/^\d+$/.test(receptor.direccion.distrito)) {
        throw new Error(`El cliente "${receptor.nombre || 'Consumidor Final'}" tiene un distrito inválido: "${receptor.direccion.distrito}". Debe ser un código numérico del catálogo CAT-008 (ej. 13 para San Martín).`);
    }
    rawDistrito = String(receptor.direccion?.distrito || '01').replace(/\D/g, '').slice(-2).padStart(2, '0');
    if (rawDistrito === '00') rawDistrito = '01';

    let finalReceptor = {
        nombre: sanitizeText(receptor.nombre || 'Consumidor Final').substring(0, 250),
        codActividad: receptor.codActividad || '10005',
        descActividad: sanitizeText(receptor.descActividad || 'Otros'),
        direccion: receptor.direccion ? {
            departamento: rawDepto,
            municipio: rawMuni,
            distrito: rawDistrito,
            complemento: sanitizeText(receptor.direccion.complemento || 'Direccion de entrega').substring(0, 200).padEnd(5, '.')
        } : null,
        telefono: cleanNumbers(receptor.telefono || '00000000').substring(0, 30),
        correo: receptor.correo || 'receptor@example.com'
    };

    if (tipoDte === '07') {
        // CR: estructura de receptor (tipoDocumento/numDocumento en raíz, sin nit)
        finalReceptor.tipoDocumento = docTypeMap[receptor.tipoDocumento] || '36';
        finalReceptor.numDocumento = cleanNumbers(receptor.numDocumento || receptor.nit || '00000000000000');
        finalReceptor.nrc = sanitizeNrc(receptor.nrc);
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || null;
        finalReceptor.codActividad = receptor.codActividad || '10005';
        finalReceptor.descActividad = sanitizeText(receptor.descActividad || 'Otros');
    }

    if (tipoDte === '07') {
        finalReceptor.tipoDocumento = docTypeMap[receptor.tipoDocumento] || '36';
        finalReceptor.numDocumento = cleanNumbers(receptor.numDocumento || receptor.nit || '00000000000000');
        finalReceptor.nrc = sanitizeNrc(receptor.nrc);
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || null;
        finalReceptor.codActividad = receptor.codActividad || '10005';
        finalReceptor.descActividad = sanitizeText(receptor.descActividad || 'Otros');
    }

    if (tipoDte === '11') {
        // FEX: estructura real de receptor aceptada por Hacienda
        const expData = payload.exportacion || {};
        delete finalReceptor.codActividad;
        delete finalReceptor.direccion;
        finalReceptor.tipoPersona = parseInt(receptor.tipo_persona) || 1;
        finalReceptor.tipoDocumento = docTypeMap[receptor.tipoDocumento] || '37';
        // numDocumento: formato NIT sin guiones (14 dígitos) u otro formato
        finalReceptor.numDocumento = cleanNumbers(receptor.numDocumento || receptor.nit || '00000000000000');
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || sanitizeText(receptor.nombre) || null;
        // Obtener código MH del país: primero el del cliente (más fiable), luego el del formulario FEX
        const rawCountryCode = receptor.pais_code || expData.codPaisDestino || '';
        const countryResolved = await resolveCountryCode(rawCountryCode);
        finalReceptor.codPais = countryResolved.code;
        finalReceptor.nombrePais = receptor.pais_name || (countryResolved.code + ' ' + countryResolved.name).trim();
        finalReceptor.complemento = sanitizeText(receptor.direccion?.complemento || 'Direccion de entrega').padEnd(5, '.').substring(0, 300);
        finalReceptor.descActividad = sanitizeText(receptor.descActividad || 'Otros');
    }

    if (tipoDte === '04') {
        finalReceptor.bienTitulo = payload.bienTitulo || '01'; // 01: Venta/Traslado dominio
        finalReceptor.codActividad = receptor.codActividad || '10005';
        finalReceptor.descActividad = sanitizeText(receptor.descActividad || 'Otros');
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || finalReceptor.nombre;
    }

    if (tipoDte !== '11' && tipoDte !== '07' && (tipoDte === '01' || tipoDte === '04' || (tipoDte === '05' && !receptor.nit))) {
        // Consumidor Final sin documento: dejar campos como null
        const isConsumidorFinal = !receptor.nit && !receptor.numDocumento;
        if (isConsumidorFinal && tipoDte === '01') {
            finalReceptor.tipoDocumento = null;
            finalReceptor.numDocumento = null;
            finalReceptor.codActividad = null;
            finalReceptor.descActividad = null;
            finalReceptor.direccion = null;
            finalReceptor.telefono = null;
            finalReceptor.correo = null;
            finalReceptor.nrc = null;
        } else {
        const rawDocType = (receptor.tipoDocumento || (receptor.nit ? '36' : '36')).toUpperCase();
        finalReceptor.tipoDocumento = docTypeMap[rawDocType] || '36';
        let rawNumDoc = cleanNumbers(receptor.numDocumento || receptor.nit || '000000000');
        if (finalReceptor.tipoDocumento === '37' && (!receptor.numDocumento && !receptor.nit)) {
            rawNumDoc = 'SN';
        }
        finalReceptor.numDocumento = rawNumDoc;
        finalReceptor.nrc = sanitizeNrc(receptor.nrc);
        } 
    } else if (tipoDte !== '11' && tipoDte !== '07') {
        finalReceptor.nit = cleanNumbers(receptor.nit || receptor.numDocumento);
        finalReceptor.nrc = sanitizeNrc(receptor.nrc);
        finalReceptor.nombreComercial = sanitizeText(receptor.nombreComercial) || null;
    }

    // 7. Final DTE Object
    const dte = {
        identificacion,
        emisor,
        receptor: finalReceptor,
        cuerpoDocumento: corpoItems,
        resumen,
        apendice: null
    };

    if (tipoDte !== '07') {
        dte.otrosDocumentos = null;
        dte.ventaTercero = null;
    }

    if (tipoDte === '11') {
        dte.compraTercero = null;
    }

    if (tipoDte !== '11' && tipoDte !== '07') {
        dte.documentoRelacionado = (payload.documentoRelacionado && payload.documentoRelacionado.length > 0) ? payload.documentoRelacionado : null;
    }

    if (tipoDte === '11') {
        dte.documentoRelacionado = (payload.documentoRelacionado && payload.documentoRelacionado.length > 0) ? payload.documentoRelacionado : null;
    }

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
