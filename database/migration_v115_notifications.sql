-- Migration v115: Sistema de Notificaciones Configurable
-- Tablas: notification_actions, notification_rules, notification_rule_conditions,
--          notification_rule_recipients, notifications, whatsapp_settings

START TRANSACTION;

-- ============================================
-- 1. CATÁLOGO DE ACCIONES NOTIFICABLES
-- ============================================
CREATE TABLE IF NOT EXISTS notification_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    icon VARCHAR(50),
    color VARCHAR(7),
    available_variables JSON,
    default_title_template VARCHAR(255),
    default_body_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. REGLAS DE NOTIFICACIÓN
-- ============================================
CREATE TABLE IF NOT EXISTS notification_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NULL,
    action_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    channel_system BOOLEAN DEFAULT TRUE,
    channel_email BOOLEAN DEFAULT FALSE,
    channel_whatsapp BOOLEAN DEFAULT FALSE,
    title_template VARCHAR(255) NULL,
    body_template TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

-- ============================================
-- 3. CONDICIONES POR REGLA
-- ============================================
CREATE TABLE IF NOT EXISTS notification_rule_conditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_id INT NOT NULL,
    field VARCHAR(100) NOT NULL,
    operator ENUM('eq','neq','gt','gte','lt','lte','contains') NOT NULL,
    value VARCHAR(500) NOT NULL,
    FOREIGN KEY (rule_id) REFERENCES notification_rules(id) ON DELETE CASCADE
);

-- ============================================
-- 4. DESTINATARIOS POR REGLA
-- ============================================
CREATE TABLE IF NOT EXISTS notification_rule_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (rule_id) REFERENCES notification_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_rule_user (rule_id, user_id)
);

-- ============================================
-- 5. BANDEJA DE NOTIFICACIONES IN-APP
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    rule_id INT NULL,
    action_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user_read (user_id, is_read),
    INDEX idx_notif_created (created_at)
);

-- ============================================
-- 6. CONFIGURACIÓN WHATSAPP
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    branch_id INT PRIMARY KEY,
    phone_number_id VARCHAR(50) NOT NULL,
    token VARCHAR(500) NOT NULL,
    from_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- ============================================
-- 7. PERMISOS (seed en migration o manual)
-- ============================================
-- Estos permisos deben agregarse al JSON de permissions del rol Admin/SuperAdmin
-- o insertarse en la tabla roles:
-- 'manage_notifications', 'manage_whatsapp', 'view_notifications'

-- ============================================
-- 8. SEED DATA - 36 ACCIONES NOTIFICABLES
-- ============================================

INSERT INTO notification_actions (code, name, description, category, icon, color, available_variables, default_title_template, default_body_template) VALUES

-- VENTAS
('sale_created', 'Venta creada', 'Cuando se registra una venta en el POS o manualmente', 'ventas', 'ShoppingCart', '#10b981',
 '["venta_id","cliente_nombre","total","tipo_dte","numero_dte","sucursal"]',
 'Venta #{{venta_id}} creada - ${{total}}',
 'Cliente: {{cliente_nombre}}\nTotal: ${{total}}\nTipo: {{tipo_dte}}\nSucursal: {{sucursal}}'),

('sale_annulled', 'Venta anulada', 'Cuando se anula una venta y se invalida el DTE', 'ventas', 'Ban', '#ef4444',
 '["venta_id","cliente_nombre","total","motivo","sucursal"]',
 'Venta #{{venta_id}} anulada',
 'Cliente: {{cliente_nombre}}\nTotal: ${{total}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}'),

('sale_credit_note', 'Nota de crédito emitida', 'Cuando se emite una nota de crédito', 'ventas', 'FileMinus', '#f59e0b',
 '["venta_id","cliente_nombre","total","motivo"]',
 'Nota de Crédito #{{venta_id}} emitida',
 'Cliente: {{cliente_nombre}}\nMonto: ${{total}}\nMotivo: {{motivo}}'),

('sale_debit_note', 'Nota de débito emitida', 'Cuando se emite una nota de débito', 'ventas', 'FilePlus', '#f97316',
 '["venta_id","cliente_nombre","total","motivo"]',
 'Nota de Débito #{{venta_id}} emitida',
 'Cliente: {{cliente_nombre}}\nMonto: ${{total}}\nMotivo: {{motivo}}'),

-- DTE
('dte_emitted', 'DTE emitido', 'Cuando se genera y transmite un DTE a Hacienda exitosamente', 'dte', 'FileCheck', '#3b82f6',
 '["venta_id","cliente_nombre","tipo_dte","numero_control","codigo_generacion","total","sucursal"]',
 'DTE emitido - {{tipo_dte}} #{{numero_control}}',
 'Cliente: {{cliente_nombre}}\nCódigo: {{codigo_generacion}}\nTotal: ${{total}}\nSucursal: {{sucursal}}'),

('dte_invalidated', 'DTE invalidado', 'Cuando se invalida un DTE ante Hacienda', 'dte', 'FileX', '#8b5cf6',
 '["venta_id","cliente_nombre","tipo_dte","numero_control","codigo_generacion","motivo","sucursal"]',
 'DTE invalidado - {{tipo_dte}} #{{numero_control}}',
 'Cliente: {{cliente_nombre}}\nCódigo: {{codigo_generacion}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}'),

('dte_retransmitted', 'DTE retransmitido', 'Cuando se retransmite un DTE previamente rechazado', 'dte', 'RefreshCcw', '#06b6d4',
 '["venta_id","cliente_nombre","tipo_dte","numero_control","codigo_generacion"]',
 'DTE retransmitido - {{tipo_dte}} #{{numero_control}}',
 'Cliente: {{cliente_nombre}}\nCódigo: {{codigo_generacion}}'),

('dte_contingency', 'DTE en contingencia', 'Cuando se activa el módulo de contingencia DTE', 'dte', 'AlertTriangle', '#f59e0b',
 '["motivo","fecha_inicio","sucursal"]',
 'Contingencia DTE activada',
 'Motivo: {{motivo}}\nFecha: {{fecha_inicio}}\nSucursal: {{sucursal}}'),

('dte_rejected', 'DTE rechazado', 'Cuando Hacienda rechaza un DTE', 'dte', 'XCircle', '#ef4444',
 '["venta_id","cliente_nombre","tipo_dte","numero_control","codigo_generacion","error","sucursal"]',
 'DTE RECHAZADO - {{tipo_dte}} #{{numero_control}}',
 'Cliente: {{cliente_nombre}}\nError: {{error}}\nSucursal: {{sucursal}}'),

-- CXC
('cxc_payment_received', 'Pago de cliente registrado', 'Cuando se registra un abono o pago de cliente', 'cxc', 'Banknote', '#22c55e',
 '["pago_id","cliente_nombre","monto","referencia","sucursal"]',
 'Pago recibido - ${{monto}}',
 'Cliente: {{cliente_nombre}}\nMonto: ${{monto}}\nReferencia: {{referencia}}\nSucursal: {{sucursal}}'),

('cxc_payment_deleted', 'Pago de cliente eliminado', 'Cuando se elimina un pago de cliente', 'cxc', 'Trash2', '#ef4444',
 '["pago_id","cliente_nombre","monto","referencia","sucursal"]',
 'Pago eliminado - ${{monto}}',
 'Cliente: {{cliente_nombre}}\nMonto: ${{monto}}\nReferencia: {{referencia}}\nSucursal: {{sucursal}}'),

-- CXP
('cxp_payment_made', 'Pago a proveedor registrado', 'Cuando se registra un pago a proveedor', 'cxp', 'ArrowRightLeft', '#a855f7',
 '["pago_id","proveedor_nombre","monto","referencia","sucursal"]',
 'Pago a proveedor - ${{monto}}',
 'Proveedor: {{proveedor_nombre}}\nMonto: ${{monto}}\nReferencia: {{referencia}}\nSucursal: {{sucursal}}'),

('cxp_payment_deleted', 'Pago a proveedor eliminado', 'Cuando se elimina un pago a proveedor', 'cxp', 'Trash2', '#ef4444',
 '["pago_id","proveedor_nombre","monto","referencia","sucursal"]',
 'Pago a proveedor eliminado - ${{monto}}',
 'Proveedor: {{proveedor_nombre}}\nMonto: ${{monto}}\nReferencia: {{referencia}}\nSucursal: {{sucursal}}'),

-- COMPRAS
('purchase_created', 'Compra creada', 'Cuando se registra una compra', 'compras', 'Package', '#06b6d4',
 '["compra_id","proveedor_nombre","total","tipo_documento","numero_documento","sucursal"]',
 'Compra #{{compra_id}} creada - ${{total}}',
 'Proveedor: {{proveedor_nombre}}\nTotal: ${{total}}\nDocumento: {{tipo_documento}} #{{numero_documento}}\nSucursal: {{sucursal}}'),

('purchase_annulled', 'Compra anulada', 'Cuando se anula una compra', 'compras', 'Ban', '#ef4444',
 '["compra_id","proveedor_nombre","total","motivo","sucursal"]',
 'Compra #{{compra_id}} anulada',
 'Proveedor: {{proveedor_nombre}}\nTotal: ${{total}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}'),

('expense_created', 'Gasto registrado', 'Cuando se registra un gasto', 'compras', 'Receipt', '#f97316',
 '["gasto_id","proveedor_nombre","total","tipo_gasto","sucursal"]',
 'Gasto #{{gasto_id}} registrado - ${{total}}',
 'Proveedor: {{proveedor_nombre}}\nTotal: ${{total}}\nTipo: {{tipo_gasto}}\nSucursal: {{sucursal}}'),

('expense_annulled', 'Gasto anulado', 'Cuando se anula un gasto', 'compras', 'Ban', '#dc2626',
 '["gasto_id","proveedor_nombre","total","motivo","sucursal"]',
 'Gasto #{{gasto_id}} anulado',
 'Proveedor: {{proveedor_nombre}}\nTotal: ${{total}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}'),

-- INVENTARIO
('transfer_created', 'Traslado creado', 'Cuando se crea un traslado entre sucursales', 'inventario', 'ArrowLeftRight', '#14b8a6',
 '["traslado_id","origen_sucursal","destino_sucursal","total_productos","observaciones"]',
 'Traslado #{{traslado_id}} creado',
 'Origen: {{origen_sucursal}}\nDestino: {{destino_sucursal}}\nProductos: {{total_productos}}\nObservaciones: {{observaciones}}'),

('transfer_received', 'Traslado recibido', 'Cuando se recibe y confirma un traslado en la sucursal destino', 'inventario', 'PackageCheck', '#22c55e',
 '["traslado_id","origen_sucursal","destino_sucursal","total_productos","observaciones"]',
 'Traslado #{{traslado_id}} recibido',
 'Origen: {{origen_sucursal}}\nDestino: {{destino_sucursal}}\nProductos: {{total_productos}}'),

('transfer_annulled', 'Traslado anulado', 'Cuando se anula un traslado', 'inventario', 'Ban', '#ef4444',
 '["traslado_id","origen_sucursal","destino_sucursal","motivo"]',
 'Traslado #{{traslado_id}} anulado',
 'Origen: {{origen_sucursal}}\nDestino: {{destino_sucursal}}\nMotivo: {{motivo}}'),

('adjustment_applied', 'Ajuste de inventario aplicado', 'Cuando se aplica un ajuste de inventario (entrada/salida)', 'inventario', 'ArrowUpDown', '#6366f1',
 '["ajuste_id","producto_nombre","tipo","cantidad","motivo","sucursal"]',
 'Ajuste de inventario - {{tipo}}',
 'Producto: {{producto_nombre}}\nCantidad: {{cantidad}}\nTipo: {{tipo}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}'),

('physical_inventory_applied', 'Inventario físico aplicado', 'Cuando se aplica un conteo de inventario físico', 'inventario', 'Calculator', '#0ea5e9',
 '["sesion_id","sucursal","total_productos","diferencias_encontradas","observaciones"]',
 'Inventario físico aplicado',
 'Sucursal: {{sucursal}}\nProductos contados: {{total_productos}}\nDiferencias: {{diferencias_encontradas}}'),

('low_stock', 'Producto con stock mínimo', 'Cuando un producto baja de su stock mínimo configurado', 'inventario', 'AlertTriangle', '#f97316',
 '["producto_nombre","producto_codigo","stock_actual","stock_minimo","sucursal"]',
 'Stock bajo: {{producto_nombre}}',
 'Código: {{producto_codigo}}\nStock actual: {{stock_actual}}\nStock mínimo: {{stock_minimo}}\nSucursal: {{sucursal}}'),

-- GASOLINERA
('gas_closeout_completed', 'Cierre de turno completado', 'Cuando se completa un cierre de turno en gasolinera', 'gasolinera', 'Calculator', '#059669',
 '["turno","fecha","total_ventas","total_galones","num_despachadores","num_tanques","tanques","sucursal"]',
 'Cierre de turno {{turno}} - ${{total_ventas}}',
 'Turno: {{turno}}\nFecha: {{fecha}}\nTotal ventas: ${{total_ventas}}\nGalones: {{total_galones}}\nDespachadores: {{num_despachadores}}\nSucursal: {{sucursal}}'),

('gas_advance_given', 'Adelanto a despachador', 'Cuando se registra un adelanto a un despachador', 'gasolinera', 'Wallet', '#d97706',
 '["despachador_nombre","monto","fecha","sucursal"]',
 'Adelanto a {{despachador_nombre}} - ${{monto}}',
 'Despachador: {{despachador_nombre}}\nMonto: ${{monto}}\nFecha: {{fecha}}\nSucursal: {{sucursal}}'),

('gas_remesa_delivered', 'Remesa entregada', 'Cuando se entrega una remesa de gasolinera', 'gasolinera', 'Handshake', '#7c3aed',
 '["despachador_nombre","monto_entregado","turno","fecha","sucursal"]',
 'Remesa entregada - ${{monto_entregado}}',
 'Despachador: {{despachador_nombre}}\nMonto: ${{monto_entregado}}\nTurno: {{turno}}\nSucursal: {{sucursal}}'),

('gas_anticipo_created', 'Anticipo de cliente registrado', 'Cuando se registra un anticipo de cliente en gasolinera', 'gasolinera', 'Banknote', '#0891b2',
 '["cliente_nombre","monto","fecha","sucursal"]',
 'Anticipo registrado - ${{monto}}',
 'Cliente: {{cliente_nombre}}\nMonto: ${{monto}}\nFecha: {{fecha}}\nSucursal: {{sucursal}}'),

-- RRHH
('employee_created', 'Empleado creado', 'Cuando se registra un nuevo empleado en RRHH', 'rrhh', 'UserPlus', '#059669',
 '["empleado_nombre","empleado_codigo","cargo","departamento","sucursal"]',
 'Empleado {{empleado_nombre}} creado',
 'Código: {{empleado_codigo}}\nCargo: {{cargo}}\nDepartamento: {{departamento}}\nSucursal: {{sucursal}}'),

('payroll_generated', 'Planilla generada', 'Cuando se genera una planilla (quincenal, vacaciones, etc.)', 'rrhh', 'Calculator', '#2563eb',
 '["tipo_planilla","periodo","total_empleados","total_pagar","fecha_generacion"]',
 'Planilla {{tipo_planilla}} generada - ${{total_pagar}}',
 'Periodo: {{periodo}}\nEmpleados: {{total_empleados}}\nTotal: ${{total_pagar}}\nFecha: {{fecha_generacion}}'),

('payroll_closed', 'Planilla cerrada/pagada', 'Cuando se marca una planilla como pagada', 'rrhh', 'CheckCircle', '#16a34a',
 '["tipo_planilla","periodo","total_empleados","total_pagado","fecha_pago"]',
 'Planilla {{tipo_planilla}} pagada - ${{total_pagado}}',
 'Periodo: {{periodo}}\nEmpleados: {{total_empleados}}\nTotal pagado: ${{total_pagado}}'),

('settlement_created', 'Liquidación creada', 'Cuando se crea una liquidación de empleado', 'rrhh', 'FileText', '#9333ea',
 '["empleado_nombre","tipo_liquidacion","monto_total","motivo","fecha"]',
 'Liquidación creada - {{empleado_nombre}}',
 'Tipo: {{tipo_liquidacion}}\nMonto: ${{monto_total}}\nMotivo: {{motivo}}\nFecha: {{fecha}}'),

('vacation_payroll_generated', 'Planilla de vacaciones generada', 'Cuando se genera una planilla de vacaciones', 'rrhh', 'Umbrella', '#0d9488',
 '["periodo","total_empleados","total_pagar","fecha_generacion"]',
 'Planilla de Vacaciones generada - ${{total_pagar}}',
 'Periodo: {{periodo}}\nEmpleados: {{total_empleados}}\nTotal: ${{total_pagar}}'),

('bonus_payroll_generated', 'Planilla de aguinaldos generada', 'Cuando se genera una planilla de aguinaldos', 'rrhh', 'Gift', '#dc2626',
 '["periodo","total_empleados","total_pagar","fecha_generacion"]',
 'Planilla de Aguinaldos generada - ${{total_pagar}}',
 'Periodo: {{periodo}}\nEmpleados: {{total_empleados}}\nTotal: ${{total_pagar}}'),

-- CONTABILIDAD
('accounting_entry_created', 'Partida contable creada', 'Cuando se crea una partida contable', 'contabilidad', 'BookOpen', '#1d4ed8',
 '["partida_id","tipo_partida","descripcion","total_debe","total_haber","fecha"]',
 'Partida contable #{{partida_id}} creada',
 'Tipo: {{tipo_partida}}\nDescripción: {{descripcion}}\nDebe: ${{total_debe}} / Haber: ${{total_haber}}'),

('accounting_entry_voided', 'Partida contable anulada', 'Cuando se anula una partida contable', 'contabilidad', 'Lock', '#dc2626',
 '["partida_id","tipo_partida","descripcion","total","motivo"]',
 'Partida contable #{{partida_id}} anulada',
 'Descripción: {{descripcion}}\nTotal: ${{total}}\nMotivo: {{motivo}}'),

('accounting_closing_done', 'Cierre anual realizado', 'Cuando se ejecuta el cierre contable anual', 'contabilidad', 'Lock', '#9333ea',
 '["periodo_contable","fecha_cierre","usuario"]',
 'Cierre contable {{periodo_contable}} realizado',
 'Periodo: {{periodo_contable}}\nFecha: {{fecha_cierre}}\nUsuario: {{usuario}}'),

('accounting_opening_done', 'Apertura de ejercicio realizada', 'Cuando se realiza la apertura de un nuevo ejercicio contable', 'contabilidad', 'Unlock', '#16a34a',
 '["periodo_contable","fecha_apertura","usuario"]',
 'Apertura contable {{periodo_contable}} realizada',
 'Nuevo periodo: {{periodo_contable}}\nFecha: {{fecha_apertura}}\nUsuario: {{usuario}}'),

-- INDUSTRIAL
('production_batch_created', 'Lote de producción creado', 'Cuando se crea un lote en la planta industrial', 'industrial', 'Box', '#0891b2',
 '["lote_id","producto","cantidad","fecha","sucursal"]',
 'Lote #{{lote_id}} creado - {{producto}}',
 'Producto: {{producto}}\nCantidad: {{cantidad}} lbs\nFecha: {{fecha}}\nSucursal: {{sucursal}}'),

('production_batch_completed', 'Lote de producción completado', 'Cuando se completa un lote de producción', 'industrial', 'CheckCircle', '#16a34a',
 '["lote_id","producto","cantidad","rendimiento","duracion"]',
 'Lote #{{lote_id}} completado - {{producto}}',
 'Producto: {{producto}}\nCantidad: {{cantidad}} lbs\nRendimiento: {{rendimiento}}%\nDuración: {{duracion}} horas'),

('maintenance_log_created', 'Registro de mantenimiento', 'Cuando se crea un registro de mantenimiento en planta industrial', 'industrial', 'Wrench', '#f59e0b',
 '["equipo","tipo_mantenimiento","descripcion","fecha","sucursal"]',
 'Mantenimiento registrado - {{equipo}}',
 'Equipo: {{equipo}}\nTipo: {{tipo_mantenimiento}}\nDescripción: {{descripcion}}\nSucursal: {{sucursal}}')

ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), category = VALUES(category), icon = VALUES(icon), color = VALUES(color), available_variables = VALUES(available_variables), default_title_template = VALUES(default_title_template), default_body_template = VALUES(default_body_template);

COMMIT;
