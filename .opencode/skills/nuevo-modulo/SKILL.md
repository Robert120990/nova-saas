---
name: nuevo-modulo
description: Checklist integral para agregar un módulo/entidad nueva de punta a punta en el SaaS. Usar cuando se pida un nuevo módulo, entidad, pantalla completa o funcionalidad que involucre base de datos + backend + frontend.
---

# Skill: Nuevo Módulo (punta a punta)

Fuente normativa autoritativa de UI: [UI_DESIGN_RULES.md](./UI_DESIGN_RULES.md) (co-ubicada). Mapa del repo: `ESTRUCTURA_PROYECTO.md`. Convenciones generales: `AGENTS.md` en la raíz.

## Checklist ordenado

### 1. Base de datos (`database/`)
- [ ] Migración `migration_v<N>_<descripcion>.sql` (o `.js`) usando el siguiente número de versión libre
- [ ] Runner `run_migration_v<N>.js` copiando el patrón de una versión anterior inmediata

### 2. Backend (`server/src/`)
- [ ] `controllers/<entidad>.controller.js` — patrón controller → service → model
- [ ] `services/<entidad>.service.js` — lógica y SQL; si es listado, cumplir formato `{data,total,page,totalPages}` (skill `catalogo`)
- [ ] Registrar rutas en `routes/api.routes.js` con `verifyToken` + `checkPermission('<permiso>')` + tenant
- [ ] Multi-tenancy: toda query filtrada por empresa vía `tenantMiddleware`

### 3. Menú y permisos
- [ ] Ítem de menú dinámico: tabla de menu_items / `menuItem.controller.js` (+ ícono en `client/src/config/iconMap.js`)
- [ ] Permisos del rol nuevos registrados (matriz de `UserAccess.jsx`; incluir `view_amounts` si el módulo muestra montos)

### 4. Frontend (`client/src/`)
- [ ] Página(s) en `src/pages/` (+ subcarpeta temática si agrupa varias, como `rh/` o `EggIndustrial/`)
- [ ] Ruta en `App.jsx` con guard de permiso
- [ ] Solo componentes estándar: `Table`, `Modal`, `Pagination`, `SearchableSelect`, `ConfirmDialog`
- [ ] **Montos SIEMPRE `<Money>` / `<MoneyInput>`** (`components/ui/Money.jsx`)
- [ ] Estándares visuales y tipográficos de UI_DESIGN_RULES.md (labels `text-[11px] font-bold text-slate-500 uppercase`, inputs `text-[13px] font-medium`, paleta Indigo/Slate, bordes `rounded-xl`/`rounded-2xl`, textos en español)
- [ ] Si es pantalla de movimiento de ítems: layout cabecera-detalle + atajo **F3** + validaciones de producto (`status === 'activo'` y sucursal dentro de `product.branches`)

### 5. Cierre obligatorio
- [ ] Responsividad móvil 320px-767px verificada (usar skill `responsive-check` con Playwright MCP)
- [ ] `cd client && npm run lint && npm run build`
- [ ] `cd server && npm run lint`
- [ ] `node scripts/generate-project-structure.js` → regenerar ESTRUCTURA_PROYECTO.md
- [ ] Actualizar AGENTS.md/CLAUDE.md solo si se introduce un patrón nuevo de integración
