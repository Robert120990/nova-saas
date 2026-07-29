# Compras

Gestión de compras, gastos y documentos de proveedores.

## Requisitos
- Permiso: `manage_purchases_list`

## Gestión de Compras

### Registrar una compra

1. Vaya a **Compras > Gestión de Compras**
2. Haga clic en **Nueva Compra**
3. Seleccione el **proveedor**
4. Agregue los productos o servicios adquiridos
5. Ingrese los montos, impuestos y descuentos
6. Seleccione el **tipo de compra**: Contado o Crédito
7. Guarde la compra
8. Si el proveedor factura con DTE, puede cargar el XML para asociarlo

## Gastos

### Registrar un gasto

1. Vaya a **Compras > Gastos**
2. Haga clic en **Nuevo Gasto**
3. Seleccione el tipo de gasto
4. Ingrese el monto y descripción
5. Seleccione el método de pago
6. Guarde

## Cheques al Contado

### Solicitar un cheque

1. Vaya a **Compras > Chq Contado**
2. Seleccione el proveedor
3. Ingrese el monto y concepto
4. Seleccione la cuenta bancaria
5. Confirme la solicitud

### Aprobar un cheque
- Los cheques requieren aprobación según permisos
- Una vez aprobado, pasa a la cola de impresión

## Quedan (documentos por pagar)

### Registrar un Quedan

1. Vaya a **Compras > Quedan**
2. Seleccione el proveedor
3. Ingrese los datos del documento: monto, fecha de vencimiento
4. Guarde

El sistema registrará automáticamente la cuenta por pagar.

## Periodo de Compras

Configure períodos contables para la gestión de compras mensuales, con fechas de apertura y cierre.

## Reportes
- **Reporte de Compras** — Resumen de compras por período
- **Reporte de Gastos** — Gastos agrupados por categoría
- **Reporte de Quedan** — Documentos por pagar
