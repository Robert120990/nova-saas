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

## 3. Estándares Tipográficos
Para mantener la jerarquía visual solicitada por el usuario:
- **Etiquetas de Campo (Labels):** Deben ser consistentes. Recomendado: `text-[11px] font-bold text-slate-500 uppercase`.
- **Contenido del Input (Contenido):** Debe ser ligeramente más grande que la etiqueta pero compacto. Recomendado: `text-[13px] font-medium`.

## 4. Idioma y Formato
- **Interfaz (UI):** Todo el texto visible para el usuario (botones, etiquetas, mensajes) debe estar escrito en **Español**.
- **Consistencia:** Mantener el uso de la paleta de colores actual (Indigo/Slate) y el estilo de bordes redondeados (`rounded-xl` o `rounded-2xl`).

## 5. Validaciones de Producto (Agregado al Detalle)
Para garantizar la integridad de los datos en cualquier método de ingreso (F3, Barcode o Manual):
- **Estado Activo:** Solo se pueden agregar productos con `status === 'activo'`. El sistema debe rechazar e informar si el producto está inactivo.
- **Autorización por Sucursal:** Se debe validar que el ID de la sucursal seleccionada esté presente en el array de sucursales (`branches`) del producto.
- **Error Feedback:** Cualquier rechazo por validación debe notificarse mediante un mensaje de error claro (Toast) en Español.

---
> [!IMPORTANT]
> Estas reglas son de cumplimiento obligatorio para cualquier nuevo desarrollo o refactorización de módulos operativos en el sistema.
