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

## Backend PDF (`server/src/services/pdf.service.js`)

- Orientación `landscape` si >4 columnas.
- **Salto de página CRÍTICO**: verificar `doc.y > 500` antes de cada fila; si salta, `doc.addPage()` + redibujar encabezado de tabla; capturar `y = doc.y` DESPUÉS del posible salto.
- Datos de empresa: usar `razon_social` de la tabla `companies` (NO la columna `nombre`).
- Montos dentro del PDF: `$` + `toFixed(2)`; totales en negrita al final.

> Nota: el formato `$X.XX` aplica SOLO al PDF generado en backend. En la interfaz React los montos SIEMPRE usan `<Money>` (permiso `view_amounts`) según AGENTS.md.

## Cierre obligatorio

Responsividad (skill `responsive-check`), `npm run lint && npm run build` en client, lint en server, y `node scripts/generate-project-structure.js`.
