---
name: responsive-check
description: Verifica y corrige la responsividad móvil (320px-767px) de pantallas del cliente usando el navegador Playwright MCP. Usar cuando se mencione responsive, móvil, 320px, 375px, PWA, o al cerrar cualquier cambio de UI en client/.
---

# Skill: Verificación de Responsividad Móvil

Fuente normativa autoritativa: [RESPONSIVE_RULES.md](./RESPONSIVE_RULES.md) (co-ubicada). El sistema es PWA usada en móviles: **ninguna pantalla puede romperse entre 320px y 767px**.

## Procedimiento con Playwright MCP

1. Asegurar que el dev server corre (`cd client && npm run dev`, puerto 3000).
2. `browser_navigate` a la URL de la pantalla.
3. `browser_resize` a **320x700** → `browser_snapshot` → buscar desbordes horizontales, elementos cortados, tablas sin scroll.
4. Repetir con **375x812**.
5. Si el MCP no está disponible, pedir al usuario verificar manualmente en DevTools a 320px/375px.

## Checklist de corrección (resumen de RESPONSIVE_RULES.md)

- **Grids**: nunca `grid-cols-N` (N≥2) sin base móvil. Patrón: `grid-cols-1 md:grid-cols-2`, `grid-cols-2 md:grid-cols-4`.
- **Cabeceras/barras**: `flex flex-col md:flex-row md:items-center justify-between gap-3`; tabs/botones con `flex-wrap`; búsqueda `flex-1 min-w-[180px]`.
- **Anchos fijos prohibidos** en layout (`w-64`, `w-80`, `w-[..px]`): usar `w-full md:w-<ancho>`. Botones de acción `w-full md:w-auto`.
- **Tablas nativas**: envolver SIEMPRE en `<div className="overflow-x-auto">`; jamás `overflow-hidden` sin scroll.
- **Tablas densas de edición**: clase `.table-cards` (definida en `client/src/index.css`) + `data-label="<texto del th>"` en cada `<td>`.
- **Modales**: preferir `components/ui/Modal.jsx` (bottom-sheet móvil); artesanal → `w-[95%] max-w-*` y grids internos responsive.
- **Formularios >2 columnas**: base `grid-cols-1` o `grid-cols-2` + `md:` para expandir; input+botones `flex-col md:flex-row`.
- **Prohibido**: `100vw` para anchos de layout; crear componentes redundantes (reusar `Table`, `Modal`, `Pagination`, `SearchableSelect`, `Money`).
- Los cambios NO deben alterar el comportamiento desktop ni handlers/refs existentes.

## Cierre obligatorio

```bash
cd client && npm run lint && npm run build
```

Reportar resultado: qué se corrigió por breakpoint y evidencia del snapshot final.
