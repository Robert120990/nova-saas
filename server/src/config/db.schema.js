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
- NUNCA muestres IDs crudos. Siempre usa JOINs para obtener nombres legibles.

---

## CORE: EMPRESAS Y SUCURSALES

### companies (Empresas)
- id, nit, nrc, razon_social, nombre_comercial, actividad_economica, codigo_actividad
- direccion, departamento, municipio, correo, telefono
- tipo_contribuyente ENUM('Persona Natural','Persona Juridica')
- ambiente ENUM('test','produccion'), dte_active BOOLEAN
- certificado_digital TEXT, clave_privada TEXT, api_user, api_password
- logo_url, created_at, updated_at

### branches (Sucursales / Establecimientos)
- id, company_id, codigo, nombre, tipo_establecimiento
- direccion, departamento, municipio, telefono, correo, codigo_mh
- es_casa_matriz BOOLEAN, distrito VARCHAR(10)
- omitir_digito_verificador BOOLEAN DEFAULT FALSE (al leer un producto en POS omite el último dígito del código)
- logo_url, created_at
- UNIQUE(company_id, codigo), UNIQUE(company_id, codigo_mh)

### points_of_sale (Puntos de Venta / Cajas)
- id, branch_id, company_id, codigo, nombre
- status ENUM('activo','inactivo'), auto_print BOOLEAN, printer_name
- created_at

### tax_configurations (Configuración de impuestos por empresa)
- company_id PK, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate
- created_at, updated_at

---

## USUARIOS Y ACCESO

### users (Usuarios del sistema)
- id, company_id, role_id, username, password (hash), nombre, email
- status ENUM('activo','inactivo'), created_at
- UNIQUE(company_id, username)

### roles (Roles de usuario)
- id, name, permissions JSON (lista de permisos), created_at

### usuario_empresa (Acceso usuario → empresa)
- usuario_id, empresa_id, role_id, has_access BOOLEAN, created_at
- PK compuesto (usuario_id, empresa_id)

### usuario_sucursal (Acceso usuario → sucursal)
- usuario_id, sucursal_id, created_at
- PK compuesto (usuario_id, sucursal_id)

### user_sessions (Sesiones activas de usuarios)
- id, user_id, company_id, branch_id
- ip_address VARCHAR(45), user_agent VARCHAR(500)
- logged_in_at TIMESTAMP, last_heartbeat TIMESTAMP
- is_active BOOLEAN DEFAULT TRUE
- FK: user_id → users.id, company_id → companies.id

### audit_log (Auditoría de cambios)
- id, company_id, user_id, action VARCHAR(100)
- entity_type VARCHAR(50), entity_id INT
- old_values JSON, new_values JSON
- ip_address VARCHAR(45), user_agent TEXT
- created_at

---

## CLIENTES Y SUCURSALES DE CLIENTE

### customers (Clientes)
- id, company_id, nombre, nombre_comercial
- tipo_documento, numero_documento, nit, nrc
- actividad_economica, codigo_actividad
- direccion, departamento, municipio, pais (defecto '222'=El Salvador)
- telefono, correo, tipo_contribuyente
- condicion_fiscal ENUM('contribuyente','gran contribuyente','exento IVA','exento impuestos','sujeto excluido')
- exento_iva, aplica_fovial, aplica_cotrans
- es_credito BOOLEAN, es_anticipado BOOLEAN
- tipo_operacion ENUM('local','exportacion'), created_at

### customer_branches (Sucursales de clientes)
- id, customer_id, company_id, nombre
- departamento, municipio, direccion, telefono
- created_at

### customer_payments (Pagos de Clientes / CXC)
- id BIGINT, company_id, branch_id, customer_id
- monto DECIMAL, fecha_pago DATE
- metodo_pago VARCHAR(50), referencia, notas TEXT
- sale_id BIGINT NULL (FK → sales_headers.id)
- created_at

---

## PROVEEDORES

### providers (Proveedores)
- id, company_id, nombre, nombre_comercial
- tipo_documento, numero_documento, nit, nrc
- id_actividad INT, direccion, departamento, municipio
- telefono, correo, created_at

### provider_payments (Pagos a Proveedores / CXP)
- id, company_id, branch_id, provider_id
- monto DECIMAL, fecha_pago DATE
- metodo_pago, referencia, notas TEXT
- purchase_id INT NULL (FK → purchase_headers.id)
- expense_id INT NULL (FK → expense_headers.id)
- created_at

---

## PRODUCTOS E INVENTARIO

### products (Productos / Servicios)
- id, company_id, codigo, nombre, descripcion
- precio_unitario DECIMAL, costo DECIMAL, unidad_medida
- tipo_item VARCHAR (tipo_producto: bien/servicio)
- category_id (FK → product_categories.id), provider_id (FK → providers.id)
- stock_minimo, afecto_iva, exento_iva
- aplica_fovial, aplica_cotrans
- tipo_combustible (0=Ninguno, 1=Regular, 2=Especial, 3=Diesel)
- tipo_operacion (1=Gravada, 2=Exenta, 3=No Sujeta)
- created_at

### product_categories (Categorías de Producto)
- id, company_id, name, description, created_at

### product_branch (Productos habilitados por sucursal)
- product_id, branch_id (PK compuesto)

### product_pos (Productos habilitados por POS)
- product_id, pos_id (PK compuesto)

### product_tributes (Tributos aplicables por producto)
- product_id, tribute_code (PK compuesto)

### product_discount_rules (Reglas de descuento)
- id, company_id, product_id
- discount_type ENUM('percentage','fixed'), discount_value DECIMAL
- start_date DATE, end_date DATE, active BOOLEAN
- created_at, updated_at

### product_combos (Combos de productos)
- id, company_id, branch_id, nombre, descripcion
- precio DECIMAL, status ENUM('activo','inactivo'), created_at

### product_combo_items (Productos dentro de combos)
- id, combo_id, product_id, quantity DECIMAL

### inventory (Stock actual por sucursal)
- id, product_id, branch_id, company_id, stock DECIMAL
- created_at, updated_at
- UNIQUE(product_id, branch_id)

### inventory_movements (Kardex / Movimientos de inventario)
- id, company_id, branch_id, product_id
- tipo_movimiento ENUM('ENTRADA','SALIDA','AJUSTE','TRANSFERENCIA')
- cantidad DECIMAL, costo DECIMAL, saldo_anterior DECIMAL, saldo_nuevo DECIMAL
- tipo_documento TEXT (VENTA, COMPRA, AJUSTE, etc.), documento_id
- fecha, created_at

### inventory_adjustments (Ajustes de inventario)
- id, company_id, branch_id, product_id
- cantidad_ajuste DECIMAL (positivo=entrada, negativo=salida)
- motivo, estado, usuario_id, created_at

### physical_inventories (Conteo físico de inventario)
- id, company_id, branch_id, fecha, responsable
- observaciones, status ENUM('PENDIENTE','APLICADO','ANULADO')
- created_at, updated_at

### physical_inventory_items (Items del conteo físico)
- id, physical_inventory_id, product_id
- stock_sistema, stock_fisico, diferencia, costo, total DECIMAL
- created_at

---

## VENTAS Y TURNOS POS

### sales_headers (Cabeceras de Ventas / Facturas)
- id BIGINT, company_id, branch_id
- customer_id INT NULL (NULL = consumidor final)
- seller_id, pos_id, shift_id
- tipo_documento VARCHAR (01=Factura, 03=Crédito Fiscal, 04=Nota de Remisión, 05=Nota de Crédito, 11=FEX)
- dte_type, numero_control, codigo_generacion (UUID del DTE)
- condicion_operacion INT (1=CONTADO, 2=CREDITO)
- payment_condition, estado VARCHAR (emitido, ANULADO)
- fecha_emision DATE, hora_emision TIME
- total_gravado, total_exento, total_nosujetas, total_iva DECIMAL
- fovial, cotrans, descuento_general, iva_percibido, iva_retenido DECIMAL
- total_pagar DECIMAL (monto total de la venta)
- cliente_nombre (nombre manual), observaciones, sello_recepcion
- customer_branch_id, dte_email_sent, dte_email_error
- created_at TIMESTAMP

### sales_items (Ítems / Líneas de Venta)
- id, sale_id, product_id, combo_id
- descripcion, cantidad DECIMAL
- precio_unitario DECIMAL, monto_descuento DECIMAL
- venta_gravada DECIMAL, venta_exenta DECIMAL
- tributos JSON

### sales_payments (Pagos de Ventas)
- id, sale_id, metodo_pago (01=Efectivo, 02=Tarjeta, etc.)
- monto DECIMAL, referencia, created_at

### sales_linked_documents (Documentos vinculados a ventas)
- id BIGINT, sale_id BIGINT
- doc_type VARCHAR(2), doc_number VARCHAR(36)
- emission_date DATE, generation_type INT DEFAULT 2

### sellers (Vendedores / Despachadores)
- id, company_id, branch_id, pos_id
- nombre, password, status ENUM('activo','inactivo')
- allow_price_edit BOOLEAN, created_at, updated_at
- UNIQUE(branch_id, password)

### shifts (Turnos de Caja — original)
- id, branch_id, company_id, pos_id, user_id
- fecha_apertura, hora_apertura, fondo_inicial
- fecha_cierre, hora_cierre, monto_cierre
- status ENUM('abierto','cerrado'), created_at

### pos_shifts (Turnos POS — detallado)
- id, company_id, branch_id, pos_id, seller_id
- start_time DATETIME, end_time DATETIME, opening_balance DECIMAL
- total_expenses DECIMAL, total_incomes DECIMAL
- total_remesas DECIMAL, total_puntos DECIMAL
- expected_cash, actual_cash, difference DECIMAL
- cash_sales, card_sales, transfer_sales, other_sales, total_sales DECIMAL
- status ENUM('open','closed'), arqueado TINYINT, created_at

### pos_shift_expenses (Gastos de turno POS)
- id, shift_id, description VARCHAR(255), amount DECIMAL, created_at

### pos_shift_incomes (Ingresos extra de turno POS)
- id, shift_id, description, amount DECIMAL, payment_method VARCHAR(2), created_at

### pos_shift_puntos (Canje de puntos de turno POS)
- id, shift_id, description VARCHAR(255), amount DECIMAL, created_at

---

## COMPRAS (CXP)

### purchase_headers (Cabeceras de Compras)
- id, company_id, branch_id, provider_id, usuario_id
- fecha DATE, numero_documento
- tipo_documento_id VARCHAR, condicion_operacion_id VARCHAR
- dias_credito INT, fecha_vencimiento DATE
- total_nosujeta, total_exenta, total_gravada DECIMAL
- iva, retencion, percepcion, fovial, cotrans DECIMAL
- monto_total DECIMAL
- status ENUM('COMPLETADO','ANULADO')
- period_year INT, period_month INT
- observaciones, created_at, updated_at

### purchase_items (Ítems de Compras)
- id, purchase_id, product_id
- cantidad DECIMAL, precio_unitario DECIMAL, total DECIMAL

---

## GASTOS ADMINISTRATIVOS

### expense_headers (Cabeceras de Gastos)
- id, company_id, branch_id, provider_id, usuario_id
- fecha DATE, numero_documento
- tipo_documento_id VARCHAR, condicion_operacion_id VARCHAR
- total_nosujeta, total_exenta, total_gravada DECIMAL
- iva, retencion, percepcion, fovial, cotrans DECIMAL
- monto_total DECIMAL, status ENUM('ACTIVO','ANULADO')
- period_year INT, period_month INT
- observaciones, created_at, updated_at

### expense_items (Detalle de Gastos)
- id, expense_id, concept VARCHAR(255), expense_type_id
- tipo_operacion (1=Gravada, 2=Exenta, 3=No Sujeta), total DECIMAL

### cat_expense_types (Tipos de Gastos — por empresa)
- id, company_id, name, description, created_at

---

## DTE (DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS)

### certificates (Certificados digitales por empresa)
- id, company_id, nit, password, bundle LONGBLOB, active BOOLEAN
- UNIQUE(company_id, nit)

### dtes (Documentos DTE)
- id, codigo_generacion VARCHAR(36) UNIQUE, numero_control VARCHAR(31) UNIQUE
- tipo_dte VARCHAR(2), company_id, branch_id, usuario_id
- status ENUM('PENDING','VALIDATED','SIGNED','SENT','ACCEPTED','REJECTED','ERROR','CONTINGENCY','INVALIDADO','CONTINGENCIA_PENDIENTE','RETRANSMITIDO')
- ambiente ENUM('00'=Test,'01'=Producción)
- json_original JSON, json_firmado TEXT
- sello_recepcion VARCHAR(255), fh_procesamiento DATETIME
- created_at, updated_at

### dte_events (Log de eventos DTE)
- id, dte_id, event_type, description TEXT, created_at

### dte_responses (Respuestas de Hacienda)
- id, dte_id, status_code INT, response_body JSON, created_at

### transmission_queue (Cola de transmisión a Hacienda)
- id, dte_id, attempts INT, max_attempts INT
- next_attempt_at DATETIME, last_error TEXT
- status ENUM('WAITING','PROCESSING','FAILED','COMPLETED')
- created_at, updated_at

### dte_errors (Errores de validación DTE)
- id, dte_id, codigo_error VARCHAR(20), mensaje_error TEXT, detalles JSON, created_at

### dte_invalidations (Invalidaciones / Anulaciones de DTE)
- id, codigo_generacion_dte VARCHAR(36), tipo_documento VARCHAR(2)
- motivo VARCHAR(2), descripcion TEXT
- estado ENUM('PENDING','SIGNED','SENT','ACCEPTED','REJECTED','ERROR')
- json_enviado JSON, json_firmado TEXT, respuesta_hacienda JSON
- fecha_envio DATETIME, created_at, updated_at

### dte_contingencias (Periodos de contingencia)
- id, company_id, branch_id
- fecha_inicio DATETIME, fecha_fin DATETIME
- motivo TEXT, tipo_contingencia INT
- estado ENUM('OPEN','CLOSED')
- created_at, updated_at

### dte_contingency_documents (Documentos emitidos en contingencia)
- id, codigo_generacion VARCHAR(36) UNIQUE, tipo_documento VARCHAR(2)
- json_dte JSON, json_firmado TEXT
- estado_envio ENUM('PENDING','SENT','FAILED')
- retry_count INT, last_error TEXT
- fecha_generacion DATETIME, fecha_envio_hacienda DATETIME, created_at

---

## CATÁLOGOS DTE / HACIENDA

### cat_001_ambiente (Ambientes DTE)
- code, description — ('00'=Pruebas, '01'=Producción)

### cat_002_tipo_dte (Tipos de Documento)
- code, description — '01'=Factura Consumidor Final, '03'=Crédito Fiscal, '04'=Nota Remisión, '05'=Nota Crédito, '06'=Nota Débito, '07'=Comprobante Retención, '08'=Comprobante Liquidación, '11'=Factura Exportación, '14'=Factura Sujeto Excluido

### cat_008_distrito (Distritos / Códigos postales)
- code, dep_code, description — Código de distrito municipal

### cat_012_departamento (Departamentos de El Salvador)
- code, description — 14 departamentos (01=Ahuachapán... 14=San Miguel)

### cat_013_municipio (Municipios de El Salvador)
- code, dep_code, description — 262 municipios

### cat_014_unidad_medida (Unidades de Medida)
- code, description — '58'=Kilogramo, '59'=Libra, '71'=Galón, '77'=Botella, '98'=Unidad, etc.

### cat_016_condicion_operacion (Condiciones de Operación)
- code, description — '1'=Contado, '2'=Crédito

### cat_017_forma_pago (Formas de Pago — Catálogo oficial MH)
- code, description — '01'=Billetes y monedas, '02'=Tarjeta Débito, '03'=Tarjeta Crédito, '04'=Cheque, '05'=Transferencia/Depósito, '08'=Dinero electrónico, '09'=Monedero electrónico, '11'=Bitcoin, '12'=Otras Criptomonedas, '13'=Cuentas por pagar del receptor, '14'=Giro bancario, '99'=Otros

### cat_018_plazo (Plazos para operaciones a crédito)
- code, description — '01'=Días, '02'=Meses, '03'=Años

### cat_019_actividad_economica (Actividades Económicas)
- code, description — Códigos de actividad económica MH

### cat_020_pais (Países)
- code, description — '222'=El Salvador

### cat_022_tipo_documento_receptor (Tipos de Documento de Identificación)
- code, description — '13'=DUI, '36'=NIT, '37'=Pasaporte, '39'=Carné Residente

### cat_024_tipo_invalidacion (Motivos de Invalidación)
- code, description — '1'=Error en documento, '2'=Anulación, etc.

---

## MÓDULO GASOLINERA: CATÁLOGOS

### gas_station_distributors (Distribuidoras de cupones)
- id, company_id, branch_id, codigo, descripcion, status
- UNIQUE(company_id, branch_id, codigo)

### gas_station_islands (Islas / Surtidores)
- id, company_id, branch_id, codigo, descripcion, status
- UNIQUE(company_id, branch_id, codigo)

### gas_station_nozzles (Pistolas / Mangueras)
- id, company_id, branch_id, codigo, descripcion
- tipo CHAR (A=Autoservicio, C=Servicio completo, M=Master)
- island_id FK → gas_station_islands.id, product_id FK → products.id
- UNIQUE(company_id, branch_id, codigo)

### gas_station_tanks (Tanques de combustible)
- id, company_id, branch_id, codigo, descripcion
- capacidad DECIMAL, reserva DECIMAL
- UNIQUE(company_id, branch_id, codigo)

### gas_station_expense_categories (Categorías de gasto gasolinera)
- id, company_id, branch_id, name, created_at

### gas_station_despachadores (Despachadores / Empleados)
- id, company_id, branch_id, codigo, descripcion
- UNIQUE(company_id, branch_id, codigo)

### gas_station_despachador_nozzles (Asignación pistola ↔ despachador)
- id, company_id, branch_id, despachador_id, nozzle_id, created_at
- UNIQUE(despachador_id, nozzle_id)

### gas_station_pos_types (Tipos de POS / Tarjeta)
- id, company_id, branch_id, nombre, created_at
- UNIQUE(company_id, branch_id, nombre)

### gas_station_settings (Configuración gasolinera)
- id, company_id, branch_id, setting_key, setting_value
- UNIQUE(company_id, branch_id, setting_key)

### gas_station_advances (Anticipos a clientes)
- id, company_id, branch_id, numero VARCHAR(7), fecha DATE
- cliente_id, cliente_nombre, monto, monto_disponible, notas
- created_at, updated_at

---

## MÓDULO GASOLINERA: CIERRES

### gas_station_closeouts (Cierres de turno gasolinera)
- id, company_id, branch_id, seller_id, seller_name
- fecha_turno DATE, numero_turno INT
- estado VARCHAR(20) ('abierto','cerrado')
- observaciones, closed_at TIMESTAMP, created_at, updated_at

### gas_station_closeout_readings (Lecturas de pistolas en cierre)
- id, closeout_id, nozzle_id, product_id
- codigo_pistola, codigo_producto, descripcion_producto, precio DECIMAL
- lectura_anterior, lectura_actual, calibracion, diferencia, monto DECIMAL

### gas_station_closeout_tank_readings (Lecturas de tanques)
- id, closeout_id, tank_id
- codigo_tanque, descripcion_tanque
- lectura_anterior, recarga, lectura_actual, diferencia DECIMAL

### gas_station_closeout_expenses (Gastos del turno)
- id, closeout_id, rubro, fecha, documento, tipo, proveedor
- provider_id, valor, despachador_id, comentario VARCHAR(255)

### gas_station_closeout_remesas (Remesas/Depósitos)
- id, closeout_id, documento, descripcion
- tipo_operacion ENUM('venta_combustible','recuperacion_credito','pago_anticipado')
- despachador_id, monto DECIMAL

### gas_station_closeout_cupones (Cupones canjeados)
- id, closeout_id, cupon, distribuidora_id, distribuidora_nombre
- producto_codigo, producto_descripcion, despachador_id, monto DECIMAL

### gas_station_closeout_descuentos (Descuentos otorgados)
- id, closeout_id, documento, cliente_id, cliente_nombre
- producto_codigo, producto_descripcion, cantidad, valor, total DECIMAL
- despachador_id

### gas_station_closeout_adelantos (Adelantos a empleados)
- id, closeout_id, empleado, monto DECIMAL, despachador_id

### gas_station_closeout_lubricant_readings (Lecturas de lubricantes)
- id, closeout_id, producto_id, producto_codigo, producto_descripcion
- lectura_inicial, recarga, lectura_final, ventas, precio, total DECIMAL

### gas_station_closeout_despachadores (Despachadores en cierre)
- id, closeout_id, despachador_id, nombre
- UNIQUE(closeout_id, despachador_id)

### gas_station_closeout_tarjetas (Tarjetas POS en cierre)
- id, closeout_id, num_tarjeta, num_autorizacion
- pos_type_id, despachador_id
- tipo_operacion ENUM('venta_combustible','recuperacion_credito','pago_anticipado')
- monto DECIMAL

### gas_station_closeout_creditos (Ventas a crédito en cierre)
- id, closeout_id, documento, tipo_documento ENUM('CCF','FAC')
- cliente_id, cliente_nombre, producto_codigo, producto_descripcion
- despachador_id, cantidad, precio, monto DECIMAL
- placa, kilometraje

### gas_station_closeout_vales (Vales en cierre)
- id, closeout_id, documento, tipo_documento ENUM('CCF','FAC')
- cliente_id, cliente_nombre, producto_codigo, producto_descripcion
- despachador_id, cantidad, precio, monto DECIMAL
- placa, kilometraje

### gas_station_closeout_anticipos_despachados (Anticipos despachados en cierre)
- id, closeout_id, cliente_id, cliente_nombre, documento
- tipo_documento ENUM('CCF','FAC')
- producto_codigo, producto_descripcion, despachador_id
- cantidad, precio, monto DECIMAL, placa, kilometraje

### gas_station_closeout_changes (Historial de cambios en cierres reabiertos)
- id, company_id, branch_id, closeout_id, user_id, username
- section VARCHAR(50) (gastos, remesas, cupones, descuentos, adelantos, tarjetas, creditos, vales, anticipos, lubricantes, despachadores, nozzles, fecha_turno, reopen, reclose)
- action VARCHAR(50) ('update','create','delete','reopen','reclose')
- description VARCHAR(500), details JSON (before/after/added/removed/modified)
- created_at TIMESTAMP, FK closeout_id → gas_station_closeouts ON DELETE CASCADE

---

## MÓDULO CONTABILIDAD

### account_types (Tipos de cuenta contable - GLOBALES, compartidos por todas las empresas)
- id, code, name, nature ENUM('debit','credit'), created_at

### entry_types (Tipos de partida contable - GLOBALES, compartidos por todas las empresas)
- id, code UNIQUE, name, created_at

### chart_of_accounts (Catálogo de cuentas contables)
- id, company_id, account_type_id, parent_id INT NULL
- code VARCHAR(20), name VARCHAR(200), description TEXT
- allows_entries BOOLEAN, active BOOLEAN, created_at, updated_at

### accounting_entries (Partidas contables)
- id, company_id, branch_id, entry_type_id
- number VARCHAR(30), date DATE, description TEXT
- status ENUM('draft','posted','voided')
- total_debit, total_credit DECIMAL
- created_by INT, created_at, updated_at

### accounting_entry_lines (Líneas de partida contable)
- id, entry_id, account_id, description TEXT
- debit DECIMAL, credit DECIMAL

### accounting_settings (Configuración contable)
- id, company_id, setting_key VARCHAR(50), setting_value VARCHAR(255)
- UNIQUE(company_id, setting_key)

---

## MÓDULO INDUSTRIAL HUEVO

### egg_raw_materials (Materia prima — huevo)
- id, company_id, branch_id, provider_id
- egg_type ENUM, egg_color ENUM, egg_size ENUM
- fecha DATE, weight_lbs DECIMAL, temperature_c DECIMAL
- provider_lot, certificate_urls TEXT
- operator_name, stock_lbs DECIMAL
- status ENUM('aprobado','cuarentena','rechazado','anulado'), created_at

### egg_cip_logs (Limpieza CIP / Sanitización)
- id, company_id, equipment_name, chemical_used
- temperature_c DECIMAL, duration_minutes INT
- operator_name, validation_status ENUM, notes TEXT, created_at

### egg_production_batches (Lotes de producción)
- id, company_id, branch_id, batch_uuid VARCHAR(36) UNIQUE
- product_type ENUM, presentation ENUM
- status ENUM, raw_material_id FK
- input_weight_lbs, yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs DECIMAL
- operator_name, started_at, completed_at

### batch_raw_materials (Materias primas por lote)
- id, batch_id FK, raw_material_id FK, quantity_lbs DECIMAL

### egg_pasteurization_logs (Parámetros de pasteurización)
- id, company_id, batch_id FK
- temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm
- haccp_compliant BOOLEAN, deviation_description, operator_name, created_at

### egg_holding_temperatures (Cadena de frío)
- id, company_id, tank_id, temperature_c, humidity_percentage
- alarm_triggered BOOLEAN, alarm_reason, created_at

### egg_packaging_records (Empaque final)
- id, company_id, batch_id FK
- units_packaged INT, weight_per_unit_lbs, total_batch_weight_lbs DECIMAL
- lot_code VARCHAR(100) UNIQUE, barcode, qr_code_payload TEXT
- expiry_date DATE, operator_name, created_at

### egg_product_config (Configuración de productos)
- id, company_id, product_type VARCHAR(50)
- weight_per_unit_lbs, yield_pct, waste_shell_pct, waste_loss_pct DECIMAL
- UNIQUE(company_id, product_type)

### egg_blast_freezer_logs (Congelación rápida)
- id, company_id, packaging_id FK
- freezer_location, core_temperature_c, freezing_duration_hours
- status ENUM('congelando','congelado_ok','alarma_tiempo'), created_at

### egg_machinery_maintenance (Mantenimiento de maquinaria)
- id, company_id, equipment_name
- maintenance_type ENUM('preventivo','correctivo')
- description TEXT, spare_parts_used TEXT
- usage_hours_count INT, technician_name, cost DECIMAL, created_at

### egg_industrial_costs (Costos industriales por lote)
- id, company_id, batch_id FK
- diesel_cost, electricity_cost, water_cost, labor_cost
- packaging_materials_cost, chemicals_cip_cost, quality_tests_cost DECIMAL
- total_cost DECIMAL (generado automáticamente), created_at

### egg_industrial_events (Eventos industriales)
- id, company_id, event_type VARCHAR(100)
- severity ENUM('info','warning','critical')
- description TEXT, payload JSON, operator_name, created_at

---

## RELACIONES CLAVE PARA JOINs

Para obtener nombres legibles en lugar de IDs, usa estos JOINs:
- Cliente: LEFT JOIN customers c ON t.customer_id = c.id → c.nombre
- Proveedor: LEFT JOIN providers p ON t.provider_id = p.id → p.nombre
- Sucursal: LEFT JOIN branches b ON t.branch_id = b.id → b.nombre
- Empresa: LEFT JOIN companies co ON t.company_id = co.id → co.razon_social / co.nombre_comercial
- Producto: LEFT JOIN products p ON t.product_id = p.id → p.nombre, p.codigo
- Categoria: LEFT JOIN product_categories pc ON p.category_id = pc.id → pc.name
- Vendedor: LEFT JOIN sellers s ON t.seller_id = s.id → s.nombre
- Usuario: LEFT JOIN users u ON t.usuario_id = u.id → u.nombre
- Pistola: LEFT JOIN gas_station_nozzles gn ON t.nozzle_id = gn.id → gn.descripcion
- Isla: LEFT JOIN gas_station_islands gi ON gn.island_id = gi.id → gi.descripcion
- Tanque: LEFT JOIN gas_station_tanks gt ON t.tank_id = gt.id → gt.descripcion
- Distribuidora: LEFT JOIN gas_station_distributors gd ON t.distribuidora_id = gd.id → gd.descripcion
- Despachador: LEFT JOIN gas_station_despachadores gd ON t.despachador_id = gd.id → gd.descripcion
- Tipo Gasto: LEFT JOIN cat_expense_types cet ON t.expense_type_id = cet.id → cet.name
- Cuenta Contable: LEFT JOIN chart_of_accounts coa ON t.account_id = coa.id → coa.name
- Partida Contable: LEFT JOIN accounting_entries ae ON t.entry_id = ae.id → ae.number

---

## CONSULTAS DE EJEMPLO

Ventas del mes actual (agrupado por día):
SELECT DATE(sh.created_at) as fecha, COUNT(*) as num_ventas, SUM(sh.total_pagar) as total
FROM sales_headers sh
WHERE sh.company_id = {COMPANY_ID} AND sh.branch_id = {BRANCH_ID}
  AND sh.estado != 'ANULADO'
  AND YEAR(sh.created_at) = YEAR(CURDATE()) AND MONTH(sh.created_at) = MONTH(CURDATE())
GROUP BY DATE(sh.created_at) ORDER BY fecha DESC

Saldo de clientes (CXC):
SELECT c.nombre, c.nit,
  COALESCE(SUM(sh.total_pagar),0) - COALESCE(SUM(cp.monto),0) as saldo_pendiente
FROM customers c
LEFT JOIN sales_headers sh ON sh.customer_id = c.id AND sh.company_id = {COMPANY_ID}
  AND sh.branch_id = {BRANCH_ID} AND sh.estado != 'ANULADO' AND sh.condicion_operacion = 2
LEFT JOIN customer_payments cp ON cp.customer_id = c.id AND cp.company_id = {COMPANY_ID}
  AND cp.branch_id = {BRANCH_ID}
WHERE c.company_id = {COMPANY_ID}
GROUP BY c.id, c.nombre, c.nit
HAVING saldo_pendiente > 0 ORDER BY saldo_pendiente DESC

Ventas por producto (más vendidos):
SELECT p.nombre, p.codigo, SUM(si.cantidad) as total_unidades, SUM(si.precio_unitario * si.cantidad) as total
FROM sales_items si
JOIN products p ON si.product_id = p.id
JOIN sales_headers sh ON si.sale_id = sh.id
WHERE sh.company_id = {COMPANY_ID} AND sh.branch_id = {BRANCH_ID}
  AND sh.estado != 'ANULADO'
GROUP BY p.id, p.nombre, p.codigo ORDER BY total DESC LIMIT 10

Inventario con stock bajo:
SELECT p.nombre, p.codigo, i.stock, p.stock_minimo
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.company_id = {COMPANY_ID} AND i.branch_id = {BRANCH_ID}
  AND i.stock <= p.stock_minimo
ORDER BY (i.stock / p.stock_minimo) ASC

Ventas de gasolina por pistola en un turno:
SELECT g.closeout_id, gn.descripcion as pistola, gi.descripcion as isla,
  g.lectura_anterior, g.lectura_actual, g.diferencia, g.precio, g.monto
FROM gas_station_closeout_readings g
JOIN gas_station_nozzles gn ON g.nozzle_id = gn.id
JOIN gas_station_islands gi ON gn.island_id = gi.id
WHERE g.closeout_id = ? ORDER BY gi.descripcion, gn.descripcion

Resumen de cierre gasolinera (totales):
SELECT gc.id, gc.fecha_turno, gc.seller_name,
  (SELECT SUM(monto) FROM gas_station_closeout_readings WHERE closeout_id = gc.id) as total_ventas,
  (SELECT SUM(monto) FROM gas_station_closeout_remesas WHERE closeout_id = gc.id) as total_remesas,
  (SELECT SUM(monto) FROM gas_station_closeout_gastos WHERE closeout_id = gc.id) as total_gastos,
  (SELECT SUM(monto) FROM gas_station_closeout_cupones WHERE closeout_id = gc.id) as total_cupones,
  (SELECT SUM(monto) FROM gas_station_closeout_descuentos WHERE closeout_id = gc.id) as total_descuentos
FROM gas_station_closeouts gc
WHERE gc.company_id = {COMPANY_ID} AND gc.branch_id = {BRANCH_ID}
ORDER BY gc.fecha_turno DESC

---

## RECURSOS HUMANOS - EMPLEADOS

### rh_empleados (Empleados)
- id, company_id, codigo VARCHAR(10) (auto-generado 0001, editable)
- nombres, apellidos, fecha_nacimiento
- num_dui VARCHAR(12) (formato 00000000-0), num_nit VARCHAR(17) (formato 0000-000000-000-0)
- afp_id FK -> rh_afp, ocupacion, direccion
- departamento VARCHAR(10) (código MH, FK → cat_012_departamento), municipio VARCHAR(10) (código MH, FK compuesta → cat_013_municipio), distrito VARCHAR(10) (código MH, FK compuesta → cat_008_distrito), telefono, correo
- contacto_emergencia_nombre, contacto_emergencia_telefono
- cargo_id FK -> rh_cargos, departamento_personal_id FK -> rh_departamentos
- num_isss, num_nup, fecha_ingreso, tipo_contrato_id FK -> rh_tipos_contrato
- sueldo_base DECIMAL, bonificacion_fija DECIMAL, cuenta_planillera
- es_activo TINYINT, es_jubilado TINYINT, en_vacaciones TINYINT, incapacitado TINYINT
- comentarios TEXT, created_at, updated_at
- UNIQUE(company_id, codigo)

### rh_empleado_descuentos (Descuentos programados asignados por empleado)
- id, company_id, empleado_id FK -> rh_empleados
- descuento_id FK -> rh_descuentos_programados
- quincena ENUM('primera','segunda','ambas'), valor DECIMAL
- numero_cuotas INT, cuotas_restantes INT, numero_credito VARCHAR(50)
- activo TINYINT(1), created_at

### rh_indemnizaciones (Indemnizaciones por empleado)
- id, company_id, empleado_id FK -> rh_empleados
- motivo TEXT, monto DECIMAL, fecha_aplicacion DATE, created_at

### rh_empleado_ausencias (Faltas, inasistencias e incapacidades)
- id, company_id, empleado_id FK -> rh_empleados
- tipo ENUM('falta','inasistencia','incapacidad')
- fecha_inicio DATE, fecha_fin DATE, motivo TEXT, justificada TINYINT(1), created_at

### rh_planilla_vacaciones (Planilla de vacaciones)
- id, company_id, empleado_id FK -> rh_empleados
- periodo_año INT, periodo_mes INT, quincena ENUM('primera','segunda')
- fecha_inicial DATE, fecha_final DATE, dias_transcurridos INT
- vacaciones_monto DECIMAL, descuento_isss DECIMAL, descuento_afp DECIMAL, descuento_renta DECIMAL
- total_devengado DECIMAL, total_deducciones DECIMAL, monto_recibir DECIMAL
- created_at, updated_at

`;

// Maximum rows returned per AI query (configurable)
const AI_QUERY_MAX_ROWS = parseInt(process.env.AI_MAX_ROWS || '200');

module.exports = { DB_SCHEMA, AI_QUERY_MAX_ROWS };
