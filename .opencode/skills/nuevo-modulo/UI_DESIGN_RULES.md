# Reglas de Diseño de Interfaz (UI/UX) - Sistema SaaS

Este documento establece el estándar para las pantallas de **Encabezado y Detalle** (como Inventario, Compras, Facturación, etc.) para asegurar una experiencia de usuario consistente y eficiente.

## 1. Estructura de Layout (Encabezado y Detalle)
- **Cabecera Horizontal:** La información de configuración (Sucursal, Tipo, Número, Fecha, Proveedor/Cliente, Motivo, Observaciones) debe situarse en la parte **superior** en un diseño de rejilla (grid) horizontal.
- **Área de Detalle:** Se ubica debajo de la cabecera, maximizando el espacio para la tabla de productos o ítems.
- **Resumen/Totales:** Se prefiere una barra lateral derecha (sidebar) para los totales y botones de acción principal (Guardar/Anular), permitiendo que el detalle sea el foco principal.

## 2. Funcionalidad de Búsqueda y Atajos (F3)
- **Atajo F3:** Toda pantalla de movimiento de ítems **DEBE** implementar el atajo de teclado global `F3` para invocar el buscador de productos.
- **Modal de Selección:** El buscador debe ser un modal visual que permita filtrado rápido por nombre o código.
- **Flujo de Carga Ágil:**
  - Al seleccionar un producto (desde el modal o vía código de barras), este se precarga en una zona de "Carga Rápida".
  - **Foco Automático:** El sistema debe situar inmediatamente el cursor en el campo **Cantidad**.
  - **Confirmación:** Al presionar `Enter` en el campo final (Cantidad o Costo), el ítem se añade al detalle y el foco regresa al buscador de código de barras.

## 3. Estándar Compacto para Tablas (Catálogos y Listados)

Todas las pantallas de tipo listado/catálogo (tablas con búsqueda y paginación) **DEBEN** seguir este estándar para minimizar el espacio vertical:

| Elemento | Clases |
|---|---|
| Contenedor principal | `space-y-3` |
| Título | `text-xl font-bold` |
| Subtítulo | `text-slate-500 text-[11px] font-medium` |
| Botón "Nuevo" | `px-4 py-1.5 rounded-xl font-bold text-sm` |
| Input de búsqueda | `w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium` |
| Icono de búsqueda | `size={15}`, posicionado `left-3` |
| Header de tabla (`<th>`) | `px-4 py-1.5 text-[10px] font-bold` |
| Celdas de tabla (`<td>`) | `px-3 py-1 text-xs` |
| Icono decorativo en celda | `p-1` con `size={12}`, gap entre icono y texto: `gap-2` |
| Botones de acción (editar/eliminar) | `p-1` con `size={15}`, gap entre botones: `gap-1` |
| Estados vacío/cargando | `py-6 text-center` |

### 3.1. Ordenamiento Interactivo por Columna (Sorting Obligatorio)

Toda tabla de datos del sistema (catálogos, listados, historiales, etc.) **DEBE** implementar ordenamiento interactivo por columnas siguiendo el estándar visual de **Historial de Ventas**:

1. **Componente Estándar `<Table />`:**
   - `<Table />` (`client/src/components/ui/Table.jsx`) integra soporte nativo y automático de ordenamiento interactivo tanto en escritorio como en vista móvil (`renderCard`).
   - Detecta e infiere automáticamente el campo y tipo de orden (`number`, `date`, `string`) a partir de la etiqueta del encabezado y los datos provistos.
   - Las columnas de control (`Acciones`, `Opciones`, checkboxes de selección múltiple) se omiten automáticamente del ordenamiento.
   - Si se requiere control manual o server-side (ordenamiento en base de datos para listados paginados), `<Table />` acepta las props controladas `sortBy`, `sortDir` y `onSort={(key, dir, type) => ...}`.

2. **Estilo Visual e Íconos:**
   - **Ícono inactivo:** `<ArrowUpDown size={11} className="text-slate-400 opacity-60 group-hover:opacity-100 shrink-0" />`
   - **Ícono activo ascendente (asc):** `<ArrowUp size={12} className="text-indigo-600 shrink-0" />`
   - **Ícono activo descendente (desc):** `<ArrowDown size={12} className="text-indigo-600 shrink-0" />`
   - **Texto del encabezado activo:** `text-indigo-600 font-bold text-[10px] uppercase tracking-wider`
   - **Texto del encabezado inactivo:** `text-slate-500 hover:text-slate-800 font-bold text-[10px] uppercase tracking-wider`
   - **Badge contextual de dirección:** Toda columna activa muestra un badge indicador con la clase:
     `px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8.5px] font-extrabold normal-case tracking-normal border border-indigo-200/80`
     * **Monetario / Numérico:** `Menor→Mayor` (asc) o `Mayor→Menor` (desc)
     * **Fechas / Cronológico:** `Antiguas` (asc) o `Recientes` (desc)
     * **Alfabético / Texto:** `A→Z` (asc) o `Z→A` (desc)


## 5. Estándares Tipográficos
Para mantener la jerarquía visual solicitada por el usuario:
- **Etiquetas de Campo (Labels):** Deben ser consistentes. Recomendado: `text-[11px] font-bold text-slate-500 uppercase`.
- **Contenido del Input (Contenido):** Debe ser ligeramente más grande que la etiqueta pero compacto. Recomendado: `text-[13px] font-medium`.

## 6. Idioma y Formato
- **Interfaz (UI):** Todo el texto visible para el usuario (botones, etiquetas, mensajes) debe estar escrito en **Español**.
- **Consistencia:** Mantener el uso de la paleta de colores actual (Indigo/Slate) y el estilo de bordes redondeados (`rounded-xl` o `rounded-2xl`).

## 7. Validaciones de Producto (Agregado al Detalle)
Para garantizar la integridad de los datos en cualquier método de ingreso (F3, Barcode o Manual):
- **Estado Activo:** Solo se pueden agregar productos con `status === 'activo'`. El sistema debe rechazar e informar si el producto está inactivo.
- **Autorización por Sucursal:** Se debe validar que el ID de la sucursal seleccionada esté presente en el array de sucursales (`branches`) del producto.
- **Error Feedback:** Cualquier rechazo por validación debe notificarse mediante un mensaje de error claro (Toast) en Español.

## 8. Clave de Permiso en Menú (`permission_key`) — OBLIGATORIO
- Toda nueva opción de menú o pantalla operativa registrada en `menu_items` DEBE tener un `permission_key` único (formato `manage_<modulo>_<pantalla>`).
- Nunca reutilizar una clave existente de otro módulo o submódulo. En Roles, las claves duplicadas provocan que las opciones adicionales queden enmascaradas e invisibles.

---
> [!IMPORTANT]
> Estas reglas son de cumplimiento obligatorio para cualquier nuevo desarrollo o refactorización de módulos operativos en el sistema.

