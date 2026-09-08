# Report Design Rules (Reglas Obligatorias para Reportes)

Este documento establece las directrices obligatorias para la creación o modificación de cualquier reporte en el sistema SaaS (Ventas, Inventario, Compras, CXC, CXP, Operaciones y Contabilidad).

---

## 1. Generación de PDF en Backend (`reportPdfHelper.js`) — OBLIGATORIO

TODO reporte nuevo en PDF debe utilizar exclusivamente las utilidades de `server/src/utils/reportPdfHelper.js` para garantizar un formato visual institucional y uniforme:

### Helper Central
- **Inicialización**:
  ```javascript
  const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape'); // o 'portrait'
  ```
  - `landscape`: Reportes con 5 o más columnas (ancho útil: 732pt).
  - `portrait`: Reportes con 1 a 4 columnas (ancho útil: 552pt).
  - Tamaño siempre `LETTER`, margen de `30pt` y `bufferPages: true`.

- **Encabezado Institucional Contable**:
  ```javascript
  reportPdfHelper.renderHeader(doc, company, 'TÍTULO DEL REPORTE', periodText, 'landscape', subtitle);
  ```
  Incluye:
  - Estampa de tiempo superior izquierda: `DD/MM/YYYY HH:mm:ss`.
  - Razón social en negrita mayúscula (`Helvetica-Bold`, 11pt, `#0f172a`).
  - Título del reporte en negrita (`Helvetica-Bold`, 9.5pt, `#0f172a`).
  - Subtítulo opcional (sucursal, filtros específicos, cliente, etc.).
  - Identificación fiscal centrada: `NUMERO DE REGISTRO DE I.V.A. : {NRC}   |   NIT : {NIT}`.
  - Período centrado (ej: `DEL 01/01/2026 AL 31/01/2026` o `AL 31/01/2026`).
  - Leyenda monetaria obligatoria: `(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)`.
  - Línea divisoria sutil (`#e2e8f0`, 0.75pt).

- **Tablas y Columnas**:
  - Encabezado con barra de fondo `#f1f5f9` (altura 14pt).
  - Texto de columnas en `Helvetica-Bold`, 6.5pt a 7.5pt, color `#0f172a`.
  - Línea inferior `#cbd5e1` (0.5pt).
  - Columnas numéricas/monetarias siempre alineadas a la derecha (`align: 'right'`).

- **Formato Monetario Contable**:
  - Usar siempre `reportPdfHelper.fmt(valor)`:
    - Cero o nulo: `$ -`
    - Negativo: `$(X.XX)`
    - Positivo: `$ X.XX`

- **Totales y Subtotales**:
  - Línea superior del total general: `1pt` color `#0f172a`.
  - Texto en negrita `Helvetica-Bold`.
  - Línea inferior de cierre: `1pt` color `#0f172a`.

- **Control de Salto de Página (CRÍTICO)**:
  - Verificar `doc.y > 510` (landscape) o `doc.y > 700` (portrait) antes de dibujar cada fila.
  - Al saltar página: `doc.addPage()` + `drawHeader()` + `drawTableHeader()`.

- **Pie de Cierre y Paginación**:
  ```javascript
  reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Registros');
  reportPdfHelper.renderPageNumbers(doc);
  doc.end();
  return await getBuffer();
  ```
  Imprime `Número de {Entidad} Impresas : N`, `FIN DEL REPORTE.` y `Página X de Y` en el centro inferior de cada página.

---

## 2. REGLA ESTRICTA: SIN FIRMAS EN REPORTES OPERACIONALES

- **Los reportes operacionales (Ventas, Inventario, Compras, Gastos, CXC, CXP, Arqueos, Rentabilidad, etc.) NO DEBEN LLEVAR BLOQUE DE FIRMAS**.
- Queda prohibido invocar `renderSignatures` o añadir recuadros de firmas en reportes operacionales.
- Las firmas quedan reservadas exclusivamente para los estados financieros contables oficiales (Balance General, Estado de Resultados, etc.).

---

## 3. Exportación a Excel (Backend) — OBLIGATORIA

Todo endpoint de reporte debe aceptar `?format=excel` y generar el archivo usando `excelService`:
```javascript
if (req.query.format === 'excel') {
    const buffer = await excelService.createExcelBuffer({
        sheets: [{
            name: 'NombreHoja',
            columns: [{ header: 'Columna', key: 'campo', width: 20 }],
            data: rows
        }]
    });
    return excelService.sendExcelResponse(res, buffer, 'reporte.xlsx');
}
```

---

## 4. Frontend: `<ReportLayout>` y `<Money>`

- Toda pantalla de reporte en React (`client/src/pages/`) debe utilizar el componente `<ReportLayout>` (`client/src/components/ui/ReportLayout.jsx`).
- Debe incluir siempre la prop `onExportExcel`.
- Todos los montos monetarios en pantalla deben usar `<Money>` de `components/ui/Money.jsx` (respetando el permiso `view_amounts`).
