---
name: dte
description: Flujo de facturación electrónica DTE de El Salvador con Hacienda. Usar cuando se mencione DTE, factura electrónica, emitir/firmar/transmitir, contingencia, invalidación, anulación, ERET, evento de retorno, número de control o esquemas MH.
---

# Skill: DTE (Documentos Tributarios Electrónicos)

Fuente normativa autoritativa: [DTE_API_RULES.md](./DTE_API_RULES.md) (co-ubicada). Referencia de arquitectura: `ESTRUCTURA_PROYECTO.md` sección dte-api.

## Regla de oro de arquitectura

El **main server (`server/`) NUNCA firma ni transmite**. Toda operación DTE se delega al microservicio `dte-api/` vía HTTP:
- Base URL: `http://localhost:5000/api` (configurada en `server/.env` → `DTE_API_URL`)
- Headers obligatorios: `Authorization: Bearer <JWT>` + `x-company-id` (tenant emisor); opcional `x-branch-id`
- Cliente HTTP del lado server: `server/src/services/dte.service.js`

## Ciclo de vida

```
generate (POST /dte/generate → PENDING)
   ↓
sign     (POST /dte/sign      → SIGNED, usa certificado P12/PFX de la empresa en BD)
   ↓
transmit (POST /dte/transmit  → cola con reintentos → ACCEPTED/REJECTED)
```

Para POS/venta directa usar el endpoint unificado **`POST /api/dte/emit`** que ejecuta todo el ciclo en una llamada. Fallas no atribuibles a Hacienda (ej. certificado vencido) retornan error inmediato; fallos de red hacia Hacienda activan **contingencia automática**.

## Puntos clave por archivo

| Necesidad | Archivo |
|---|---|
| Construcción del JSON por tipo (01,03,05...) | `dte-api/src/services/dteGenerator.js` |
| Número de control oficial | `dte-api/src/services/dte/controlNumberService.js` |
| Firma interna node-forge / externa | `dte-api/src/services/signature/*` (según `SIGNATURE_MODE`) |
| Comunicación MH (token + recepcionDTE) | `dte-api/src/transmission/transmissionService.js` |
| Validación ajv contra esquemas oficiales | `dte-api/src/validators/schemaValidator.js`; schemas en `cumplientoDTE/svfe-json-schemas/` |
| Contingencia / invalidación / ERET / retransmisión | carpetas y controllers homónimos en `dte-api/src/` |
| PDF entregable | `GET /dte/pdf/{codigoGeneracion}` |

## Estados del documento

`PENDING` → `SIGNED` → `SENT` → `ACCEPTED | REJECTED | ERROR`. Rechazos se detallan en tabla `dte_errors`.

Errores siempre: `{ "success": false, "message": "...", "details": [] }`.

Ambiente Hacienda: `HACIENDA_ENV=test|production` en `dte-api/.env`.

## Al modificar lógica DTE

1. Nunca validar JSON manualmente: pasar por `schemaValidator` con los esquemas oficiales.
2. Respetar cálculos fiscales de `utils/calculations.js` (IVA, percepción, redondeos oficiales).
3. Verificar versión de JSON correcta por tipo de documento (`utils/versionMap.js`).
4. Documentos existentes NO se regeneran: para corregir un DTE emitido usar invalidación (evento 3), no edición.
