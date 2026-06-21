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

**Ejemplo de estructura:**
```jsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-900">Título</h2>
      <p className="text-slate-500 text-[11px] font-medium">Subtítulo</p>
    </div>
    <button className="px-4 py-1.5 rounded-xl font-bold text-sm ...">
      Nuevo
    </button>
  </div>
  <div className="relative max-w-sm">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
    <input className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium ..." />
  </div>
  <Table
    headers={[...]}
    renderRow={(item) => (
      <tr>
        <td className="px-3 py-1 text-xs">...</td>
        <td className="px-3 py-1 flex gap-1">
          <button className="p-1 ..."><Edit size={15}/></button>
          <button className="p-1 ..."><Trash2 size={15}/></button>
        </td>
      </tr>
    )}
  />
</div>
```

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

---
> [!IMPORTANT]
> Estas reglas son de cumplimiento obligatorio para cualquier nuevo desarrollo o refactorización de módulos operativos en el sistema.
