# El Salvador DTE API

Production-grade REST API for the generation, validation, digital signing, and transmission of Documentos Tributarios Electrónicos (DTE) for El Salvador.

## Features

- **Multi-Tenant**: Support for multiple companies and branches.
- **Dynamic Validation**: Standard JSON Schema validation and Catalog-based validation.
- **Digital Signature**: Bridge to the official Hacienda signer service.
- **Asynchronous Transmission**: SQL-based queue with retry policy and exponential backoff.
- **PDF Generation**: Standardized printable representations with QR codes.

## Project Structure

```
/dte-api
   /src
      /controllers     # API Endpoints
      /services        # DTE Generator, PDF Service
      /repositories    # Database Logic
      /validators      # Schema Validators (Ajv)
      /signature       # JWS Signing logic
      /transmission    # MH Communication service
      /queue           # Asynchronous worker
      /middlewares     # Auth & Multitenancy
   /config             # Configuration
```

## Setup

1. Copy `.env.example` to `.env` and configure your database and Hacienda credentials.
2. Run `npm install`.
3. Start the server: `npm run dev`.

## API Endpoints

- `POST /api/dte/generate`: Generates a valid JSON DTE structure from generic input.
- `POST /api/dte/validate`: Structural and catalog validation.
- `POST /api/dte/sign`: Signs the JSON document using the company's certificate.
- `POST /api/dte/transmit`: Queues the document for transmission to Hacienda.
- `GET /api/dte/status/:codigoGeneracion`: Checks the current status (PENDING, ACCEPTED, etc.).
- `GET /api/dte/pdf/:codigoGeneracion`: Returns the PDF representation.

## Architecture

The API follows a clean architecture pattern, isolating business logic in services and database access in repositories/models. It uses the `cumplientoDTE` folder as the authoritative source for schemas and rules.
