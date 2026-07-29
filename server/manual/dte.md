# DTE (Documentos Tributarios Electrónicos)

Sistema de facturación electrónica integrado con el Ministerio de Hacienda de El Salvador.

## Arquitectura

El sistema cuenta con un microservicio separado (`dte-api`) que maneja el ciclo de vida completo del DTE:

1. **Generación** — Creación del documento JSON según esquema MH
2. **Firma** — Firma digital del documento
3. **Transmisión** — Envío a Hacienda
4. **Recepción** — Procesamiento de la respuesta de Hacienda

## Ciclo de vida del DTE

### Emisión completa (recomendada)

Al procesar una venta, el sistema ejecuta automáticamente el flujo completo:

1. Genera el cuerpo del DTE con items, cálculos de impuestos y datos fiscales
2. Firma digitalmente con el certificado configurado
3. Transmite a Hacienda (ambiente prueba o producción según configuración)
4. Recibe el sello de recepción y número de control
5. Almacena el documento aprobado

### Ambientes

- **Pruebas** — Conecta con `https://cdn.com.sv` (ambiente de pruebas MH)
- **Producción** — Conecta con `https://factura.gob.sv` (ambiente real)

Configurable desde `HACIENDA_ENV=test|production` en `.env` del dte-api.

### Modos de firma

- **Interna** — Usa el certificado digital (.p12/.pfx) almacenado en el sistema
- **Externa** — Delega la firma a un servicio externo

## Tipos de DTE soportados

| Código | Tipo |
|--------|------|
| 01 | Factura |
| 03 | Comprobante de Crédito Fiscal |
| 04 | Nota de Remisión |
| 05 | Nota de Crédito (anulación) |
| 07 | Comprobante de Retención |
| 11 | Factura de Exportación |

## Contingencia

Cuando Hacienda no está disponible:

1. Active el modo contingencia desde **Ventas > Contingencia DTE**
2. El sistema genera DTE con número de contingencia
3. Los documentos se almacenan en cola para transmisión posterior
4. Cuando Hacienda esté disponible, procese la cola desde **Contingencia DTE > Transmitir pendientes**

## Retorno / ERET

Para corrección de DTE rechazados o anulaciones:

1. Vaya a **Ventas > Retorno / ERET**
2. Seleccione el DTE a corregir
3. Realice la corrección solicitada por Hacienda
4. Re-transmita el documento

## Configuración necesaria

Antes de emitir DTE debe configurar:

1. **Datos de la empresa**: NIT, NRC, razón social, actividad económica
2. **Sucursal**: Dirección, código de establecimiento MH
3. **Certificado digital**: Cargar archivo .p12/.pfx con contraseña
4. **Tipo de contribuyente**: Gran contribuyente, pequeño contribuyente, etc.
5. **Catálogos MH**: Códigos de productos, unidades de medida, tipos de ítem
