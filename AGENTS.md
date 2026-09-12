# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> **Mapa de la estructura física del repo:** ver [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md)
> (generado con `node scripts/generate-project-structure.js`). Este archivo describe
> arquitectura y convenciones; aquel documenta cada carpeta/archivo existente.

## Project Overview

This is a multi-tenant SaaS system for Salvadoran businesses with DTE (Documentos Tributarios Electrónicos / Electronic Tax Document) integration. It consists of three main components:

- **Main Server** (`server/`) - Express.js backend on port 4000
- **Client** (`client/`) - React frontend with Vite on port 3000
- **DTE API** (`dte-api/`) - Separate Express.js API for DTE on port 5000

## Commands

### Server (Main Backend)
```bash
cd server
pnpm install        # Install dependencies
pnpm run dev        # Start with nodemon (development)
pnpm start          # Start with node (production)
```

### Client (Frontend)
```bash
cd client
pnpm install        # Install dependencies
pnpm run dev        # Start Vite dev server
pnpm run build      # Production build
pnpm run lint       # Run ESLint
pnpm run preview    # Preview production build
```

### DTE API
```bash
cd dte-api
pnpm install        # Install dependencies
pnpm run dev        # Start with nodemon
pnpm start          # Start with node
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
- `src/controllers/` - DTE operations (emit, signature, invalidation, retorno/ERET, retransmission, contingency)
- `src/services/` - Generator (`dteGenerator.js`), PDF, audit; subdirs: `dte/` (control numbers), `signature/` (internal node-forge / external signer), `retorno/`
- `src/transmission/` - Hacienda API communication (token + recepcionDTE)
- `src/queue/` - Transmission queue worker with retries
- `src/jobs/` - Contingency resend job
- `src/contingency/`, `src/invalidation/` - Event-specific logic
- `src/validators/` - ajv validation against official MH schemas
- Official JSON schemas live in `cumplientoDTE/svfe-json-schemas/` (NOT inside dte-api; the `schemas/`, `repositories/` dirs do not exist)

### Database (`database/`)
MySQL migrations versioned as `migration_vN_<description>.{sql|js}` with one `run_migration_v<N>.js` runner per version (~600+ files). For current schema use `server/src/config/db.schema.js`. Key tables: `companies`, `branches`, `products`, `customers`, `users`, `sales`, `purchases`, `payments`, `movements`, `kardex`, `dte_documents`.

## Key Integration Patterns

### Catalog/List Pages (per .opencode/skills/catalogo/CATALOG_RULES.md)
- Backend: `GET` methods accept `search`, `page`, `limit` params; return `{ data, total, page, totalPages }`
- Frontend: Use `<Table />` with loading state, `<Pagination />`, search with 500ms debounce
- TanStack Query: `queryKey: ['resource', search, page]`

### DTE Integration (per .opencode/skills/dte/DTE_API_RULES.md)
- Main server calls DTE API endpoints with JWT auth and `x-company-id` header
- DTE API URL: `http://localhost:5000/api`
- Full emit flow: `POST /dte/emit` (single endpoint handles generate + sign + transmit)

### Header-Detail Layout Pages (per .opencode/skills/nuevo-modulo/UI_DESIGN_RULES.md)
- Horizontal header grid for metadata (branch, type, number, date, client)
- Detail table below with max space
- Right sidebar for totals and action buttons
- F3 global shortcut opens product search modal
- Product validation: must be `status === 'activo'` and branch in product's `branches` array

### Responsividad Móvil (per .opencode/skills/responsive-check/RESPONSIVE_RULES.md) — OBLIGATORIO
Toda modificación de pantallas existentes y toda nueva opción/pantalla en `client/` DEBE ser totalmente responsive en dispositivos móviles (320px-767px). Reglas clave:
- Mobile-first: bases `grid-cols-1`/`grid-cols-2` con breakpoints `sm:`/`md:`/`lg:`; nunca grids fijos sin base móvil.
- Cabeceras/tabs/barras de búsqueda con `flex-col md:flex-row` o `flex-wrap`.
- Tablas nativas SIEMPRE con `overflow-x-auto`; tablas densas de edición con `.table-cards` + `data-label`.
- Probar en 320px y 375px + ejecutar `npm run lint` y `npm run build` antes de terminar.

### Reportes en PDF y Excel (per .opencode/skills/reporte/REPORT_DESIGN_RULES.md) — OBLIGATORIO
TODO nuevo reporte en PDF debe implementar el estándar contable unificado usando `server/src/utils/reportPdfHelper.js`:
- Documento: `reportPdfHelper.createPdfDocument('landscape' | 'portrait')` con tamaño `LETTER`, margen 30pt y `bufferPages: true`.
- Encabezado: `reportPdfHelper.renderHeader(doc, company, title, periodText, orientation, subtitle)` con timestamp de emisión, razón social en mayúsculas negrita, título, NRC, NIT, período centrado, leyenda `(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)` y línea divisoria `#e2e8f0`.
- Tablas: Barra de cabecera `#f1f5f9` (14pt), texto `#0f172a` negrita 7pt, línea inferior `#cbd5e1`.
- Monedas: Formatear exclusivamente con `reportPdfHelper.fmt(val)` (`$ -` para ceros/nulos, `$(X.XX)` para negativos).
- Paginación y Cierre: Salto defensivo (`doc.y > 510` en landscape o `> 700` en portrait), `reportPdfHelper.renderClosingFooter` ("Número de {Entidad} Impresas : N", "FIN DEL REPORTE.") y paginación dinámica centrada con `reportPdfHelper.renderPageNumbers(doc)`.
- **SIN FIRMAS**: Los reportes operacionales (ventas, inventario, compras, gastos, cxc, cxp, arqueos, rentabilidad) **NO llevan firmas** bajo ninguna circunstancia. Las firmas quedan reservadas para balances/estados contables.
- Exportación Excel: Todo endpoint debe soportar `?format=excel` antes de la generación PDF usando `excelService.createExcelBuffer` y `excelService.sendExcelResponse`.
- Frontend: Usar `<ReportLayout>` (`client/src/components/ui/ReportLayout.jsx`) con `onExportExcel`. `<ReportLayout>` integra obligatoriamente el botón "Expandir" en la cabecera/título y el visor `<PdfViewerModal>` estilo planillas (`max-w-6xl h-[92vh]`), garantizando que todo reporte convencional cuente con vista modal interactiva sin código repetitivo.

### Claves de Permiso Únicas en el Menú y Roles (menu_items & permission_key) — OBLIGATORIO
La matriz de asignación de permisos para los roles (`Roles.jsx`) se construye dinámicamente desde `menu_items` deduplicando por `permission_key`:
- **NUNCA REUTILIZAR CLAVES DE PERMISO**: Cada nueva opción de menú, módulo secundario o reporte DEBE tener su propio `permission_key` único en la tabla `menu_items`. Reutilizar una clave ya existente enmascara las demás opciones en Roles haciéndolas invisibles y no configurables.
- **Nomenclatura Obligatoria**:
  - Módulos/Pantallas operativas: `manage_<modulo>_<accion_o_pantalla>` (ej: `manage_rh_acciones_personal`, `manage_accounting_correlativos`).
  - Reportes/Libros: `view_<modulo>_<reporte>_report` o `view_<modulo>_<reporte>` (ej: `view_rh_isss_report`, `view_purchase_checks_report`, `view_inventory_valuation_report`).
  - Visibilidad general/Módulos: `view_<modulo>`.
- **Migraciones con Herencia**: Al agregar un nuevo ítem en `menu_items` mediante migración, se debe actualizar la tabla `roles` para añadir la nueva clave a los roles administrativos (`SuperAdmin`, `Admin`) y a los roles que ya tengan acceso al módulo padre, evitando que los usuarios pierdan el acceso de forma imprevista.

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
- **Todos los montos monetarios deben usar el componente `<Money>` de `components/ui/Money.jsx`**. No renderizar `$X.XX` directamente con `parseFloat().toFixed(2)`. Esto asegura que el permiso `view_amounts` funcione globalmente para ocultar montos según el rol del usuario.
- **Para inputs de montos usar `<MoneyInput>`** (named export de `components/ui/Money.jsx`). Reemplaza `<input type="number" value={...}>` con `<MoneyInput value={...} onChange={...}>` para que el valor también se oculte si el usuario no tiene permiso `view_amounts`.

## Git Workflow & Commit Rules — OBLIGATORIO

- **Autorización Expresa Obligatoria del Usuario — NUNCA SUBIR AUTOMÁTICAMENTE**:
  - Queda ESTRICTAMENTE PROHIBIDO ejecutar `git commit` o `git push` de forma automática o por iniciativa propia del agente.
  - Todos los cambios deben permanecer exclusivamente en el entorno local del usuario para su revisión y prueba.
  - ÚNICAMENTE se debe realizar commit o push cuando el usuario dé la instrucción expresa y directa (por ejemplo: "sube los cambios", "haz commit y push", etc.).
- **Idioma de los Commits**:
  - TODOS los mensajes de commit DEBEN redactarse en **español** (por ejemplo: `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...` con descripción clara en español).
  - Queda estrictamente prohibido redactar mensajes de commit en inglés.
- **Commits Atómicos y Separados — OBLIGATORIO**:
  - Queda estrictamente prohibido mezclar funcionalidades no relacionadas o tareas distintas en un solo commit combinado.
  - Cada funcionalidad, módulo, reporte o corrección de error debe tener su propio commit independiente con los archivos que le corresponden estrictamente (por ejemplo: `feat(inventario): ...`, `fix(dte): ...`).
- **Verificación Previa Obligatoria antes de `git push`**:
  - Antes de realizar cualquier `git push` hacia el repositorio remoto (GitHub / origin):
    1. Ejecutar obligatoriamente `git fetch origin` (o la rama remota correspondiente) para comprobar el estado actualizado en GitHub.
    2. Verificar con `git status` o inspeccionar diferencias (`git log HEAD..origin/<rama>`) para comprobar si la rama local está al día o retrasada.
    3. Si existen cambios remotos en GitHub (`Your branch is behind...`), se DEBE ejecutar `git pull --rebase origin <rama>` (o `git pull`) y resolver cualquier posible conflicto antes de publicar cambios.
    4. Solo proceder con `git push` una vez que la rama local esté completamente sincronizada, limpia y sin conflictos con el repositorio remoto en GitHub.
