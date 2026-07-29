# Ventas (POS)

Módulo de punto de venta para facturación electrónica.

## Requisitos
- Permiso: `manage_pos_terminal`
- Sucursal y POS configurados
- Configuración fiscal completada (NIT, NRC, etc.)

## Terminal de venta (POS)

### Flujo de venta

1. Seleccione el **tipo de documento**: Factura (01), Crédito Fiscal (03), Exportación (11)
2. Agregue productos al carrito:
   - **Opción 1**: Use el selector de productos (icono +)
   - **Opción 2**: Presione **F3** para abrir búsqueda rápida de productos
   - **Opción 3**: Código de barras con lector
3. Ajuste cantidades y descuentos por producto si es necesario
4. Seleccione el cliente:
   - Busque un cliente existente
   - Ingrese un nombre para consumidor final
   - Los datos fiscales se cargan automáticamente
5. Seleccione el **método de pago**:
   - **Efectivo (01)**
   - **Cheque (02)**
   - **Transferencia/depósito (03)**
   - **Tarjeta crédito/débito (04)**
   - **Crédito (05)** — Genera cuenta por cobrar
   - Puede dividir el pago en múltiples métodos
6. Confirme la venta

### Procesamiento

Al confirmar la venta el sistema:
1. Genera el DTE (Documento Tributario Electrónico)
2. Firma el documento digitalmente
3. Transmite a Hacienda (si hay conexión)
4. Imprime el ticket automáticamente (si hay impresora configurada)
5. Actualiza el inventario (kardex)
6. Registra la cuenta por cobrar (si aplica)

## Historial de ventas

### Consultar ventas
- Busque por número de control, cliente o rango de fechas
- Vea el detalle completo de cada venta

### Reimprimir ticket
- Desde el detalle de la venta, haga clic en **Reimprimir Ticket**
- El ticket se imprimirá en la impresora térmica configurada

### Anular una venta (Nota de Crédito)
1. Abra el detalle de la venta
2. Haga clic en **Nota de Crédito**
3. Seleccione los items a anular
4. Confirme la anulación
5. El sistema genera el DTE de anulación y lo transmite a Hacienda

## Descuentos

### Descuentos por cliente
- Permite asignar descuentos específicos a clientes en productos seleccionados
- Se aplican automáticamente al facturar

### Reglas de descuento
- Defina reglas por: rango de precios, categorías, días de la semana
- Horarios especiales y fechas de vigencia
- Aplicación automática en el POS

## Combos
- Agrupe productos en combos con precio especial
- Al vender un combo, se descargan todos los productos individuales del inventario

## Corte de caja
1. Vaya a **Ventas > Corte de Caja**
2. Seleccione el POS a cerrar
3. Verifique los totales
4. Confirme el cierre
5. Imprima el reporte de cierre

## Contingencia DTE
- Cuando Hacienda no está disponible, active el modo contingencia
- Los DTE se generan con número de contingencia y se almacenan para envío posterior
- Desde **Ventas > Contingencia DTE** puede gestionar los documentos pendientes

## Reportes de ventas
- **Reporte de Ventas** — Resumen por período
- **Ventas Diarias** — Detalle día a día
- **Ventas por Categoría** — Agrupado por categoría de producto
- **Ventas por POS** — Ventas consolidadas por punto de venta
