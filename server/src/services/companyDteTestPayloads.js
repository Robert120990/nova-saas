/**
 * Company DTE Test Payloads & Catalog
 * Contains test data generators for accreditation against Ministerio de Hacienda.
 */

const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const TEST_CATALOG = [
    { key: '01', code: '01', name: 'Factura', required: 90, isMandatory: true, category: 'dte' },
    { key: '03', code: '03', name: 'Comprobante de Crédito Fiscal', required: 75, isMandatory: true, category: 'dte' },
    { key: '05', code: '05', name: 'Nota de Crédito', required: 50, isMandatory: true, category: 'dte' },
    { key: '04', code: '04', name: 'Nota de Remisión', required: 50, isMandatory: false, category: 'dte' },
    { key: '11', code: '11', name: 'Factura de Exportación', required: 90, isMandatory: false, category: 'dte' },
    { key: '07', code: '07', name: 'Comprobante de Retención', required: 50, isMandatory: false, category: 'dte' },
    { key: '06', code: '06', name: 'Nota de Débito', required: 25, isMandatory: false, category: 'dte' },
    { key: '14', code: '14', name: 'Factura de Sujeto Excluido', required: 25, isMandatory: false, category: 'dte' },
    { key: '09', code: '09', name: 'Documento Contable de Liquidación', required: 50, isMandatory: false, category: 'dte' },
    { key: '08', code: '08', name: 'Comprobante de Liquidación', required: 75, isMandatory: false, category: 'dte' },
    { key: '15', code: '15', name: 'Comprobante de Donación', required: 25, isMandatory: false, category: 'dte' },
    { key: 'invalidacion', code: '16', name: 'Evento de Invalidación', required: 5, isMandatory: false, category: 'evento' },
    { key: 'contingencia', code: '19', name: 'Evento de Contingencia', required: 5, isMandatory: false, category: 'evento' },
    { key: 'retorno', code: '18', name: 'Evento de Retorno (ERET)', required: 5, isMandatory: false, category: 'evento' },
    { key: 'operaciones_especiales', code: '17', name: 'Evento de Operaciones Especiales (EOP)', required: 5, isMandatory: false, category: 'evento' }
];

async function buildTestPayload(type, company, branch) {
    const cleanNit = (company.nit || '06140101901011').replace(/\D/g, '');
    const cleanNrc = (company.nrc || '1234567').replace(/\D/g, '');
    const baseAddr = {
        departamento: branch.departamento || '06',
        municipio: branch.municipio || '23',
        distrito: branch.distrito || '14',
        complemento: (branch.direccion || 'Dirección de prueba y certificación MH').padEnd(10, '.')
    };

    const contribuyenteReceptor = {
        nit: '04122704931010',
        nrc: '3128476',
        nombre: 'AGUILAR CESENA GABRIEL ANTONIO',
        codActividad: '10001',
        descActividad: 'Servicios de comercio y certificación',
        correo: 'pruebas@mh.gob.sv',
        telefono: '22222222',
        direccion: baseAddr
    };

    if (type === '01') {
        return buildFacturaPayload(company, branch, cleanNit, baseAddr);
    }
    if (type === '03') {
        return {
            tipoDte: '03',
            condicionOperacion: 1,
            items: [{
                descripcion: 'SERVICIO DE PRUEBA DE ACREDITACION CREDITO FISCAL',
                codigo: 'TEST-CCF-03',
                cantidad: 1,
                precio_unitario: 10.00,
                tipoItem: 1,
                exento: false,
                tributos: ['20']
            }],
            receptor: contribuyenteReceptor,
            pagos: [{ codigo: '01', monto: 11.30 }]
        };
    }
    if (type === '05' || type === '06') {
        const [related] = await pool.query(
            'SELECT codigo_generacion, tipo_dte, DATE_FORMAT(created_at, "%Y-%m-%d") as fecha FROM dtes WHERE company_id = ? AND tipo_dte = "03" AND status = "ACCEPTED" ORDER BY id DESC LIMIT 1',
            [company.id]
        );
        const todaySv = new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
        const relDoc = related[0] || {
            codigo_generacion: uuidv4().toUpperCase(),
            tipo_dte: '03',
            fecha: todaySv
        };
        return {
            tipoDte: type,
            condicionOperacion: 1,
            documentoRelacionado: [{
                tipoDocumento: '03',
                tipoGeneracion: 1,
                numeroDocumento: relDoc.codigo_generacion,
                fechaEmision: relDoc.fecha || todaySv
            }],
            items: [{
                descripcion: `AJUSTE POR PRUEBA DE ACREDITACION ${type === '05' ? 'NOTA DE CREDITO' : 'NOTA DE DEBITO'}`,
                codigo: `TEST-${type}`,
                cantidad: 1,
                precio_unitario: 5.00,
                referencedDoc: relDoc.codigo_generacion,
                tipoItem: 1,
                exento: false,
                tributos: ['20']
            }],
            receptor: contribuyenteReceptor,
            pagos: [{ codigo: '01', monto: 5.65 }]
        };
    }
    if (type === '04') {
        return {
            tipoDte: '04',
            bienTitulo: '02',
            items: [{
                descripcion: 'TRASLADO DE BIENES DE PRUEBA NOTA DE REMISION',
                codigo: 'TEST-04',
                cantidad: 1,
                precio_unitario: 0,
                tipoItem: 1,
                exento: true
            }],
            receptor: {
                tipoDocumento: '36',
                numDocumento: '04122704931010',
                nrc: '3128476',
                nombre: 'DESTINATARIO PRUEBA TRASLADO',
                correo: 'pruebas@mh.gob.sv',
                telefono: '22222222',
                bienTitulo: '02',
                codActividad: '10005',
                descActividad: 'Otros',
                direccion: baseAddr
            }
        };
    }
    if (type === '11') {
        return {
            tipoDte: '11',
            condicionOperacion: 1,
            exportacion: {
                tipoItemExpor: 1,
                recintoFiscal: '00',
                tipoRegimen: 'EX-1',
                codPaisDestino: 'US',
                incoterms: '01',
                descIncoterms: 'EXW-En fabrica',
                flete: 0,
                seguro: 0,
                observaciones: 'Prueba de acreditación de exportación MH'
            },
            items: [{
                descripcion: 'PRODUCTO DE PRUEBA EXPORTACION',
                codigo: 'TEST-11',
                cantidad: 1,
                precio_unitario: 50.00,
                tipoItem: 1
            }],
            receptor: {
                nombre: 'FOREIGN IMPORTER TEST INC',
                pais: 'US',
                tipo_persona: 1,
                tipoDocumento: '37',
                numDocumento: 'US12345678',
                correo: 'importer@test.com',
                telefono: '18005550199',
                direccion: { complemento: '100 Innovation Way, Suite 200, Miami, FL' }
            },
            pagos: [{ codigo: '01', monto: 50.00 }]
        };
    }
    if (type === '07') {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
        return {
            tipoDte: '07',
            receptor: {
                tipoDocumento: '36',
                numDocumento: '04122704931010',
                nrc: '3128476',
                nombre: 'AGUILAR CESENA GABRIEL ANTONIO',
                codActividad: '10001',
                descActividad: 'Servicios de comercio y certificación',
                correo: 'pruebas@mh.gob.sv',
                telefono: '22222222',
                direccion: baseAddr
            },
            items: [{
                tipoDte: '03',
                tipoGeneracion: 1,
                numDocumento: uuidv4().toUpperCase(),
                fechaEmision: today,
                montoSujetoGrav: 100.00,
                codigoRetencionMH: '22',
                ivaRetenido: 1.00,
                descripcion: 'RETENCION 1% PRUEBA ACREDITACION MH'
            }]
        };
    }

    // Fallback genérico para otros tipos (Factura)
    return buildFacturaPayload(company, branch, cleanNit, baseAddr);
}

function buildFacturaPayload(company, branch, cleanNit, baseAddr) {
    return {
        tipoDte: '01',
        condicionOperacion: 1,
        items: [{
            descripcion: 'PRODUCTO PRUEBA CERTIFICACION FACTURA',
            codigo: 'TEST-01',
            cantidad: 1,
            precio_unitario: 5.00,
            tipoItem: 1,
            exento: false,
            tributos: null
        }],
        receptor: {
            nombre: 'CONSUMIDOR FINAL PRUEBAS',
            correo: 'pruebas@mh.gob.sv',
            telefono: '22222222',
            direccion: baseAddr || {
                departamento: branch.departamento || '06',
                municipio: branch.municipio || '23',
                distrito: branch.distrito || '14',
                complemento: 'Colonia Médica, Calle Los Sisimiles'
            }
        },
        pagos: [{ codigo: '01', monto: 5.00 }]
    };
}

module.exports = {
    TEST_CATALOG,
    buildTestPayload,
    buildFacturaPayload
};
