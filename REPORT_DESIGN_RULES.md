# Reglas de Diseño de Reportes (Premium)

Este documento establece las normas obligatorias para la creación de nuevos reportes dentro del sistema SaaS. El objetivo es mantener una experiencia de usuario (UX) coherente, visualmente impactante y técnica mente robusta.

## 1. Interfaz de Usuario (Frontend)

Todos los reportes deben utilizar el componente reutilizable `ReportLayout` (ubicado en `client/src/components/ui/ReportLayout.jsx`).

### Uso de `ReportLayout`
El componente recibe las siguientes propiedades:
- `title`: Título principal (ej: "Reporte de Stock").
- `subtitle`: Descripción corta del reporte.
- `category`: Etiqueta de categoría (ej: "Inventario").
- `children`: Los filtros y selectores que irán en el sidebar.
- `pdfUrl`: URL del blob o archivo PDF (si es null, muestra placeholder).
- `isGenerating`: Bloquea la UI con un cargador mientras se genera.
- `onGenerate`: Función disparada al hacer clic en el botón principal.
- `onDownload`: Función opcional para la descarga del archivo.
- `canGenerate`: Booleano para habilitar/deshabilitar el botón de generación.

### Estándares de Layout
- **Ancho del Contenedor**: Máximo `1400px` con padding responsivo (`p-4 md:p-8`).
- **Animaciones**: Usar `animate-in fade-in duration-700` para transiciones suaves.
- **Cabecera**: Título en `text-4xl`, `font-black`, con un `span` indicador de categoría (ej: "Inventario") en color base Indigo.

### Estándares de Filtros (Sidebar)
- **Contenedor**: Tarjeta blanca con `rounded-[2rem]`, sombra `shadow-xl` y `p-8`.
- **Labels**: Usar `text-[10px]`, `font-black`, `uppercase`, `tracking-widest` con iconos de `lucide-react`.
- **Inputs**: Estilo consistente con bordes `slate-100` y enfoque en `indigo-500`.
- **Botón de Acción**: Siempre en la parte inferior, `bg-slate-900`, `font-black`, `uppercase`, `tracking-[0.2em]`.

### Visualización de PDF
- **Loading State**: Siempre mostrar un overlay con `backdrop-blur-sm` y un spinner animado durante la generación.
- **Embed**: Usar un `iframe` que ocupe el resto del espacio disponible, con altura mínima de `750px`.

## 2. Generación de PDF (Backend)

Ubicado en `server/src/services/pdf.service.js`.

### Estándares Técnicos
- **Orientación**: Preferiblemente `landscape` para reportes con más de 4 columnas.
- **Manejo de Páginas (CRÍTICO)**:
    - **Verificación de Posición**: Antes de dibujar una fila, verificar si `doc.y` supera el límite (ej: `500` en landscape).
    - **Salto de Página**: Si es necesario, llamar a `doc.addPage()` y **redibujar el encabezado de la tabla** inmediatamente.
    - **Captura de Y**: Capturar la variable `y = doc.y` **después** de cualquier posible salto de página para asegurar que el texto no se dibuje fuera del área visible.
- **Datos de Empresa**: Siempre consultar `razon_social` de la tabla `companies` (no usar la columna `nombre`).

### Formateo
- **Monedas**: Usar prefijo `$` y `toFixed(2)`.
- **Totales**: Formatear en negrita al final de la tabla con líneas de separación claras.

## 3. Ejemplo de Implementación (Backend)

```javascript
// Patrón de loop robusto
data.products.forEach((p) => {
    if (doc.y > 500) {
        doc.addPage();
        drawTableHeader(); // Función que dibuja los nombres de las columnas
    }
    const y = doc.y;
    doc.text(p.nombre, startX, y);
    doc.moveDown(1.2);
});
```
