const { validateDTE, initValidators } = require('../src/validators/schemaValidator');

// Simulating a DTE with 39.55
const mockDte = {
    identificacion: {
        version: 1,
        ambiente: '00',
        tipoDte: '01',
        numeroControl: 'DTE-01-S001P001-000000000000001',
        codigoGeneracion: '1AC4FF16-9FD4-4093-8165-4C5C76D059EB',
        tipoModelo: 1,
        tipoOperacion: 1,
        tipoContingencia: null,
        motivoContin: null,
        fecEmi: '2026-04-10',
        horEmi: '19:59:15',
        tipoMoneda: 'USD'
    },
    documentoRelacionado: null,
    emisor: {
        nit: '06142701141033',
        nrc: '2303606',
        nombre: 'Inversiones Lil, S,A, de C,V.',
        codActividad: '47300',
        descActividad: 'Actividad no definida',
        nombreComercial: 'Puma San Martin II',
        tipoEstablecimiento: '02',
        direccion: { departamento: '01', municipio: '12', complemento: 'San Martin' },
        telefono: '22222222',
        correo: 'central@empresa.com',
        codEstableMH: 'S001',
        codEstable: '0001',
        codPuntoVentaMH: null,
        codPuntoVenta: '0001'
    },
    receptor: {
        nombre: 'PUBLICO GENERAL',
        codActividad: '10005',
        descActividad: 'Otros',
        direccion: { departamento: '01', municipio: '12', complemento: 'San Martin' },
        telefono: '00000000',
        correo: 'receptor@example.com',
        tipoDocumento: '37',
        numDocumento: '000000000'
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: [{
        numItem: 1,
        tipoItem: 1,
        numeroDocumento: null,
        cantidad: 1,
        codigo: 'P-1',
        codTributo: null,
        uniMedida: 59,
        descripcion: 'Test',
        precioUni: 35,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: 35,
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem: 4.55
    }],
    resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: 35,
        subTotalVentas: 35,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: 0,
        tributos: [],
        subTotal: 35,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: 39.55,
        totalNoGravado: 0,
        totalPagar: 39.55,
        totalLetras: '---',
        saldoFavor: 0,
        condicionOperacion: 1,
        pagos: [{ codigo: '01', montoPago: 39.55, referencia: null, plazo: null, periodo: null }],
        numPagoElectronico: null,
        totalIva: 4.55
    },
    extension: {
        nombEntrega: 'EMISOR-01',
        docuEntrega: '00000000-0',
        nombRecibe: 'RECEPTOR-01',
        docuRecibe: '00000000-0',
        observaciones: '---',
        placaVehiculo: null
    },
    apendice: null
};

async function verify() {
    const result = validateDTE('01', mockDte);
    if (result.success) {
        console.log('✅ PASS: AJV logic now correctly validates 39.55 as multiple of 0.01');
    } else {
        console.error('❌ FAIL: Still failing validation');
        console.error(JSON.stringify(result.errors, null, 2));
    }
}

verify();
