# Hacienda API Endpoints Configuration

This document explains how to configure and manage the endpoints for the Ministerio de Hacienda (MH) services in the DTE API.

## Centralized Configuration

All Hacienda URLs are centralized in `src/config/haciendaConfig.js`. This module dynamically selects the correct endpoint based on the `HACIENDA_ENV` environment variable.

## Switching Environments

To switch between the **Sandbox (Test)** and **Production** environments, update the `HACIENDA_ENV` variable in your `.env` file:

```bash
# For Sandbox/Test
HACIENDA_ENV=test

# For Production
HACIENDA_ENV=production
```

## Required Environment Variables

The following variables must be defined in your `.env` file for each environment:

### Sandbox / Test (HACIENDA_ENV=test)
- `HACIENDA_AUTH_URL_TEST`: Authentication service URL.
- `HACIENDA_RECEPCION_URL_TEST`: DTE reception service URL.
- `HACIENDA_CONSULT_URL_TEST`: DTE consultation service URL.
- `HACIENDA_INVALIDACION_URL_TEST`: DTE invalidation (Anulación) service URL.
- `HACIENDA_CONTINGENCIA_URL_TEST`: Contingency report service URL.

### Production (HACIENDA_ENV=production)
- `HACIENDA_AUTH_URL_PROD`: Official production auth URL.
- `HACIENDA_RECEPCION_URL_PROD`: Official production reception URL.
- `HACIENDA_CONSULT_URL_PROD`: Official production consultation URL.
- `HACIENDA_INVALIDACION_URL_PROD`: Official production invalidation URL.
- `HACIENDA_CONTINGENCIA_URL_PROD`: Official production contingency URL.

## Troubleshooting

If an endpoint is called but its corresponding environment variable is missing, the API will throw a clear error:
`Endpoint de Hacienda no configurado: HACIENDA_... Verifique su archivo .env`

Ensure all variables are properly defined before switching to `production`.
