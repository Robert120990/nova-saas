/**
 * DTE Generator Service
 */

const { v4: uuidv4 } = require('uuid');
const { generateControlNumber } = require('./dte/controlNumberService');
const { calculateItem, calculateTotals, round } = require('../utils/calculations');
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
    const controlResult = await generateControlNumber(tipoDte, companyId, branchId, branch.codigo || '001');
    const numeroControl = controlResult.numero_control;
    const now = new Date();
    const fecEmi = now.toISOString().split('T')[0];
    const horEmi = now.toTimeString().split(' ')[0];

    const identificacion = {
        version: 3, // Default version 3 for CCF/Factura
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

    // 3. Emisor
    const emisor = {
        nit: company.nit.replace(/-/g, ''),
        nrc: company.nrc.replace(/-/g, ''),
        nombre: company.razon_social,
        codActividad: company.codigo_actividad || '00000',
        descActividad: company.actividad_economica || 'Actividad no definida',
        nombreComercial: company.nombre_comercial || company.razon_social,
        tipoEstablecimiento: branch.tipo_establecimiento || '01',
        direccion: {
            departamento: branch.departamento || '01',
            municipio: branch.municipio || '01',
            complemento: branch.direccion || 'Dirección no definida'
        },
        telefono: branch.telefono || '00000000',
        correo: branch.correo || 'emisor@example.com',
        codEstableMH: branch.codigo_mh || null,
        codEstable: branch.codigo || '001',
        codPuntoVentaMH: null,
        codPuntoVenta: '001'
    };

    // 4. Items (Cuerpo Documento)
    const corpoItems = items.map((item, index) => {
        const calcItem = calculateItem(item);
        return {
            numItem: index + 1,
            tipoItem: item.tipoItem || 1, // 1: Gravada
            numeroDocumento: null,
            cantidad: round(item.cantidad),
            codigo: item.codigo,
            codTributo: null,
            uniMedida: item.unidad_medida || 'unidad', // TODO: Map this to cat_014
            descripcion: item.descripcion,
            precioUnitario: round(item.precioUnitario),
            montoDescu: round(item.montoDescu || 0),
            ventaNoSuj: round(calcItem.ventaNoSuj),
            ventaExenta: round(calcItem.ventaExenta),
            ventaGravada: round(calcItem.ventaGravada),
            tributos: item.tributos || null, // [ "20" ] for IVA
            psv: 0,
            noGravado: 0,
            ivaItem: round(calcItem.ivaItem)
        };
    });

    // 5. Resumen
    const totals = calculateTotals(corpoItems, payload.taxes || []);
    const resumen = {
        totalNoSuj: totals.totalNoSuj,
        totalExenta: totals.totalExenta,
        totalGravada: totals.totalGravada,
        subTotalVentas: totals.subTotal,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: totals.totalDescu,
        tributos: payload.taxes || null,
        subTotal: totals.subTotal,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: totals.totalPagar,
        totalNoGravado: 0,
        totalPagar: totals.totalPagar,
        totalLetras: payload.totalLetras || '',
        totalIva: totals.montoPorIVA,
        saldoFavor: 0,
        condicionOperacion: 1, // 1: Contado
        pagos: payload.pagos || [
            {
                codigo: '01', // Efectivo
                monto: totals.totalPagar,
                referencia: null,
                plazo: null,
                periodo: null
            }
        ],
        numPagoElectronico: null
    };

    // 6. Final DTE Object
    const dte = {
        identificacion,
        documentoRelacionado: payload.documentoRelacionado || null,
        emisor,
        receptor: {
            nit: receptor.nit ? receptor.nit.replace(/-/g, '') : null,
            nrc: receptor.nrc ? receptor.nrc.replace(/-/g, '') : null,
            nombre: receptor.nombre,
            codActividad: receptor.codActividad || null,
            descActividad: receptor.descActividad || null,
            nombreComercial: receptor.nombreComercial || null,
            direccion: receptor.direccion ? {
                departamento: receptor.direccion.departamento,
                municipio: receptor.direccion.municipio,
                complemento: receptor.direccion.complemento
            } : null,
            telefono: receptor.telefono || null,
            correo: receptor.correo || null,
            tipoDocumento: receptor.tipoDocumento || '36',
            numDocumento: receptor.numDocumento || null
        },
        otrosDocumentos: null,
        ventaTercero: null,
        cuerpoDocumento: corpoItems,
        resumen,
        extension: null,
        apendice: null
    };

    // 7. Validate
    const validationResult = validateDTE(tipoDte, dte);
    if (!validationResult.success) {
        // Throw or return validation errors
        const error = new Error('Validación de esquema falló');
        error.details = validationResult.errors;
        throw error;
    }

    return dte;
}

module.exports = { generateDTE };
