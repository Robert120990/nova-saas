# Productos

Gestión del catálogo de productos del sistema.

## Requisitos
- Permiso: `manage_products`

## Operaciones

### Crear un producto

1. Vaya a **Catálogos > Productos**
2. Haga clic en **Nuevo Producto**
3. Complete los campos del formulario:

**Información General**
- **Código** — Código interno único del producto
- **Código de Barras** — Código de barras del producto (opcional)
- **Nombre del Producto** — Nombre descriptivo
- **Categoría** — Seleccione una categoría existente

**Información Fiscal**
- **Unidad de Medida** — Seleccione según catálogo MH (Ej: 59 = Unidad)
- **Tipo de Ítem** — Bien o Servicio
- **Tipo de Operación** — Gravada, Exenta, No Sujeta
- **Código MH** — Código del catálogo de Hacienda
- **IVA** — Porcentaje de IVA del producto

**Inventario**
- **Mínimo** — Cantidad mínima para alerta de stock
- **Máximo** — Cantidad máxima
- **¿Controla inventario?** — Activa/desactiva el kardex

**Disponibilidad**
- **Precio por sucursal** — Configure precios de venta por sucursal
- **Asignación a POS** — Seleccione en qué puntos de venta estará disponible

4. Haga clic en **Guardar**

### Editar un producto

1. Haga clic en el icono de lápiz junto al producto
2. Modifique los campos necesarios
3. Guarde los cambios

### Buscar productos

- Use el campo de búsqueda para filtrar por nombre o código
- La búsqueda tiene un retardo de 500ms para evitar llamadas innecesarias

### Asignación de precios

Los precios se administran por sucursal a través de la tabla de precios:
- Cada producto puede tener precios diferentes por sucursal
- Desde Productos > editar > pestaña Disponibilidad > Precios
- También puede gestionarlos desde la página de precios masivos

## Categorías

La categorización de productos se realiza desde **Catálogos > Categorías**.
Puede crear, editar y eliminar categorías para organizar su catálogo.
