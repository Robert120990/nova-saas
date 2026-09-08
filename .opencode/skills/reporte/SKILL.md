---
name: reporte
description: Guía para crear páginas de reportes con vista PDF y exportación a Excel en el SaaS. Usar cuando se pida un nuevo reporte, informe, exportación Excel/PDF, o modificar reportes existentes (balances, ventas, inventario).
---

# Skill: Reportes

Fuente normativa autoritativa: [REPORT_DESIGN_RULES.md](./REPORT_DESIGN_RULES.md) (co-ubicada). Ejemplos reales: `client/src/pages/InventoryStockReport.jsx` y `client/src/components/ui/ReportLayout.jsx`.

## Frontend: `<ReportLayout>` obligatorio

Componente: `client/src/components/ui/ReportLayout.jsx`. Props clave:

- `title`, `subtitle`, `category` (etiqueta tipo "Inventario")
- `children` → filtros del sidebar
- `pdfUrl` (blob o null → placeholder), `isGenerating`, `onGenerate`, `canGenerate`
- `onDownload` (opcional) y **`onExportExcel` (obligatorio en TODOS los reportes)**

Estándares visuales: contenedor máx `1400px` con `p-4 md:p-8`; título `text-4xl font-black`; filtros en tarjeta `rounded-[2rem] shadow-xl p-8` con labels `text-[10px] font-black uppercase tracking-widest` + íconos lucide; PDF embebido en `iframe` de mín `750px` con overlay `backdrop-blur-sm` durante generación.

## Exportación Excel (obligatoria)

Mismo endpoint del PDF aceptando `?format=excel`:

1. Frontend llama con `format: 'excel'` + `responseType: 'blob'`
2. Backend detecta `req.query.format === 'excel'` y retorna ANTES de generar el PDF:
   ```js
   const buffer = await excelService.createExcelBuffer({
     sheets: [{ name: 'Hoja', columns: [{ header: 'Columna', key: 'k', width: 20 }], data }],
   });
   return excelService.sendExcelResponse(res, buffer, 'reporte.xlsx');
   ```
   (`server/src/services/excel.service.js`)

## Backend PDF (`server/src/utils/reportPdfHelper.js` y `server/src/services/pdf.service.js`)

TODO reporte nuevo en PDF debe usar obligatoriamente `reportPdfHelper.js`:
- Inicializar con `reportPdfHelper.createPdfDocument('landscape' | 'portrait')` (`size: 'LETTER'`, márgenes 30pt).
- Encabezado contable unificado con `reportPdfHelper.renderHeader(doc, company, title, periodText, orientation, subtitle)`: timestamp superior izquierda, razón social en mayúsculas negrita, título, identificación fiscal (NRC y NIT), período, leyenda de moneda en dólares y línea divisoria `#e2e8f0`.
- Tablas: barra de encabezado `#f1f5f9` (14pt altura), texto `#0f172a` negrita 7pt, línea inferior `#cbd5e1`.
- Formato monetario: usar `reportPdfHelper.fmt(valor)` (`$ -` para 0, `$(X.XX)` para negativos).
- **Salto de página CRÍTICO**: verificar `doc.y > 510` (landscape) o `doc.y > 700` (portrait) antes de cada fila; si salta, `doc.addPage()` + `drawHeader()` + `drawTableHeader()`; capturar `y = doc.y` DESPUÉS del posible salto.
- Totales generales con línea superior de 1pt `#0f172a` y línea inferior de cierre de 1pt.
- Pie de cierre con `reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Entidad')`.
- Paginación dinámica `Página X de Y` centrada en el pie con `reportPdfHelper.renderPageNumbers(doc)`.
- **REGLA ESTRICTA DE FIRMAS: SIN FIRMAS en reportes operacionales** (ventas, compras, inventario, gastos, cxc, cxp). Las firmas son exclusivas para balances/estados contables.

> Nota: el formato numérico contable aplica SOLO al PDF generado en backend. En la interfaz React los montos SIEMPRE usan `<Money>` (permiso `view_amounts`) según AGENTS.md.

## Cierre obligatorio

Responsividad (skill `responsive-check`), `npm run lint && npm run build` en client, lint en server, y `node scripts/generate-project-structure.js`.

