/**
 * db.schema.js
 * Complete database schema description for the Novas AI assistant.
 * Update this file whenever new tables or columns are added to the database.
 */

const DB_SCHEMA = `
=== ESQUEMA COMPLETO DE LA BASE DE DATOS NOVAS SAAS ===

REGLAS DE MULTI-TENENCIA:
- Cada empresa tiene su propio 'company_id' y sus sucursales tienen 'branch_id'.
- SIEMPRE filtra por {COMPANY_ID} (empresa del usuario autenticado) en todas las consultas.
- SIEMPRE filtra por {BRANCH_ID} (sucursal del usuario) cuando la tabla tenga 'branch_id'.
- Usa los placeholders literales {COMPANY_ID} y {BRANCH_ID}; el sistema los reemplazará de forma segura.

REGLA DE NOMBRES (MUY IMPORTANTE):
- NUNCA muestres IDs crudos en los resultados. Siempre usa JOINs para obtener nombres legibles.
- Ejemplo: en lugar de mostrar 'branch_id: 2', haz JOIN con 'branches' y muestra 'sucursal: Centro'.
- Ejemplo: en lugar de mostrar 'customer_id: 45', haz JOIN con 'customers' y muestra 'cliente: Juan Pérez'.

---

## MÓDULO: EMPRESAS Y SUCURSALES

### companies (Empresas)
- id, nit, nrc, razon_social, nombre_comercial, actividad_economica
- direccion, departamento, municipio, correo, telefono
- tipo_contribuyente ENUM('Persona Natural','Persona Jurídica')
- ambiente ENUM('test','produccion'), dte_active BOOLEAN
- logo_url, created_at, updated_at

### branches (Sucursales)
- id, company_id, codigo, nombre
- direccion, departamento, municipio, telefono, correo
- tipo_establecimiento, codigo_mh, logo_url, created_at
- FK: company_id → companies.id

### points_of_sale (Puntos de Venta / Cajas)
- id, branch_id, company_id, codigo, nombre
- status ENUM('activo','inactivo'), created_at

---

## MÓDULO: USUARIOS Y ACCESO

### users (Usuarios del sistema)
- id, company_id, role_id, username, nombre, email
- status ENUM('activo','inactivo'), created_at

### roles (Roles)
- id, name, permissions (JSON), created_at

### usuario_empresa (Acceso usuario-empresa)
- usuario_id, empresa_id, role_id, has_access, created_at

### usuario_sucursal (Acceso usuario-sucursal)
- usuario_id, sucursal_id, created_at

---

## MÓDULO: CLIENTES

### customers (Clientes)
- id, company_id, nombre, nombre_comercial
- tipo_documento, numero_documento, nit, nrc
- direccion, departamento, municipio, pais
- telefono, correo, tipo_contribuyente
- condicion_fiscal ENUM('contribuyente','gran contribuyente','exento IVA','exento impuestos','sujeto excluido')
- aplica_iva, exento_iva, aplica_fovial, aplica_cotrans
- tipo_operacion ENUM('local','exportacion'), created_at

---

## MÓDULO: PROVEEDORES

### providers (Proveedores)
- id, company_id, nombre, nombre_comercial
- tipo_documento, numero_documento, nit, nrc
- direccion, departamento, municipio, telefono, correo
- created_at
- FK: company_id → companies.id

---

## MÓDULO: PRODUCTOS E INVENTARIO

### products (Productos)
- id, company_id, codigo, nombre, descripcion
- precio DECIMAL, costo DECIMAL, unidad_medida
- tipo_producto ENUM('bien','servicio')
- category_id, provider_id
- stock_minimo, afecto_iva, exento_iva
- aplica_fovial, aplica_cotrans
- tipo_combustible (para estaciones de combustible)
- created_at
- FK: company_id → companies.id

### product_categories (Categorías de Producto)
- id, company_id, name (nombre de categoría), description, created_at

### product_branch (Productos habilitados por sucursal)
- product_id, branch_id
- FK: product_id → products.id, branch_id → branches.id

### inventory (Stock actual por sucursal)
- id, product_id, branch_id, company_id, stock DECIMAL
- created_at, updated_at
- FK: product_id → products.id, branch_id → branches.id

### inventory_movements (Kardex / Movimientos de inventario)
- id, company_id, branch_id, product_id
- tipo_movimiento ENUM('ENTRADA','SALIDA','AJUSTE','TRANSFERENCIA')
- cantidad DECIMAL, costo DECIMAL, saldo_anterior DECIMAL, saldo_nuevo DECIMAL
- tipo_documento (texto: VENTA, COMPRA, AJUSTE, etc.), documento_id
- fecha, created_at
- FK: product_id → products.id

### physical_inventory (Inventario Físico / Conteo)
- id, company_id, branch_id, product_id
- stock_sistema DECIMAL, stock_fisico DECIMAL, diferencia DECIMAL
- estado ENUM('pendiente','aprobado','rechazado')
- observaciones, created_at

---

## MÓDULO: VENTAS

### sales_headers (Cabeceras de Ventas / Facturas)
- id, company_id, branch_id, customer_id (puede ser NULL para consumidor final)
- seller_id, pos_id, shift_id
- tipo_documento VARCHAR (01=Factura, 03=Crédito Fiscal, 04=Nota de Remisión, 05=Nota de Crédito, 11=FEX)
- dte_type, numero_control, codigo_generacion (UUID del DTE)
- condicion_operacion INT (1=CONTADO, 2=CREDITO)
- payment_condition INT (1=CONTADO, 2=CREDITO)
- estado VARCHAR (emitido, ANULADO)
- fecha_emision DATE, hora_emision TIME
- total_gravado, total_exento, total_nosujetas DECIMAL
- total_iva, fovial, cotrans DECIMAL
- descuento_general, iva_percibido, iva_retenido DECIMAL
- total_pagar DECIMAL (monto total de la venta)
- cliente_nombre (nombre manual si no hay customer_id)
- observaciones, sello_recepcion
- created_at TIMESTAMP

### sales_items (Ítems / Líneas de Venta)
- id, sale_id, product_id (puede ser NULL si es combo), combo_id
- descripcion, cantidad DECIMAL
- precio_unitario DECIMAL, monto_descuento DECIMAL
- venta_gravada DECIMAL, venta_exenta DECIMAL
- tributos JSON
- FK: sale_id → sales_headers.id, product_id → products.id

### sales_payments (Pagos de Ventas)
- id, sale_id, metodo_pago (01=Efectivo, 02=Tarjeta, etc.)
- monto DECIMAL, referencia, created_at

### sellers (Vendedores)
- id, company_id, branch_id, nombre, codigo, email, telefono
- status ENUM('activo','inactivo'), created_at

### shifts (Turnos de Caja)
- id, branch_id, company_id, pos_id, user_id
- fecha_apertura, hora_apertura, fondo_inicial
- fecha_cierre, hora_cierre, monto_cierre
- status ENUM('abierto','cerrado'), created_at

---

## MÓDULO: CUENTAS POR COBRAR (CXC)

### customer_payments (Pagos de Clientes — CXC)
- id, company_id, branch_id, customer_id
- monto DECIMAL, fecha DATE
- metodo_pago, referencia, concepto
- sale_ids JSON (IDs de facturas que abona)
- created_at
- FK: customer_id → customers.id

---

## MÓDULO: COMPRAS (CXP)

### purchase_headers (Cabeceras de Compras)
- id, company_id, branch_id, provider_id, usuario_id
- fecha DATE, numero_documento
- tipo_documento_id VARCHAR (01=Factura, 03=Crédito Fiscal, 06=Nota de Crédito, etc.)
- condicion_operacion_id (1=CONTADO, 2=CREDITO)
- total_nosujeta, total_exenta, total_gravada DECIMAL
- iva, retencion, percepcion, fovial, cotrans DECIMAL
- monto_total DECIMAL
- status ENUM('emitido','ANULADO')
- period_year INT, period_month INT
- observaciones, created_at

### purchase_items (Ítems de Compras)
- id, purchase_id, product_id
- cantidad DECIMAL, precio_unitario DECIMAL, total DECIMAL
- FK: purchase_id → purchase_headers.id

### provider_payments (Pagos a Proveedores — CXP)
- id, company_id, branch_id, provider_id
- monto DECIMAL, fecha DATE
- metodo_pago, referencia, concepto
- purchase_ids JSON (IDs de compras que abona)
- created_at
- FK: provider_id → providers.id

---

## MÓDULO: GASTOS (Gastos Administrativos / Otros Gastos)

### expense_headers (Cabeceras de Gastos)
- id, company_id, branch_id, provider_id, usuario_id
- fecha DATE, numero_documento
- tipo_documento_id (cat_002_tipo_dte), condicion_operacion_id (cat_016_condicion_operacion)
- total_nosujeta, total_exenta, total_gravada DECIMAL
- iva, retencion, percepcion, fovial, cotrans DECIMAL
- monto_total DECIMAL
- status ENUM('emitido','ANULADO')
- period_year INT, period_month INT
- observaciones, created_at
- FK: provider_id → providers.id

### expense_items (Detalle de Gastos)
- id, expense_id, description, expense_type_id, tax_type, total
- FK: expense_id → expense_headers.id, expense_type_id → cat_expense_types.id

### cat_expense_types (Tipos de Gastos)
- id, company_id, name, description, created_at

---

## MÓDULO: DTE (DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS)

### dtes (Documentos DTE emitidos)
- id, codigo_generacion (UUID), numero_control, tipo_dte
- company_id, branch_id, usuario_id
- status ENUM('PENDING','VALIDATED','SIGNED','SENT','ACCEPTED','REJECTED','ERROR','CONTINGENCY')
- ambiente ENUM('00','01') — 00=Test, 01=Producción
- sello_recepcion, fh_procesamiento, created_at

### dte_events (Log de eventos DTE)
- id, dte_id, event_type, description, created_at

---

## MÓDULO: CATÁLOGOS DTE (Tablas de referencia)

### cat_002_tipo_dte (Tipos de Documento)
- code, description
- Ejemplo: '01'='Factura de Consumidor Final', '03'='Comprobante de Crédito Fiscal'

### cat_016_condicion_operacion (Condiciones de Operación)
- code, description
- Ejemplo: '1'='Contado', '2'='Al Crédito'

---

## MÓDULO: AJUSTES DE INVENTARIO

### inventory_adjustments (Ajustes de inventario por diferencias)
- id, company_id, branch_id, product_id
- cantidad_ajuste DECIMAL (positivo = entrada, negativo = salida)
- motivo, estado, usuario_id, created_at

---

## MÓDULO: COMBOS DE PRODUCTOS

### product_combos (Combos)
- id, company_id, branch_id, nombre, descripcion
- precio DECIMAL, status ENUM('activo','inactivo'), created_at

### product_combo_items (Productos dentro de combos)
- id, combo_id, product_id, quantity DECIMAL

---

## RELACIONES CLAVE PARA JOINs

Para obtener nombres en lugar de IDs, usa estos JOINs:
- Cliente: LEFT JOIN customers c ON sh.customer_id = c.id → usa c.nombre
- Proveedor: LEFT JOIN providers p ON ph.provider_id = p.id → usa p.nombre
- Sucursal: LEFT JOIN branches b ON x.branch_id = b.id → usa b.nombre
- Empresa: LEFT JOIN companies co ON x.company_id = co.id → usa co.razon_social o co.nombre_comercial
- Producto: LEFT JOIN products p ON x.product_id = p.id → usa p.nombre y p.codigo
- Categoría: LEFT JOIN product_categories pc ON p.category_id = pc.id → usa pc.name
- Vendedor: LEFT JOIN sellers s ON sh.seller_id = s.id → usa s.nombre
- Usuario: LEFT JOIN users u ON x.usuario_id = u.id → usa u.nombre
- Tipo de Gasto: LEFT JOIN cat_expense_types cet ON ei.expense_type_id = cet.id → usa cet.name

---

## CONSULTAS DE EJEMPLO

Para ventas del mes actual de la sucursal actual:
SELECT DATE(sh.created_at) as fecha, COUNT(*) as num_ventas, SUM(sh.total_pagar) as total
FROM sales_headers sh
WHERE sh.company_id = {COMPANY_ID} AND sh.branch_id = {BRANCH_ID}
  AND sh.estado != 'ANULADO'
  AND YEAR(sh.created_at) = YEAR(CURDATE()) AND MONTH(sh.created_at) = MONTH(CURDATE())
GROUP BY DATE(sh.created_at)
ORDER BY fecha DESC

Para saldo de clientes (CXC):
SELECT c.nombre, c.nit,
  COALESCE(SUM(sh.total_pagar),0) - COALESCE(SUM(cp.monto),0) as saldo_pendiente
FROM customers c
LEFT JOIN sales_headers sh ON sh.customer_id = c.id AND sh.company_id = {COMPANY_ID}
  AND sh.branch_id = {BRANCH_ID} AND sh.estado != 'ANULADO' AND sh.condicion_operacion = 2
LEFT JOIN customer_payments cp ON cp.customer_id = c.id AND cp.company_id = {COMPANY_ID}
  AND cp.branch_id = {BRANCH_ID}
WHERE c.company_id = {COMPANY_ID}
GROUP BY c.id, c.nombre, c.nit
HAVING saldo_pendiente > 0
ORDER BY saldo_pendiente DESC
`;

// Maximum rows returned per AI query (configurable)
const AI_QUERY_MAX_ROWS = parseInt(process.env.AI_MAX_ROWS || '200');

module.exports = { DB_SCHEMA, AI_QUERY_MAX_ROWS };
