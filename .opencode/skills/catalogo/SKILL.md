---
name: catalogo
description: Guía para crear o modificar catálogos y listados CRUD con búsqueda y paginación en el SaaS. Usar cuando se pida un nuevo catálogo, listado, ABM, pantalla de mantenimiento o módulo de lista (ej. clientes, productos, categorías).
---

# Skill: Catálogos / Listados

Fuente normativa autoritativa: [CATALOG_RULES.md](./CATALOG_RULES.md) (co-ubicada en esta carpeta). Plantillas reales de referencia: `client/src/pages/Categories.jsx` + `server/src/controllers/category.controller.js`.

## Checklist de implementación

### Backend (`server/`)
1. Controller en `src/controllers/<entidad>.controller.js` siguiendo patrón controller → service → model (SQL directo en service).
2. Todo método `GET` de listado soporta:
   - `search` → filtra campos principales con `LIKE %search%`
   - `page` (default 1) y `limit` (default 10)
   - Respuesta: `{ "data": [...], "total": 100, "page": 1, "totalPages": 10 }`
3. Registrar rutas en `src/routes/api.routes.js` con `verifyToken`, `checkPermission('<permiso>')` y `tenantMiddleware`.

### Frontend (`client/`)
4. Página en `src/pages/<Entidad>.jsx`; registrar ruta en `App.jsx`.
5. Búsqueda: input con ícono `Search` + **debounce ≥500ms**.
6. Paginación: componente `<Pagination />`.
7. TanStack Query: `queryKey: ['recurso', search, page]` (invalidación correcta).
8. Pasar `isLoading` al `<Table />` para spinner durante carga (evita falso "No se encontraron registros").
9. Si la página depende de otro catálogo paginado (ej. Productos ← Categorías), extraer `.data` del resultado de esa query.

### UI
10. Badges de estado interactivos cuando el negocio lo permita (toggle sin modal).
11. Botones de acción con íconos claros (`Edit`, `Trash2`) + tooltip o color distintivo.
12. Estándar compacto de tablas y tipografía según `.opencode/skills/nuevo-modulo/UI_DESIGN_RULES.md`.
13. **Montos SIEMPRE con `<Money>` / `<MoneyInput>`** (`components/ui/Money.jsx`, permiso `view_amounts`). Nunca `$${parseFloat(x).toFixed(2)}` directo.

### Cierre obligatorio
14. Responsividad móvil 320px-767px (usar skill `responsive-check` para verificar).
15. `cd client && npm run lint && npm run build` y `cd server && npm run lint`.
16. `node scripts/generate-project-structure.js` para actualizar ESTRUCTURA_PROYECTO.md.
