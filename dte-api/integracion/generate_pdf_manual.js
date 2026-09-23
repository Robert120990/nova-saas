const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const targetPdfPath = path.join(__dirname, 'MANUAL_INTEGRACION_DTE_API.pdf');
const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 35, bottom: 35, left: 40, right: 40 },
    bufferPages: true
});

const writeStream = fs.createWriteStream(targetPdfPath);
doc.pipe(writeStream);

// Paleta de Colores Corporativa
const C_NAVY = '#0f172a';
const C_INDIGO = '#3730a3';
const C_BLUE = '#2563eb';
const C_SLATE_DARK = '#334155';
const C_SLATE_LIGHT = '#64748b';
const C_BG_CODE = '#0f172a';
const C_TEXT_CODE = '#38bdf8';
const C_GREEN = '#15803d';
const C_AMBER = '#b45309';

function renderHeaderBanner(title, subtitle) {
    const startY = doc.y;
    doc.rect(40, startY, 532, 65).fill(C_NAVY);
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(title, 55, startY + 14, { width: 500 });
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
       .text(subtitle, 55, startY + 36, { width: 500 });
    doc.y = startY + 75;
}

function renderSectionTitle(title, tag = '') {
    doc.moveDown(0.4);
    const startY = doc.y;
    doc.rect(40, startY, 4, 16).fill(C_INDIGO);
    doc.fillColor(C_NAVY).fontSize(10.5).font('Helvetica-Bold')
       .text(title, 50, startY + 2.5);
    if (tag) {
        const textWidth = doc.widthOfString(tag, { font: 'Helvetica-Bold', size: 7.2 });
        doc.rect(572 - textWidth - 12, startY + 1.5, textWidth + 12, 13).fill('#e0e7ff');
        doc.fillColor(C_INDIGO).fontSize(7.2).font('Helvetica-Bold')
           .text(tag, 572 - textWidth - 6, startY + 3.5);
    }
    doc.y = startY + 20;
}

function renderParagraph(text) {
    doc.fillColor(C_SLATE_DARK).fontSize(8).font('Helvetica')
       .text(text, 40, doc.y, { width: 532, lineGap: 1.8, align: 'justify' });
    doc.moveDown(0.3);
}

function renderAlert(title, text, type = 'info') {
    const startY = doc.y;
    let borderColor = C_BLUE;
    let bgColor = '#eff6ff';
    let textColor = '#1e40af';
    if (type === 'warning') {
        borderColor = C_AMBER;
        bgColor = '#fffbeb';
        textColor = '#92400e';
    } else if (type === 'success') {
        borderColor = C_GREEN;
        bgColor = '#f0fdf4';
        textColor = '#166534';
    }

    doc.rect(40, startY, 532, 34).fillAndStroke(bgColor, borderColor);
    doc.fillColor(textColor).fontSize(7.8).font('Helvetica-Bold')
       .text(title, 50, startY + 4);
    doc.fillColor(textColor).fontSize(7.1).font('Helvetica')
       .text(text, 50, startY + 15, { width: 512, lineGap: 1.1 });
    doc.y = startY + 39;
}

function renderCodeBlock(code, title = '', fontSize = 6.6) {
    const lines = code.split('\n');
    const lineHeight = fontSize * 1.32;
    const boxHeight = lines.length * lineHeight + (title ? 18 : 10);

    const startY = doc.y;
    doc.rect(40, startY, 532, boxHeight).fill(C_BG_CODE);
    
    if (title) {
        doc.rect(40, startY, 532, 13).fill('#1e293b');
        doc.fillColor('#94a3b8').fontSize(6.6).font('Helvetica-Bold')
           .text(title, 48, startY + 3);
    }

    const codeStartY = title ? startY + 15 : startY + 5;
    doc.fillColor(C_TEXT_CODE).fontSize(fontSize).font('Courier')
       .text(code, 48, codeStartY, { width: 516, lineGap: 1 });
    doc.y = startY + boxHeight + 5;
}

function renderTable(headers, rows, colWidths) {
    let startY = doc.y;

    // Header
    doc.rect(40, startY, 532, 14).fill(C_INDIGO);
    let curX = 45;
    headers.forEach((h, i) => {
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
           .text(h, curX, startY + 3.5, { width: colWidths[i] - 6 });
        curX += colWidths[i];
    });
    startY += 14;

    // Rows
    rows.forEach((r, rIdx) => {
        const rowBg = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, startY, 532, 13.5).fill(rowBg);
        doc.rect(40, startY + 13, 532, 0.5).fill('#e2e8f0');

        let cellX = 45;
        r.forEach((c, cIdx) => {
            doc.fillColor(C_SLATE_DARK).fontSize(6.6).font('Helvetica')
               .text(String(c), cellX, startY + 2.8, { width: colWidths[cIdx] - 6 });
            cellX += colWidths[cIdx];
        });
        startY += 13.5;
    });

    doc.y = startY + 4;
}

// =========================================================================
// PÁGINA 1: PORTADA & ARQUITECTURA DE FIRMA EXTERNA (.CRT)
// =========================================================================
renderHeaderBanner(
    'MANUAL DE INTEGRACIÓN: MICROSERVICIO DTE (dte-api)',
    'Ministerio de Hacienda de El Salvador — Normativa SVFE v2.0 | Firma Externa con Certificado .CRT'
);

renderParagraph(
    'Este documento establece la especificación técnica oficial para conectar cualquier sistema externo (ERP, CRM, Ecommerce, POS Desktop o Móvil) con el microservicio dte-api para la emisión, validación, firma digital, transmisión e invalidación de Documentos Tributarios Electrónicos (DTE) conforme a los esquemas oficiales del Ministerio de Hacienda.'
);

renderSectionTitle('1. Arquitectura y Firma Externa con Certificado .CRT', 'ARQUITECTURA');
renderParagraph(
    'El microservicio dte-api opera como una pasarela fiscal desacoplada. Para el firmado digital opera en MODO DE FIRMA EXTERNA (SIGNATURE_MODE=external) comunicándose localmente con el contenedor oficial svfe-api-firmador de Hacienda vía HTTP local en puerto 8113 (Producción) u 8114 (Pruebas). El sistema externo NO manipula llaves criptográficas ni certificados.'
);

renderAlert(
    'Seguridad y Desacoplamiento de Certificados Digitales',
    'El certificado digital X.509 (.crt público y clave privada) reside exclusivamente en el servidor firmador. dte-api construye el JSON normativo, solicita la firma entregando la clave de llave privada y obtiene el JWS firmado listo para Hacienda.',
    'info'
);

renderTable(
    ['Componente / Parámetro', 'Valor / Endpoint Local', 'Descripción Técnica'],
    [
        ['URL Base de dte-api', 'http://localhost:5000/api', 'Punto de acceso REST para los sistemas externos emisores.'],
        ['Firmador MH (Pruebas - 00)', 'http://localhost:8114/firmardocumento/', 'Contenedor Docker oficial de firma para ambiente de pruebas.'],
        ['Firmador MH (Producción - 01)', 'http://localhost:8113/firmardocumento/', 'Contenedor Docker oficial de firma para ambiente de producción.'],
        ['Certificado Digital', 'Formato X.509 (.crt + clave privada)', 'Certificado de firma electrónica emitido por autoridad certificadora.'],
        ['Resultado de Firma', 'JWS Compact Serialization (RFC 7515)', 'Firma compacta iniciada con eyJ... enviada al Ministerio de Hacienda.']
    ],
    [130, 195, 207]
);

renderSectionTitle('Flujo de Transmisión Sincrónica', 'FLUJO OPERATIVO');
renderParagraph(
    '1. El sistema externo envía el documento mediante POST /api/dte/emit con el token Bearer JWT.\n' +
    '2. dte-api valida el token, obtiene los parámetros de la empresa y genera el Código de Generación (UUID v4) y Número de Control.\n' +
    '3. dte-api envía el JSON al contenedor svfe-api-firmador usando el certificado .CRT configurado.\n' +
    '4. dte-api transmite el JWS resultante al Ministerio de Hacienda y recibe el Sello de Recepción oficial de 40 caracteres.\n' +
    '5. dte-api almacena la transacción en base de datos y responde al sistema emisor sincrónicamente.'
);

// =========================================================================
// PÁGINA 2: GENERACIÓN DEL TOKEN JWT
// =========================================================================
doc.addPage();
renderSectionTitle('2. Autenticación y Generación del Token JWT', 'SEGURIDAD MULTI-TENANT');
renderParagraph(
    'Todas las solicitudes hacia dte-api deben autenticarse mediante un encabezado HTTP Bearer Token. El token es un JSON Web Token (JWT) firmado con algoritmo HS256 utilizando la clave secreta configurada en el servidor (JWT_SECRET).'
);

renderAlert(
    'Regla Estricta Multi-Tenant: Parámetros Prohibidos en el Body',
    'Bajo ninguna circunstancia se debe enviar company_id o branch_id dentro del cuerpo JSON (req.body). Si estos campos se envían en el body, la API rechazará la solicitud inmediatamente con HTTP 400. La empresa y sucursal autorizadas se extraen EXCLUSIVAMENTE de los claims del token JWT validado.',
    'warning'
);

renderTable(
    ['Claim JWT', 'Tipo', 'Obligatorio', 'Descripción'],
    [
        ['company_id', 'Entero', 'Sí', 'Identificador de la empresa en la base de datos (asocia NIT, NRC y certificados).'],
        ['branch_id', 'Entero', 'Sí', 'Identificador de la sucursal o punto de emisión configurado.'],
        ['username', 'String', 'Sí', 'Nombre del usuario, servicio o sistema emisor (ej. "pos_central", "tienda_web").'],
        ['id', 'Entero', 'Opcional', 'Identificador numérico de usuario (o 0 para servicios automatizados).'],
        ['exp', 'Timestamp', 'Sí', 'Fecha de expiración UNIX. Recomendado entre 15 y 60 minutos.']
    ],
    [80, 55, 60, 337]
);

const jwtNodeCode = `const jwt = require('jsonwebtoken');
const JWT_SECRET = 'saas_dte_api_secret_2024';

const payload = {
    id: 1,
    username: 'sistema_externo_pos',
    company_id: 1, // ID de la empresa en el sistema
    branch_id: 1   // ID de la sucursal emisora
};

// Generar token con expiración de 15 minutos
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
console.log('Authorization: Bearer ' + token);`;
renderCodeBlock(jwtNodeCode, 'EJEMPLO GENERACIÓN TOKEN EN JAVASCRIPT / NODE.JS');

const jwtPythonCode = `import jwt, datetime
JWT_SECRET = "saas_dte_api_secret_2024"

payload = {
    "id": 1,
    "username": "sistema_externo_pos",
    "company_id": 1,
    "branch_id": 1,
    "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
}
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json" }`;
renderCodeBlock(jwtPythonCode, 'EJEMPLO GENERACIÓN TOKEN EN PYTHON (PyJWT)');

// =========================================================================
// PÁGINA 3: CATÁLOGO COMPLETO DE TIPOS DE DOCUMENTO ADMITIDOS
// =========================================================================
doc.addPage();
renderSectionTitle('3. Catálogo Completo de Tipos de Documento Admitidos', 'CAT-002 Y CAT-022');
renderParagraph(
    'El microservicio dte-api soporta de forma exhaustiva todos los tipos de documentos tributarios de la normativa SVFE de El Salvador:'
);

renderTable(
    ['DTE', 'Nombre Oficial del Documento', 'Ver.', 'Uso y Descripción Funcional'],
    [
        ['01', 'Factura (Consumidor Final)', 'v2', 'Venta al detalle a particulares sin NRC. Precios con IVA incluido.'],
        ['03', 'Comprobante de Crédito Fiscal', 'v4', 'Operaciones B2B con contribuyentes IVA. Precios netos. Requiere NRC.'],
        ['04', 'Nota de Remisión', 'v4', 'Ampara traslado de mercaderías. Requiere datos de transporte y placas.'],
        ['05', 'Nota de Crédito', 'v4', 'Devoluciones, rebajas o anulación parcial. Requiere doc. relacionado.'],
        ['06', 'Nota de Débito', 'v4', 'Cobro de intereses moratorios o ajustes al alza sobre doc. previo.'],
        ['07', 'Comprobante de Retención', 'v2', 'Emisión por grandes contribuyentes al retener 1% IVA en compras.'],
        ['08', 'Comprobante de Liquidación', 'v2', 'Liquidaciones de ventas o comisiones por cuenta de terceros.'],
        ['09', 'Doc. Contable de Liquidación (DCLE)', 'v2', 'Liquidaciones fiduciarias y financieras reguladas por el Código Tributario.'],
        ['11', 'Factura de Exportación (FEX)', 'v3', 'Exportaciones definitivas a tasa 0% IVA. Requiere régimen y país destino.'],
        ['14', 'Factura de Sujeto Excluido (FSE)', 'v2', 'Compras a personas naturales no contribuyentes de IVA (retención 10% ISR).'],
        ['15', 'Comprobante de Donación', 'v2', 'Donaciones recibidas por entidades autorizadas por el Ministerio de Hacienda.']
    ],
    [32, 160, 28, 312]
);

renderSectionTitle('Eventos Tributarios Especiales Soportados');
renderTable(
    ['Código', 'Nombre del Evento', 'Ver.', 'Ruta API y Descripción'],
    [
        ['16', 'Evento de Invalidación', 'v3', 'POST /api/invalidation/invalidate — Anula fiscalmente un DTE sellado.'],
        ['17', 'Evento Contingencia (EOP)', 'v1', 'Agrupa y retransmite lotes de DTEs emitidos bajo contingencia diferida.'],
        ['18', 'Evento Retorno Exportación', 'v1', 'Registro formal del retorno al país de mercadería previamente exportada.']
    ],
    [40, 150, 30, 312]
);

renderSectionTitle('Tipos de Documento de Identidad del Receptor (CAT-022)');
renderTable(
    ['Código', 'Alias Admitidos', 'Tipo de Identificación', 'Formato y Reglas Oficiales'],
    [
        ['13', '"DUI"', 'Documento Único de Identidad', 'Formato: 00000000-0 (8 dígitos + guión + 1 dígito).'],
        ['36', '"NIT"', 'Número de Identificación Tributaria', 'Formato tradicional 0000-000000-000-0 o DUI homologado.'],
        ['02', '"CARNET RESIDENTE"', 'Carnet de Residente', 'Identificación de extranjeros residentes en El Salvador.'],
        ['03', '"PASAPORTE"', 'Pasaporte', 'Identificación de extranjeros no residentes.'],
        ['37', '"OTRO"', 'Otro Documento de Identidad', 'Obligatorio en Exportación (11) para compradores extranjeros.']
    ],
    [35, 115, 150, 232]
);

// =========================================================================
// PÁGINA 4: MODELO Y REGLAS DE DESCUENTOS
// =========================================================================
doc.addPage();
renderSectionTitle('4. Modelo y Reglas de Descuentos en dte-api', 'DESCUENTOS');
renderParagraph(
    'dte-api admite dos modalidades de descuento: 1) Descuento por Ítem (en cada línea de producto) y 2) Descuento General (al pie del comprobante). Ambas modalidades pueden usarse por separado o de forma combinada.'
);

renderTable(
    ['Modalidad', 'Campo en Payload', 'Alcance y Fórmula', 'Impacto en Resumen Hacienda'],
    [
        ['Por Ítem', 'items[i].montoDescu', 'Resta directa en la línea: (precioUnitario * cant) - montoDescu', 'Reduce base imponible del ítem (ventaGravada).'],
        ['Global / Pie', 'descuento_general', 'Descuento monetario global sobre la sumatoria gravada total', 'Se refleja en resumen.descuGravada y totalDescu.'],
        ['Porcentaje', 'porcentajeDescuento', 'Porcentaje opcional (si no se envía se calcula automáticamente)', 'Se traslada al campo resumen.porcentajeDescuento.']
    ],
    [75, 110, 185, 162]
);

renderAlert(
    'Regla de Conversión en Crédito Fiscal (03)',
    'En Factura (01) los descuentos son inclusive con IVA. En Crédito Fiscal (03), si el descuento general viene en valor con IVA, dte-api lo convierte a valor neto dividiéndolo entre 1.13 para garantizar que la base imponible y el IVA del 13% cuadren exactamente con las validaciones de Hacienda.',
    'info'
);

const sampleDescuentos = `// Ejemplo: Factura 01 con Descuento por Ítem + Descuento General
{
  "tipoDte": "01",
  "descuento_general": 5.00,        // <-- Descuento global al pie
  "porcentajeDescuento": 5.0,       // <-- Porcentaje explícito (opcional)
  "items": [
    {
      "cantidad": 2,
      "precioUni": 25.00,
      "montoDescu": 5.00,           // <-- Descuento por ítem ($5.00 en esta línea)
      "ventaGravada": 45.00         // <-- (25 * 2) - 5 = 45.00
    },
    {
      "cantidad": 1,
      "precioUni": 15.00,
      "montoDescu": 0.00,
      "ventaGravada": 15.00
    }
  ],
  "pagos": [{ "codigo": "01", "montoPago": 55.00 }] // (45 + 15) - 5 = $55.00
}`;
renderCodeBlock(sampleDescuentos, 'EJEMPLO PAYLOAD CON DESCUENTOS COMBINADOS');

renderParagraph(
    'Cálculo de campos en el bloque oficial resumen:\n' +
    '• subTotalVentas = Sumatoria de ventaGravada, ventaExenta y ventaNoSuj ($60.00 en el ejemplo).\n' +
    '• descuGravada = Descuento general aplicado a ventas gravadas ($5.00).\n' +
    '• totalDescu = Total descuentos por ítem ($5.00) + Descuento general ($5.00) = $10.00.\n' +
    '• subTotal = subTotalVentas - descuGravada ($55.00).\n' +
    '• totalPagar = Monto final de la transacción ($55.00).'
);

// =========================================================================
// PÁGINA 5: SOLICITUD Y RESPUESTAS DE EMISIÓN (POST /api/dte/emit)
// =========================================================================
doc.addPage();
renderSectionTitle('5. Emisión de Documento: POST /api/dte/emit', 'ENDPOINT PRINCIPAL');

const emitRequestSample = `POST /api/dte/emit HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN_JWT>
Content-Type: application/json

{
  "tipoDte": "03", // 03=Comprobante de Crédito Fiscal
  "descuento_general": 10.00,
  "condicionOperacion": 1,
  "receptor": {
    "nombre": "DISTRIBUIDORA COMERCIAL S.A. DE C.V.",
    "tipoDocumento": "36", // 36=NIT
    "numDocumento": "0614-120990-101-2",
    "nrc": "123456-7",
    "codActividad": "46900", // CAT-019
    "descActividad": "Venta al por mayor no especializada",
    "telefono": "22558899",
    "correo": "contabilidad@distribuidora.com",
    "departamento": "06", // San Salvador
    "municipio": "14",
    "direccion": { "departamento": "06", "municipio": "14", "complemento": "Boulevard Los Próceres #456" }
  },
  "items": [
    {
      "tipoItem": 1,
      "cantidad": 10,
      "codigo": "PROD-010",
      "descripcion": "Caja de Lubricante Industrial 15W40",
      "precioUni": 30.00,
      "montoDescu": 2.00,
      "tributos": ["20"] // 20=IVA 13%
    }
  ],
  "pagos": [{ "codigo": "05", "montoPago": 314.14 }]
}`;
renderCodeBlock(emitRequestSample, 'SOLICITUD: POST /api/dte/emit (Crédito Fiscal con Descuentos)');

const emitResponseSuccess = `// HTTP 200 OK — DTE Recibido y Sellado con Éxito por Hacienda
{
  "success": true,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "numeroControl": "DTE-03-M001P001-000000000000185",
  "contingency": false,
  "data": {
    "estado": "PROCESADO",
    "selloRecibido": "20261A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F", // Sello oficial de 40 caracteres
    "fhProcesamiento": "22/09/2026 17:15:30",
    "clasificaMsg": "10",
    "codigoMsg": "001",
    "descripcionMsg": "RECIBIDO CON EXITO",
    "observaciones": []
  }
}`;
renderCodeBlock(emitResponseSuccess, 'RESPUESTA EXITOSA: 200 OK (Aprobado y Sellado)');

// =========================================================================
// PÁGINA 6: RECHAZOS, CONTINGENCIA Y DESCARGA PDF
// =========================================================================
doc.addPage();
renderSectionTitle('6. Manejo de Rechazos y Modo Contingencia', 'EXCEPCIONES');

const emitResponseRejected = `// HTTP 200 OK (success: false) — Rechazo de Hacienda (Error Fiscal)
{
  "success": false,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "numeroControl": "DTE-03-M001P001-000000000000185",
  "message": "Rechazado por Ministerio de Hacienda",
  "data": {
    "estado": "RECHAZADO",
    "codigoMsg": "103",
    "descripcionMsg": "El valor del campo tributos no coincide con la sumatoria gravada",
    "observaciones": ["Total IVA calculado difiere por más de $0.01 respecto a la tasa del 13%"]
  }
}`;
renderCodeBlock(emitResponseRejected, 'RESPUESTA DE RECHAZO TRIBUTARIO DE HACIENDA');

renderParagraph(
    'Si los servidores de Hacienda presentan fallas técnicas, caída de red o errores HTTP 502/503/504, dte-api pasa automáticamente a tipoOperacion: 2 (Diferido/Contingencia), refirma el documento con el certificado .CRT y lo almacena localmente encolado para retransmisión.'
);

const emitResponseContingency = `// HTTP 200 OK (contingency: true) — Facturación en Contingencia (Venta Ininterrumpida)
{
  "success": true,
  "codigoGeneracion": "E2B1C3D4-5F6A-7B8C-9D0E-1A2B3C4D5E6F",
  "numeroControl": "DTE-01-M001P001-000000000000251",
  "contingency": true,
  "message": "DTE firmado en contingencia (Hacienda fuera de línea). Encolado para envío.",
  "data": {
    "estado": "CONTINGENCIA",
    "tipoContingencia": 1,
    "motivo": "No disponibilidad del servicio del Ministerio de Hacienda"
  }
}`;
renderCodeBlock(emitResponseContingency, 'RESPUESTA EN CONTINGENCIA (La venta física no se detiene)');

renderSectionTitle('7. Descarga de Representación Gráfica (PDF Oficial)', 'REPRESENTACIÓN GRÁFICA');
renderParagraph(
    'Endpoint: GET /api/dte/pdf/:codigoGeneracion\n' +
    'Genera y descarga en flujo binario el PDF oficial en tamaño Carta o Ticket con el Sello de Recepción y el Código QR de verificación directa ante el portal de Hacienda.'
);

const getPdfHeaders = `GET /api/dte/pdf/F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A HTTP/1.1
Authorization: Bearer <TOKEN_JWT>

// Respuesta HTTP:
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="DTE-01-M001P001-000000000000250.pdf"
[Flujo binario del archivo PDF con QR y Sello oficial]`;
renderCodeBlock(getPdfHeaders, 'PETICIÓN Y RESPUESTA: GET /api/dte/pdf/:codigoGeneracion');

// =========================================================================
// PÁGINA 7: INVALIDACIÓN Y RESOLUCIÓN DE ERRORES
// =========================================================================
doc.addPage();
renderSectionTitle('8. Invalidación de DTE (Anulación Fiscal)', 'EVENTO OFICIAL');
renderParagraph(
    'Para anular un DTE procesado ante Hacienda, el sistema externo debe llamar al endpoint POST /api/invalidation/invalidate. dte-api crea el Evento de Invalidación oficial (CAT-002: 16), lo firma con el firmador externo (.CRT) y lo transmite a Hacienda para anular la validez fiscal del documento.'
);

const invalidationRequest = `POST /api/invalidation/invalidate HTTP/1.1
Authorization: Bearer <TOKEN_JWT>
Content-Type: application/json

{
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "tipoDte": "01",
  "motivo": "2", // 1=Rescisión, 2=Error en datos, 3=Otro (CAT-024)
  "responsable": { "nombre": "Roberto Henríquez", "tipoDoc": "13", "numDoc": "02345678-9" },
  "solicitante": { "nombre": "Carlos Alberto Gómez", "tipoDoc": "13", "numDoc": "05123456-7" }
}`;
renderCodeBlock(invalidationRequest, 'SOLICITUD: POST /api/invalidation/invalidate');

renderSectionTitle('9. Códigos HTTP y Solución de Errores', 'REFERENCIA RÁPIDA');
renderTable(
    ['Código HTTP', 'Causa Probable', 'Solución Recomendada'],
    [
        ['401 Unauthorized', 'Falta el header Authorization o token expirado.', 'Generar un token JWT válido firmado con JWT_SECRET.'],
        ['400 Bad Request', 'Falta campo obligatorio o company_id en body.', 'Remover company_id del cuerpo JSON y verificar payload.'],
        ['400 (Schema Error)', 'Inconsistencia en tipos de datos o catálogos MH.', 'Verificar que departamento y municipio existan en CAT-008.'],
        ['200 (success: false)', 'Hacienda rechazó el DTE por regla tributaria.', 'Revisar campo descripcionMsg y corregir datos del cliente.'],
        ['500 Server Error', 'Firmador Docker (puerto 8113/8114) offline.', 'Verificar que el contenedor svfe-api-firmador esté Up.']
    ],
    [100, 200, 232]
);

renderAlert(
    'Health Check del Microservicio',
    'El endpoint GET /api/health no requiere token y retorna {"status": "UP", "timestamp": ...} para balanceadores y monitoreo.',
    'success'
);

// =========================================================================
// ENCABEZADOS Y PIES DE PÁGINA REGLAMENTARIOS (BUFFERED)
// =========================================================================
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    // Running Header (excepto portada)
    if (i > 0) {
        doc.rect(40, 20, 532, 0.5).fill('#cbd5e1');
        doc.fillColor(C_SLATE_LIGHT).fontSize(6.5).font('Helvetica')
           .text('MANUAL DE INTEGRACIÓN DTE-API — MINISTERIO DE HACIENDA (SVFE v2.0) | MODO FIRMA .CRT', 40, 10, { width: 532 });
    }

    // Running Footer
    doc.rect(40, 755, 532, 0.5).fill('#cbd5e1');
    doc.fillColor(C_SLATE_LIGHT).fontSize(6.5).font('Helvetica')
       .text('CONFIDENCIAL — PROPIEDAD DE NOVA-SAAS', 40, 760);
    doc.fillColor(C_SLATE_LIGHT).fontSize(6.5).font('Helvetica-Bold')
       .text(`Página ${i + 1} de ${range.count}`, 40, 760, { align: 'right', width: 532 });
}

doc.end();

writeStream.on('finish', () => {
    console.log(`PDF successfully generated: ${targetPdfPath} (Total pages: ${range.count})`);
});
