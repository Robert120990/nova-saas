# Inventario

Control de inventario, kardex y movimientos de productos.

## Requisitos
- Permiso: `manage_inventory_adjustments` (movimientos)
- Permiso: `manage_transfers` (traslados)
- Permiso: `manage_physical_inventory` (inventario físico)

## Traslados entre sucursales

### Crear un traslado

1. Vaya a **Inventario > Traslados**
2. Haga clic en **Nuevo Traslado**
3. Seleccione **origen** y **destino** (sucursales)
4. Agregue los productos y cantidades a trasladar
5. Confirme el traslado
6. El sistema ajusta el inventario de origen y destino automáticamente

**Estado de traslados:**
- **Pendiente** — Creado pero no procesado
- **En tránsito** — Enviado desde origen
- **Recibido** — Confirmado en destino

## Movimientos de ajuste

Permite ajustar el inventario por: entrada, salida, ajuste por conteo o merma.

### Crear un movimiento

1. Vaya a **Inventario > Movimientos**
2. Seleccione el **tipo de movimiento**
3. Seleccione el producto
4. Ingrese la **cantidad** y el **motivo**
5. Guarde

El sistema registra el movimiento en el kardex.

## Inventario Físico

1. Vaya a **Inventario > Inventario Físico**
2. Cree un nuevo conteo
3. Seleccione la sucursal
4. Capture los productos con sus cantidades reales
5. El sistema calcula las diferencias contra el inventario lógico
6. Confirme para ajustar el inventario

## Kardex

Consulta detallada del movimiento de cada producto:

- **Fecha y hora** de la transacción
- **Tipo de movimiento** (entrada/salida/ajuste)
- **Documento** que originó el movimiento
- **Cantidades**: entrada, salida, saldo
- **Costos**: unitario y total

### Filtrar kardex
- Por producto
- Por rango de fechas
- Por tipo de movimiento
- Por sucursal

## Reportes
- **Reporte de Stock** — Existencia actual de todos los productos
- **Reporte de Movimientos** — Historial de movimientos por período
