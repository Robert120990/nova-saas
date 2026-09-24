# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> **Mapa de la estructura física del repo:** ver [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md)
> (generado con `node scripts/generate-project-structure.js`). Este archivo describe
> arquitectura y convenciones; aquel documenta cada carpeta/archivo existente.

## Project Overview

This is Sipe Web SaaS, a multi-tenant SaaS system for Salvadoran businesses with DTE (Documentos Tributarios Electrónicos / Electronic Tax Document) integration. It consists of three main components:

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

### Multi-tenancy & User Assignment Model — ARQUITECTURA OFICIAL
- **Usuarios Globales**: Los usuarios (`users`) son identidades globales a nivel de plataforma y NO están subordinados rígidamente a una única empresa.
- **Asignación Administrativa y Delegación RBAC**: Un `SuperAdmin` o cualquier rol al que se le haya delegado el permiso correspondiente (`manage_users` / `manage_user_access`) es quien asigna y autoriza a qué empresas y sucursales puede acceder cada usuario mediante la tabla puente `usuario_empresa` (`has_access = 1`, `role_id`) y `usuario_sucursal`. No está restringido a nombres de roles fijos.
- **Visibilidad Global en Gestión de Accesos**: En la pantalla de Asignación de Accesos (`UserAccess.jsx`), los usuarios se consultan y exponen globalmente (`/api/all-users`, `/api/users/access-summary`) sin filtro de empresa previa, ya que esto es indispensable por diseño para que los usuarios con permiso delegado puedan vincular a cualquier usuario con cualquier empresa del sistema.
- **Aislamiento Operativo**: Una vez autenticado y posicionado dentro del contexto de una empresa (`x-company-id`), `tenantMiddleware` valida el acceso multi-tenant asegurando que los usuarios no-SuperAdmin tengan asignación activa (`has_access = 1`) en `usuario_empresa` para esa empresa específica.

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

### Manejo Defensivo de Catálogos y Listas en Frontend — OBLIGATORIO
Para evitar errores de tiempo de ejecución como `X.map is not a function`:
- Las respuestas del backend pueden venir como arreglos directos `[...]` o envueltas en `{ data: [...], pagination: {...} }`.
- Al consultar cualquier lista o catálogo en `client/`, se DEBE usar obligatoriamente el helper `unwrapList` de `utils/apiUtils.js`:
  ```javascript
  import { unwrapList } from '../utils/apiUtils';
  // En useQuery:
  queryFn: async () => unwrapList(await axios.get('/api/endpoint'))
  ```
- En el renderizado JSX, blindar siempre defensivamente cualquier iteración:
  `{(Array.isArray(items) ? items : []).map(...)}`

### Modularización Obligatoria de Modales en Frontend (Zero Inline Modals) — OBLIGATORIO
Queda estrictamente prohibido incrustar la estructura JSX y lógica interna de modales directamente dentro de las pantallas en `client/src/pages/`:
- **Componente Separado**: Todo modal que contenga formularios, tablas, escáneres, subida de archivos o flujos interactivos DEBE crearse en su propio archivo independiente dentro de `client/src/components/<modulo>/`.
- **Nomenclatura**: Debe nombrarse en CamelCase finalizando obligatoriamente con el sufijo `Modal.jsx` (ej. `GasReadingsModal.jsx`, `EggAgreementModal.jsx`, `SaleDetailModal.jsx`).
- **Contrato de Props Estándar**: Cada modal debe ser un componente controlado que reciba como mínimo:
  - `open` (o `isOpen`): booleano de visibilidad con retorno temprano `if (!open) return null;` (o render condicional en el padre).
  - `onClose`: función callback para cerrarlo y resetear su estado.
  - `onSave` / `onSubmit` / `onSuccess`: callback de confirmación o guardado.
- **Barrel Exports**: Si el módulo contiene múltiples componentes o modales, se debe mantener un archivo `index.js` en `client/src/components/<modulo>/` para centralizar y limpiar las importaciones en las páginas.

### Modularización Obligatoria de Pantallas en Frontend (Component-Driven Architecture, Máx. 350 Líneas) — OBLIGATORIO
Toda nueva pantalla en `client/src/pages/<PageName>.jsx` (y cualquier refactorización de pantallas existentes) DEBE ser modular y NO debe exceder las **350 líneas de código**.
La modularización en componentes separados dentro de `client/src/components/<modulo>/` es obligatoria cuando se cumpla CUALQUIERA de las siguientes condiciones:
1. **Pantallas con Pestañas (Tabs o Vistas Conmutables)**:
   - Si la pantalla contiene 2 o más pestañas o sub-vistas (ej. *Listado*, *Historial*, *Resumen*, *Configuración*), queda estrictamente prohibido incrustar la lógica y JSX de las pestañas en la página principal.
   - Cada pestaña DEBE residir en su propio componente bajo `client/src/components/<modulo>/tabs/<TabName>.jsx`.
   - La página en `pages/` actúa únicamente como orquestador del estado del tab activo y renderizado condicional.
2. **Umbral de Extensión (> 350 Líneas)**:
   - Si el archivo de la página supera las 350 líneas, sus secciones visuales (filtros avanzados, resúmenes/KPIs, barras de herramientas, formularios) deben extraerse a subcomponentes independientes en `client/src/components/<modulo>/` (ej. `<ModuloFiltersBar />`, `<ModuloSummaryCards />`, etc.).
3. **Flujos Transaccionales y Maestro-Detalle (Header-Detail)**:
   - Pantallas operativas (facturación, compras, recepción, caja, despachos, órdenes) deben estructurarse obligatoriamente en subcomponentes:
     - Cabecera de metadatos: `<ModuloHeader />`
     - Grilla/Tabla editable de partidas: `<ModuloItemsTable />`
     - Barra lateral de totales y liquidación: `<ModuloTotalsSidebar />`
     - Barra de atajos o acciones: `<ModuloActionBar />`
4. **Barrel Exports**:
   - Toda carpeta `client/src/components/<modulo>/` debe mantener un archivo `index.js` que centralice y exponga limpiamente todos los subcomponentes y modales.

### Modularización Obligatoria en Backend (Controllers y Services Desacoplados, Máx. 350 Líneas) — OBLIGATORIO
Todo nuevo controlador en `server/src/controllers/` o `dte-api/src/controllers/` (y refactorizaciones) DEBE respetar el principio de responsabilidad única y NO debe exceder las **350 líneas de código**.
La división en submódulos especializados es obligatoria si se cumple CUALQUIERA de las siguientes condiciones:
1. **Umbral de Extensión (> 350 Líneas)**:
   - Si un controlador supera las 350 líneas, DEBE dividirse en una subcarpeta dedicada `src/controllers/<modulo>/` agrupando por dominio (ej: `<modulo>Core.controller.js`, `<modulo>Reports.controller.js`, `<modulo>Audits.controller.js`).
2. **Múltiples Responsabilidades en un Solo Módulo**:
   - Si un módulo agrupa operaciones CRUD básicas junto con analítica avanzada, liquidaciones complejas o generación de reportes en PDF/Excel, cada dominio debe desacoplarse en su propio subcontrolador.
3. **Patrón Fachada / Barrel Export Obligatorio**:
   - Todo controlador modularizado DEBE mantener o crear el archivo raíz `src/controllers/<modulo>.controller.js` como una fachada limpia que reexporte todas las funciones de los subcontroladores (`module.exports = { ...moduloCore, ...moduloReports }`). Esto garantiza compatibilidad absoluta con `routes/api.routes.js` sin alterar las rutas existentes.
4. **Desacoplamiento de Lógica Pesada a Servicios (`services/`)**:
   - Cálculos matemáticos o financieros (algoritmos FIFO, depreciaciones, deducciones de nómina), transformaciones masivas de datos y generadores de documentos deben residir exclusivamente en `src/services/<modulo>.service.js`, manteniendo los controladores ligeros y enfocados en validar entradas y responder solicitudes HTTP.

### Formateo Unificado de Fechas en Frontend (dateUtils) — OBLIGATORIO
Toda modificación o nueva pantalla, componente o modal en `client/` DEBE utilizar obligatoriamente los formateadores centralizados de `client/src/utils/dateUtils.js`:
- `formatDate(date, options)`: para fechas convencionales (`DD/MM/YYYY`).
- `formatDateTime(date)`: para timestamps con fecha y hora (`DD/MM/YYYY HH:mm`).
- `formatTime(date)`: para horas exclusivas (`HH:mm` o `HH:mm:ss`).
Queda estrictamente prohibido redefinir funciones locales `const formatDate = ...` o realizar manipulaciones manuales ad-hoc de strings para fechas. Esto garantiza coherencia de zona horaria y localización salvadoreña (`es-SV`) en toda la plataforma.

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
- **Generación No Bloqueante en Backend (Worker Threads Pool) — OBLIGATORIO**: Toda exportación a Excel y generación pesada de reportes DEBE realizarse a través de `excelService.createExcelBuffer` o `reportWorkerPool.service.js`. Queda estrictamente prohibido instanciar o manipular directamente `ExcelJS` dentro de controladores o rutas; todo cómputo intensivo de CPU debe delegarse al pool de Worker Threads para mantener el Event Loop del servidor 100% receptivo y no bloquear peticiones concurrentes como ventas o DTEs.
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
