# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant SaaS system for Salvadoran businesses with DTE (Documentos Tributarios Electrónicos / Electronic Tax Document) integration. It consists of three main components:

- **Main Server** (`server/`) - Express.js backend on port 4000
- **Client** (`client/`) - React frontend with Vite on port 3000
- **DTE API** (`dte-api/`) - Separate Express.js API for DTE on port 5000

## Commands

### Server (Main Backend)
```bash
cd server
npm install        # Install dependencies
npm run dev        # Start with nodemon (development)
npm start          # Start with node (production)
```

### Client (Frontend)
```bash
cd client
npm install        # Install dependencies
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### DTE API
```bash
cd dte-api
npm install        # Install dependencies
npm run dev        # Start with nodemon
npm start          # Start with node
```

### Database Migrations
```bash
cd database
node run_migration.js         # Run migrations
node run_migration_v8.js      # Run v8 migrations (DTE)
```

## Architecture

### Main Server (`server/`)
Express.js backend using MySQL. Architecture follows controller -> service -> model pattern (controllers call services, services handle business logic).

Key directories:
- `src/controllers/` - Route handlers
- `src/services/` - Business logic
- `src/routes/` - Express routes
- `src/middlewares/` - Auth, tenant, upload middleware
- `src/config/` - Database and upload configuration
- `uploads/` - File uploads directory
- `certificados-p12pfx/`, `certificados-crt/` - Digital certificates

Multi-tenancy: Uses `x-company-id` header for tenant isolation via `tenantMiddleware`.

### Client (`client/`)
React 18 with Vite, Tailwind CSS, TanStack Query, React Router v7, and Sonner for toasts.

Key directories:
- `src/pages/` - Page components (route-level)
- `src/components/ui/` - Reusable UI components
- `src/components/layout/` - Layout components (includes sidebar navigation)
- `src/context/` - AuthContext for authentication state

TanStack Query is used for all server state management with query keys following pattern `['resource', search, page]`.

### DTE API (`dte-api/`)
Separate microservice for DTE lifecycle. Connects to same database as main server.

DTE workflow: `generate` -> `sign` -> `transmit`

Key directories:
- `src/controllers/` - DTE operations
- `src/services/` - Signature, transmission, validation
- `src/schemas/` - JSON schemas for DTE validation
- `src/queue/` - Transmission queue worker
- `src/jobs/` - Contingency resend job
- `src/signature/` - Digital signature handling
- `src/transmission/` - Hacienda API communication

### Database (`database/`)
MySQL migrations. Key tables: `companies`, `branches`, `products`, `customers`, `users`, `sales`, `purchases`, `payments`, `movements`, `kardex`, `dte_documents`.

## Key Integration Patterns

### Catalog/List Pages (per CATALOG_RULES.md)
- Backend: `GET` methods accept `search`, `page`, `limit` params; return `{ data, total, page, totalPages }`
- Frontend: Use `<Table />` with loading state, `<Pagination />`, search with 500ms debounce
- TanStack Query: `queryKey: ['resource', search, page]`

### DTE Integration (per DTE_API_RULES.md)
- Main server calls DTE API endpoints with JWT auth and `x-company-id` header
- DTE API URL: `http://localhost:5000/api`
- Full emit flow: `POST /dte/emit` (single endpoint handles generate + sign + transmit)

### Header-Detail Layout Pages (per UI_DESIGN_RULES.md)
- Horizontal header grid for metadata (branch, type, number, date, client)
- Detail table below with max space
- Right sidebar for totals and action buttons
- F3 global shortcut opens product search modal
- Product validation: must be `status === 'activo'` and branch in product's `branches` array

## Environment Configuration

### Main Server (`.env`)
- `PORT=4000`
- Uses `db_sistema_saas` database

### DTE API (`.env`)
- `PORT=5000`
- Same database: `db_sistema_saas`
- `HACIENDA_ENV=test|production` - Switches Hacienda endpoints
- `SIGNATURE_MODE=internal|external` - Internal uses stored certificate, external calls external signer

## UI Conventions
- Text labels: `text-[11px] font-bold text-slate-500 uppercase`
- Input content: `text-[13px] font-medium`
- Color palette: Indigo/Slate with `rounded-xl` or `rounded-2xl` borders
- All UI text in Spanish
