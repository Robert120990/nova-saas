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
- `onExportExcel`: Función opcional para exportar a Excel. Debe incluirse en TODOS los reportes.

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

## 2. Exportación a Excel

Todos los reportes deben incluir la opción de exportar a Excel.

### Frontend
Se pasa la prop `onExportExcel` a `ReportLayout`. El componente muestra automáticamente el botón "Exportar Excel" cuando `pdfUrl` y `onExportExcel` están presentes.

### Backend
El mismo endpoint del PDF debe aceptar `?format=excel` y retornar un archivo Excel usando `excelService.createExcelBuffer()` y `excelService.sendExcelResponse()`.

### Flujo:
1. Frontend llama al mismo endpoint con `format: 'excel'` y `responseType: 'blob'`
2. Backend detecta `req.query.format === 'excel'`, genera el Excel y retorna antes de la generación del PDF
3. Frontend recibe el blob y lo descarga como `.xlsx`

### Estructura del Excel (`excelService.createExcelBuffer`):
```javascript
const buffer = await excelService.createExcelBuffer({
    sheets: [{
        name: 'NombreHoja',
        columns: [
            { header: 'Columna', key: 'key', width: 20 },
        ],
        data: rows.map(r => ({
            key: r.campo,
        }))
    }]
});
return excelService.sendExcelResponse(res, buffer, 'reporte.xlsx');
```

## 3. Generación de PDF (Backend) — Estándar Contable Unificado (OBLIGATORIO)

Todos los reportes nuevos en PDF (tanto operacionales como contables) deben generarse utilizando el helper centralizado `server/src/utils/reportPdfHelper.js` para mantener una identidad visual 100% idéntica, profesional y consistente en todo el sistema.

### Helper Central: `server/src/utils/reportPdfHelper.js`

El helper provee las funciones requeridas para todo el ciclo de vida del reporte:
- `getCompanyInfo(companyId)`: Obtiene `razon_social`, `nit`, `nrc`, y sucursal de la empresa.
- `createPdfDocument(orientation, options)`: Inicializa el `PDFDocument` con `size: 'LETTER'`, margen de `30pt` y `bufferPages: true`. Retorna `{ doc, getBuffer }`.
- `renderHeader(doc, company, title, periodText, orientation, subtitle)`: Renderiza el encabezado institucional contable estandarizado.
- `fmt(val)`: Formateo contable de divisas (`$ -` para ceros/nulos, `$(X.XX)` para negativos, `$ X.XX` para positivos).
- `formatDate(date)`: Formato de fecha uniforme `DD/MM/YYYY`.
- `renderClosingFooter(doc, startX, currentY, count, entityName)`: Renderiza el conteo de registros ("Número de {Entidad} Impresas : N") y la leyenda "FIN DEL REPORTE.".
- `renderPageNumbers(doc)`: Paginación dinámica "Página X de Y" centrada en el pie de página de todo el documento.

### Reglas de Diseño Visual

1. **Orientación y Dimensiones**:
   - `landscape` (apaisada): Para reportes con 5 o más columnas. Ancho útil: **732pt** (`startX = 30`, margen derecho `30`).
   - `portrait` (vertical): Para reportes con 1 a 4 columnas. Ancho útil: **552pt** (`startX = 30`, margen derecho `30`).
2. **Encabezado Institucional Contable (`renderHeader`)**:
   - Estampa de tiempo superior izquierda: `DD/MM/YYYY HH:mm:ss` (`Helvetica-Bold`, 7pt, `#475569`).
   - Razón social en negrita mayúscula (`Helvetica-Bold`, 11pt, `#0f172a`).
   - Título del reporte en mayúsculas (`Helvetica-Bold`, 9.5pt, `#0f172a`).
   - Subtítulo opcional (sucursal, filtros específicos, vendedor, etc.).
   - Identificación tributaria centrada: `NUMERO DE REGISTRO DE I.V.A. : {NRC}   |   NIT : {NIT}`.
   - Período centrado (ej: `DEL 01/01/2026 AL 31/01/2026` o `AL 31/01/2026`).
   - Leyenda monetaria obligatoria: `(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)`.
   - Línea divisoria sutil inferior (`#e2e8f0`, 0.75pt).
3. **Tablas y Encabezados de Columna**:
   - Barra de fondo `#f1f5f9` (altura `14pt` a `15pt`).
   - Texto de columnas en `Helvetica-Bold`, 6.5pt a 7.5pt, color `#0f172a`.
   - Línea inferior sutil `#cbd5e1` (0.5pt).
   - Columnas numéricas/monetarias siempre alineadas a la derecha (`align: 'right'`).
4. **Filas de Datos y Montos**:
   - Tipografía regular `Helvetica` (6.5pt a 7.5pt, `#0f172a`).
   - Textos largos truncados con elipsis para evitar desalineación de filas.
   - TODOS los montos monetarios formateados con `reportPdfHelper.fmt(valor)`.
5. **Totales y Resumen**:
   - Línea superior del total general: `1pt` color `#0f172a`.
   - Textos y valores en negrita `Helvetica-Bold`.
   - Línea inferior de cierre: `1pt` color `#0f172a`.
6. **Manejo de Salto de Página (CRÍTICO)**:
   - En landscape: verificar si `doc.y > 510` antes de dibujar una fila.
   - En portrait: verificar si `doc.y > 700` antes de dibujar una fila.
   - Si se supera el límite:
     ```javascript
     doc.addPage();
     drawHeader();      // Llama a reportPdfHelper.renderHeader(...)
     drawTableHeader(); // Dibuja la barra gris #f1f5f9 con las columnas
     ```
7. **Pie de Cierre y Paginación**:
   - Al finalizar todas las tablas y totales:
     ```javascript
     reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Registros');
     reportPdfHelper.renderPageNumbers(doc);
     doc.end();
     return await getBuffer();
     ```
8. **REGLA ESTRICTA: SIN FIRMAS EN REPORTES OPERACIONALES**:
   - Los reportes operacionales (Ventas, Inventario, Compras, Gastos, CXC, CXP, Arqueos, etc.) **NUNCA DEBEN INCLUIR FIRMAS** (no llamar a ningún método de firmas). Las firmas quedan reservadas única y exclusivamente para los estados financieros formales de contabilidad (Balance General, Estado de Resultados, etc.).

---

## 4. Patrón Estándar de Implementación (Backend)

```javascript
const reportPdfHelper = require('../utils/reportPdfHelper');

const generateCustomReportPDF = async (data) => {
    // 1. Resolver información de la empresa
    const company = await reportPdfHelper.getCompanyInfo(data.company_id);

    // 2. Crear documento PDF estandarizado
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const periodText = (data.start_date && data.end_date)
        ? `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`
        : 'TODOS LOS REGISTROS';
    const subtitle = data.branch_name ? `SUCURSAL: ${String(data.branch_name).toUpperCase()}` : null;

    const startX = 30;
    const totalWidth = 732; // 732 en landscape, 552 en portrait
    const colWidths = {
        fecha: 80,
        documento: 100,
        descripcion: 252,
        cantidad: 70,
        precio: 70,
        total: 160
    };

    const drawHeader = () => {
        reportPdfHelper.renderHeader(doc, company, 'TÍTULO DEL REPORTE', periodText, 'landscape', subtitle);
    };

    const drawTableHeader = () => {
        const y = doc.y;
        doc.rect(startX, y, totalWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        doc.text('FECHA', x, y + 3, { width: colWidths.fecha }); x += colWidths.fecha;
        doc.text('DOCUMENTO', x, y + 3, { width: colWidths.documento }); x += colWidths.documento;
        doc.text('DESCRIPCIÓN', x, y + 3, { width: colWidths.descripcion }); x += colWidths.descripcion;
        doc.text('CANTIDAD', x, y + 3, { align: 'right', width: colWidths.cantidad }); x += colWidths.cantidad;
        doc.text('PRECIO', x, y + 3, { align: 'right', width: colWidths.precio }); x += colWidths.precio;
        doc.text('TOTAL', x, y + 3, { align: 'right', width: colWidths.total });
        doc.moveTo(startX, y + 14).lineTo(startX + totalWidth, y + 14).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        doc.y = y + 18;
    };

    // Dibujar primera página
    drawHeader();
    drawTableHeader();

    // Loop de filas con paginación defensiva
    const items = data.items || [];
    let totalAcumulado = 0;

    items.forEach((item) => {
        if (doc.y > 510) { // 510 en landscape, 700 en portrait
            doc.addPage();
            drawHeader();
            drawTableHeader();
        }

        const y = doc.y;
        let x = startX;
        doc.font('Helvetica').fontSize(7).fillColor('#0f172a');

        doc.text(reportPdfHelper.formatDate(item.fecha), x, y, { width: colWidths.fecha, lineBreak: false }); x += colWidths.fecha;
        doc.text(String(item.documento || '---'), x, y, { width: colWidths.documento, lineBreak: false }); x += colWidths.documento;
        doc.text(String(item.descripcion || '---'), x, y, { width: colWidths.descripcion, lineBreak: false, ellipsis: true }); x += colWidths.descripcion;
        doc.text(parseFloat(item.cantidad || 0).toFixed(2), x, y, { align: 'right', width: colWidths.cantidad }); x += colWidths.cantidad;
        doc.text(reportPdfHelper.fmt(item.precio), x, y, { align: 'right', width: colWidths.precio }); x += colWidths.precio;
        doc.text(reportPdfHelper.fmt(item.total), x, y, { align: 'right', width: colWidths.total });

        totalAcumulado += parseFloat(item.total || 0);
        doc.y = y + 11;
    });

    // Totales finales
    if (doc.y > 500) {
        doc.addPage();
        drawHeader();
        drawTableHeader();
    }

    const totalsY = doc.y + 4;
    doc.moveTo(startX, totalsY).lineTo(startX + totalWidth, totalsY).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
    doc.text('TOTAL GENERAL:', startX, totalsY + 3, { width: colWidths.fecha + colWidths.documento + colWidths.descripcion });
    doc.text(reportPdfHelper.fmt(totalAcumulado), startX + totalWidth - colWidths.total, totalsY + 3, { align: 'right', width: colWidths.total });
    doc.moveTo(startX, totalsY + 15).lineTo(startX + totalWidth, totalsY + 15).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.y = totalsY + 22;

    // Cierre y paginación (SIN FIRMAS)
    reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Registros');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};
```

