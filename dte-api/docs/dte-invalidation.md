# DTE Invalidation (Anulación)

This module allows for the invalidation of previously transmitted and accepted DTE documents.

## Endpoint: `POST /api/dte/invalidation/invalidate`

### Request Payload
```json
{
  "codigoGeneracion": "UUID-OF-ORIGINAL-DTE",
  "motivo": "01", 
  "descripcion": "Error en datos del cliente",
  "nombreResponsable": "Juan Pérez",
  "tipDocResponsable": "13",
  "numDocResponsable": "00000000-0",
  "nombreSolicita": "María López",
  "tipDocSolicita": "13",
  "numDocSolicita": "00000000-1"
}
```

- **motivo**: Based on CAT-024 (1: Error en datos, 2: Falta de pago, etc.)
- **Responsable**: Person from the company invalidating the DTE.
- **Solicitante**: Customer or person requesting the invalidation.

## Process
1. **Validation**: Checks if DTE exists and is in `ACCEPTED` status.
2. **JSON Generation**: Creates a compliant invalidation event JSON (version 2).
3. **Signing**: Signed internally using the company's .p12 certificate.
4. **Transmission**: Sent to Hacienda's `/anulaciondte` endpoint.
5. **Persistence**: Updates the original DTE status to `INVALIDADO`.

## Endpoint: `GET /api/dte/invalidation/invalidation-status/:codigoGeneracion`
Returns the status and full Hacienda response of the invalidation event.
