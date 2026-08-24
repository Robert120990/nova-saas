# Reglas de Responsividad Móvil - Sistema SaaS

Este documento es **obligatorio** para TODA modificación de pantallas existentes y TODA nueva opción/pantalla del cliente (`client/`). El sistema se usa en dispositivos móviles (PWA), por lo que ninguna pantalla puede romperse ni desbordarse en pantallas de **320px a 767px**.

Regla general: **mobile-first**. Escribe primero el layout para móvil (apilado) y usa prefijos `sm:`/`md:`/`lg:` para expandir en pantallas grandes. El diseño de escritorio **no debe alterarse**; las reglas móviles solo aplican por debajo del breakpoint.

## 1. Verificación obligatoria
- Toda pantalla nueva o modificada DEBE probarse visualmente en modo dispositivo a **320px y 375px** (DevTools) además de escritorio.
- Antes de terminar, ejecutar: `npm run lint` y `npm run build` en `client/`.

## 2. Grids (regla crítica)
- NUNCA usar `grid-cols-2`, `grid-cols-3`, `grid-cols-4`, `grid-cols-12` sin base móvil.
- Patrón correcto: `grid-cols-1 md:grid-cols-2` / `grid-cols-2 md:grid-cols-4` / `grid-cols-1 lg:grid-cols-4` (base apilada o 2 columnas máx. en móvil).
- En modales de detalle: `grid-cols-1 sm:grid-cols-2` (o `md:`).

## 3. Cabeceras y barras de acciones
- Cabecera de página con título + botones/tabs: `flex flex-col md:flex-row md:items-center justify-between gap-3`.
- Contenedores de tabs/botones: agregar `flex-wrap`.
- Barras de búsqueda + botones de exportación: `flex flex-wrap items-center justify-between gap-3` con el input `flex-1 min-w-[180px]`.

## 4. Anchura de elementos de layout
- Evitar anchos fijos en contenedores: `w-64`, `w-72`, `w-80`, `w-[...px]`, `min-w-[...]` en layout.
- En móvil deben ser `w-full` y recuperar el ancho con breakpoint: `w-full md:w-40`, `w-full md:w-64`, `w-full sm:w-24`.
- Inputs de "carga rápida" (código/cantidad/costo): apilar verticalmente en móvil (`flex-col md:flex-row` o grid `grid-cols-2 md:grid-cols-[...]`). Los botones de acción `w-full md:w-auto`.

## 5. Tablas
- **Listados/historiales:** usar el componente `<Table />` de `components/ui/Table.jsx` (ya incluye `overflow-x-auto`). Si se usa `<table>` nativo, envolver SIEMPRE en `<div className="overflow-x-auto">`. NUNCA dejar una tabla en un contenedor `overflow-hidden` sin scroll horizontal.
- **Tablas densas de edición de ítems** (inputs en celdas): usar la clase utilitaria `.table-cards` (definida en `client/src/index.css`, media query `max-width: 767px`) + atributo `data-label="..."` en cada `<td>` (la etiqueta = texto del `<th>`). Así cada fila se convierte en tarjeta apilada con etiqueta + valor en móvil y el desktop queda intacto.
- Celdas con texto largo: `truncate`/`max-w-[...]` solo en desktop; en tarjetas el CSS ya lo resetea.

## 6. Modales
- Preferir el componente `components/ui/Modal.jsx` (bottom-sheet en móvil). Si se usa un modal artesanal (`fixed inset-0`): `w-[95%] max-w-*`, padding `p-4 md:p-8` y grids internos responsive (ver regla 2).
- Tablas dentro de modales: misma regla de `overflow-x-auto` / `.table-cards`.

## 7. Formularios
- Grids de formulario con más de 2 columnas: base `grid-cols-1` o `grid-cols-2` con `md:` para expandir.
- Filas con input + botones (ej. escaneo de código): `flex flex-col md:flex-row` (botones `w-full md:w-auto`).

## 8. Restricciones
- NO crear componentes nuevos redundantes: reutilizar `Table`, `Modal`, `Pagination`, `SearchableSelect`, `Money`/`MoneyInput`, y la clase `.table-cards`.
- NO usar `100vw` para anchos de layout (falla en móvil); usar `w-full`, `fixed left-2 right-2` o breakpoints.
- Todo cambio debe mantener el comportamiento/funcionalidad existente (handlers, refs, imports).
