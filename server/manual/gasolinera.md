# Gasolinera

Módulo especializado para la gestión de estaciones de servicio (gasolineras).

## Requisitos
- Permisos específicos para cada submódulo de Gasolinera

## Catálogos

### Distribuidores
Registre los distribuidores de combustible con sus datos de contacto y NIT.

### Islas
Configure las islas de despacho de combustible:
- Número de isla
- Asignación a sucursal

### Mangueras (Nozzles)
Gestión de mangueras de despacho:
- Número de manguera
- Asignación a isla
- Tipo de combustible (regular, premium, diésel)
- Tanque asociado
- Lectura inicial

### Tanques
Configure los tanques de almacenamiento:
- Capacidad total
- Tipo de combustible
- Sistema de medición

### Despachadores
Registre los despachadores (operadores) de la gasolinera.

### Mangueras × Despachador
Asigne qué mangueras puede operar cada despachador.

### Tipos de POS
Configure los tipos de punto de venta para la gasolinera.

## Cierre de Lecturas

Proceso diario de cierre de turno:

1. Vaya a **Gasolinera > Cierre Lecturas**
2. Seleccione el POS a cerrar
3. El sistema calcula:
   - Lectura inicial y final de cada manguera
   - Total de galones despachados
   - Total recaudado (efectivo, tarjeta, etc.)
   - Diferencias contra ventas registradas
4. Confirme el cierre
5. Imprima el reporte

## Anticipos de Clientes
- Registre anticipos recibidos de clientes
- Aplique anticipos a futuras ventas
- Reporte de anticipos pendientes

## Entrega de Remesas
- Registre las entregas de efectivo realizadas por despachadores
- Control de remesas pendientes
- Conciliación contra cierres de turno

## Reportes
- **Lecturas - Ventas** — Ventas de combustible por período
- **Detalle del Cierre** — Desglose detallado de cada cierre
- **Inventario de Combustible** — Existencias actuales en tanques
- **Galones Vendidos** — Totales por producto y período
