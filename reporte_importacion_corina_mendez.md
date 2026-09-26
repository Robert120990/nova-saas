# Informe Detallado de Importación de Datos

**Empresa Destino:** Corina Margarita Mendez de Sosa (ID: 8)  
**Fecha de Ejecución:** 20/9/2026, 4:56:58 p. m.  
**Duración del Proceso:** 107 segundos  

---

## 1. Resumen General de Importación

| Entidad | Origen Costa | Origen Miraflores | Bruto Combinado | Duplicados Fusionados | Registros Insertados en SaaS |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Clientes** | 3951 | 24816 | 28767 | 2804 | **25978** |
| **Proveedores** | 167 | 3750 | 3917 | 137 | **3780** |
| **Productos (Líneas 01 y 02)** | - | 118 | 118 | 0 | **118** |
| **Precios Asignados (2 Sucursales)** | - | - | - | - | **236** |
| **Asociaciones de Sucursal** | - | - | - | - | **236** |
| **Inventario Base Inicializado** | - | - | - | - | **236** |

---

## 2. Desglose del Algoritmo de Deduplicación

Se aplicó un algoritmo de resolución de identidades multinivel con evaluación de puntaje de completitud de datos (*Information Score*) y fusión inteligente (*Smart Merge*) de campos faltantes.

### Clientes:
- **Duplicados identificados por NRC:** 2241
- **Duplicados identificados por NIT:** 380
- **Duplicados identificados por DUI:** 30
- **Duplicados identificados por Nombre exacto normalizado:** 153
- **Total duplicados resueltos:** 2804
- **Prevalencia de registro con mayor información:**
  - Registro de Costa prevaleció: **1472** veces
  - Registro de Miraflores prevaleció: **1332** veces

### Proveedores:
- **Duplicados identificados por NRC:** 127
- **Duplicados identificados por NIT:** 4
- **Duplicados identificados por DUI:** 0
- **Duplicados identificados por Nombre exacto normalizado:** 6
- **Total duplicados resueltos:** 137
- **Prevalencia de registro con mayor información:**
  - Registro de Costa prevaleció: **109** veces
  - Registro de Miraflores prevaleció: **28** veces

---

## 3. Desglose de Productos y Precios (db_sipe_miraflores)

Los precios fueron extraídos de la tabla de origen `precios` vinculada a `productos` por `id_producto`.

### Categorías creadas/asociadas:
- **COMBUSTIBLES (ID: 118):** 16 productos
  - Unidad de medida: Galón (`55`, Catálogo MH CAT-014)
  - Tipo de item: Combustible (`3`)
  - Clasificación de combustible asignada: Regular (1), Super (2), Diesel (3)
- **LUBRICANTES (ID: 119):**
  - Unidad de medida: Unidad (`59`, Catálogo MH CAT-014)
  - Tipo de item: Bien (`1`)
  - **Identificadores:** Prefijo `L` agregado al inicio de `codigo` y `codigo_barra` (ej. `L1001`).

### Sucursales con Precios Configurados:
1. **Sucursal Puma Miraflores (ID: 4)**: 118 productos con precio asignado.
2. **Sucursal Puma Costa del Sol (ID: 8)**: 118 productos con precio asignado.
- Total filas en `product_branch_prices`: **236**
- Total filas en `product_branch`: **236**
- Total filas en `inventory`: **236**

---
*Proceso finalizado exitosamente sin pérdida de información ni duplicación de identidades fiscales.*
