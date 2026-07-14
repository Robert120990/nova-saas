const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', parent: null, permission: 'view_dashboard', order: 1 },
  { id: 'sistema', label: 'Sistema', icon: 'Building2', parent: null, order: 10 },
  { id: 'companies', label: 'Empresas', path: '/companies', icon: 'Building2', parent: 'sistema', permission: 'manage_companies', order: 1 },
  { id: 'branches', label: 'Sucursales', path: '/branches', icon: 'GitBranch', parent: 'sistema', permission: 'manage_branches', order: 2 },
  { id: 'pos', label: 'Gestión de Cajas', path: '/pos', icon: 'Monitor', parent: 'sistema', permission: 'manage_pos', order: 3 },
  { id: 'ventas', label: 'Ventas', icon: 'Monitor', parent: null, order: 20 },
  { id: 'pos-terminal', label: 'Punto de Venta (POS)', path: '/ventas/nueva', icon: 'Monitor', parent: 'ventas', permission: 'manage_pos_terminal', order: 1 },
  { id: 'ventas-historial', label: 'Historial de Ventas', path: '/ventas', icon: 'FileText', parent: 'ventas', permission: 'view_sales_history', order: 2 },
  { id: 'ventas-combos', label: 'Combos de Productos', path: '/ventas/combos', icon: 'Package', parent: 'ventas', permission: 'manage_combos', order: 3 },
  { id: 'ventas-combustibles', label: 'Precios de Combustible', path: '/ventas/combustibles', icon: 'Banknote', parent: 'ventas', permission: 'manage_fuel_prices', order: 4 },
  { id: 'ventas-descuentos', label: 'Descuentos por Cliente', path: '/ventas/descuentos', icon: 'Tag', parent: 'ventas', permission: 'manage_customer_discounts', order: 5 },
  { id: 'ventas-reglas-descuento', label: 'Reglas de Descuento', path: '/ventas/reglas-descuento', icon: 'Tag', parent: 'ventas', permission: 'manage_discount_rules', order: 6 },
  { id: 'ventas-contingencia', label: 'Contingencia DTE', path: '/ventas/contingencia', icon: 'AlertTriangle', parent: 'ventas', permission: 'manage_dte_contingency', order: 7 },
  { id: 'ventas-retorno', label: 'Retorno / ERET', path: '/ventas/retorno', icon: 'Undo2', parent: 'ventas', permission: 'manage_dte_return', order: 8 },
  { id: 'pos-cierre', label: 'Corte de Caja', path: '/ventas/cierre', icon: 'Calculator', parent: 'ventas', permission: 'manage_cash_closure', order: 9 },
  { id: 'ventas-reportes-parent', label: 'Reportes', icon: 'BarChart3', parent: 'ventas', order: 10 },
  { id: 'ventas-report-ventas', label: 'Reporte de Ventas', path: '/ventas/reportes/ventas', icon: 'FileText', parent: 'ventas-reportes-parent', permission: 'view_sales_report', order: 1 },
  { id: 'ventas-report-diarias', label: 'Reporte de Ventas Diarias', path: '/ventas/reportes/diarias', icon: 'FileText', parent: 'ventas-reportes-parent', permission: 'view_daily_sales_report', order: 2 },
  { id: 'ventas-report-categoria', label: 'Ventas por Categoría', path: '/ventas/reportes/categoria', icon: 'FileText', parent: 'ventas-reportes-parent', permission: 'view_sales_by_category', order: 3 },
  { id: 'ventas-report-pos', label: 'Ventas por POS', path: '/ventas/reportes/pos', icon: 'FileText', parent: 'ventas-reportes-parent', permission: 'view_sales_by_pos', order: 4 },
  { id: 'contabilidad', label: 'Contabilidad', icon: 'BookOpen', parent: null, order: 30 },
  { id: 'contabilidad-cuentas', label: 'Catálogo de Cuentas', path: '/contabilidad/cuentas', icon: 'BookOpen', parent: 'contabilidad', permission: 'manage_account_chart', order: 1 },
  { id: 'contabilidad-partidas', label: 'Partidas Contables', path: '/contabilidad/partidas', icon: 'FileText', parent: 'contabilidad', permission: 'manage_accounting_entries', order: 2 },
  { id: 'contabilidad-cierre', label: 'Cierre Anual', path: '/contabilidad/cierre', icon: 'Lock', parent: 'contabilidad', permission: 'manage_annual_close', order: 3 },
  { id: 'contabilidad-apertura', label: 'Apertura de Ejercicio', path: '/contabilidad/apertura', icon: 'Unlock', parent: 'contabilidad', permission: 'manage_fiscal_year_open', order: 4 },
  { id: 'contabilidad-ajustes', label: 'Ajustes', path: '/contabilidad/ajustes', icon: 'Settings', parent: 'contabilidad', permission: 'manage_accounting_adjustments', order: 5 },
  { id: 'cxc', label: 'Cuentas por Cobrar', icon: 'CreditCard', parent: null, order: 40 },
  { id: 'cxc-estado-cuenta', label: 'Consulta de Cliente', path: '/cxc/estado-cuenta', icon: 'FileText', parent: 'cxc', permission: 'view_customer_statement', order: 1 },
  { id: 'cxc-abonos', label: 'Abonos / Pagos', path: '/cxc/abonos', icon: 'Banknote', parent: 'cxc', permission: 'manage_cxc_payments', order: 2 },
  { id: 'cxc-reports', label: 'Reportes', icon: 'BarChart3', parent: 'cxc', order: 3 },
  { id: 'cxc-report-balances', label: 'Saldos de Clientes', path: '/cxc/reportes/saldos', icon: 'FileText', parent: 'cxc-reports', permission: 'view_cxc_balances', order: 1 },
  { id: 'cxc-report-pending-detailed', label: 'Documentos Pendientes', path: '/cxc/reportes/documentos-pendientes', icon: 'FileText', parent: 'cxc-reports', permission: 'view_cxc_pending_docs', order: 2 },
  { id: 'cxp', label: 'Cuentas por Pagar', icon: 'CreditCard', parent: null, order: 50 },
  { id: 'cxp-estado-cuenta', label: 'Consulta de Proveedor', path: '/cxp/estado-cuenta', icon: 'FileText', parent: 'cxp', permission: 'view_provider_statement', order: 1 },
  { id: 'cxp-abonos', label: 'Abonos / Pagos', path: '/cxp/abonos', icon: 'Banknote', parent: 'cxp', permission: 'manage_cxp_payments', order: 2 },
  { id: 'cxp-reports', label: 'Reportes', icon: 'BarChart3', parent: 'cxp', order: 3 },
  { id: 'cxp-report-balances', label: 'Saldos de Proveedores', path: '/cxp/reportes/saldos', icon: 'FileText', parent: 'cxp-reports', permission: 'view_cxp_balances', order: 1 },
  { id: 'cxp-report-pending-detailed', label: 'Documentos por Pagar', path: '/cxp/reportes/documentos-pendientes', icon: 'FileText', parent: 'cxp-reports', permission: 'view_cxp_pending_docs', order: 2 },
  { id: 'catalogos', label: 'Catálogos', icon: 'Package', parent: null, order: 60 },
  { id: 'customers', label: 'Clientes', path: '/customers', icon: 'ShoppingCart', parent: 'catalogos', permission: 'manage_customers', order: 1 },
  { id: 'providers', label: 'Proveedores', path: '/providers', icon: 'Truck', parent: 'catalogos', permission: 'manage_providers', order: 2 },
  { id: 'categories', label: 'Categorías', path: '/categories', icon: 'Tag', parent: 'catalogos', permission: 'manage_categories', order: 3 },
  { id: 'products', label: 'Productos', path: '/products', icon: 'Package', parent: 'catalogos', permission: 'manage_products', order: 4 },
  { id: 'sellers', label: 'Vendedores', path: '/sellers', icon: 'Users', parent: 'catalogos', permission: 'manage_sellers', order: 5 },
  { id: 'customers-batch-delete', label: 'Eliminación Masiva de Clientes', icon: 'Users', parent: 'catalogos', permission: 'manage_customers_batch_delete', order: 6, hide: true },
  { id: 'compras', label: 'Compras', icon: 'ShoppingCart', parent: null, order: 70 },
  { id: 'compras-lista', label: 'Gestión de Compras', path: '/compras', icon: 'FileText', parent: 'compras', permission: 'manage_purchases_list', order: 1 },
  { id: 'compras-gastos', label: 'Gastos', path: '/compras/gastos', icon: 'Banknote', parent: 'compras', permission: 'manage_expenses', order: 2 },
  { id: 'compras-chq-contado', label: 'Chq Contado', path: '/compras/chq-contado', icon: 'CreditCard', parent: 'compras', permission: 'manage_purchase_checks', order: 3 },
  { id: 'compras-quedan', label: 'Quedan', path: '/compras/quedan', icon: 'FileSignature', parent: 'compras', permission: 'manage_purchase_quedan', order: 4 },
  { id: 'purchase-period', label: 'Periodo de Compras', path: '/compras/periodo', icon: 'Calendar', parent: 'compras', permission: 'manage_purchase_period', order: 5 },
  { id: 'compras-reports', label: 'Reportes', icon: 'BarChart3', parent: 'compras', order: 6 },
  { id: 'compras-report-compras', label: 'Reporte de Compras', path: '/compras/reportes/compras', icon: 'FileText', parent: 'compras-reports', permission: 'view_purchases_report', order: 1 },
  { id: 'compras-report-gastos', label: 'Reporte de Gastos', path: '/compras/reportes/gastos', icon: 'FileText', parent: 'compras-reports', permission: 'view_expenses_report', order: 2 },
  { id: 'inventario', label: 'Inventario', icon: 'Box', parent: null, order: 80 },
  { id: 'transfers', label: 'Traslados', path: '/inventario/traslados', icon: 'ArrowLeftRight', parent: 'inventario', permission: 'manage_transfers', order: 1 },
  { id: 'adjustments', label: 'Movimientos', path: '/inventario/movimientos', icon: 'ArrowUpDown', parent: 'inventario', permission: 'manage_inventory_adjustments', order: 2 },
  { id: 'physical-inventory', label: 'Inventario Físico', path: '/inventario/fisico', icon: 'Calculator', parent: 'inventario', permission: 'manage_physical_inventory', order: 3 },
  { id: 'kardex', label: 'Consulta Kardex', path: '/inventario/kardex', icon: 'History', parent: 'inventario', permission: 'manage_kardex', order: 4 },
  { id: 'inventory-reports', label: 'Reportes', icon: 'BarChart3', parent: 'inventario', order: 5 },
  { id: 'inventory-report-stock', label: 'Reporte de Stock', path: '/inventario/reportes/stock', icon: 'FileText', parent: 'inventory-reports', permission: 'view_stock_report', order: 1 },
  { id: 'inventory-report-movements', label: 'Reporte de Movimientos', path: '/inventario/reportes/movimientos', icon: 'History', parent: 'inventory-reports', permission: 'view_movement_report', order: 2 },
  { id: 'iva', label: 'Libros de IVA', icon: 'Calculator', parent: null, order: 90 },
  { id: 'iva-compras', label: 'Libro de Compras', path: '/iva/compras', icon: 'FileText', parent: 'iva', permission: 'view_purchase_ledger', order: 1 },
  { id: 'iva-ventas-ccf', label: 'Ventas a Contribuyentes', path: '/iva/ventas-ccf', icon: 'FileText', parent: 'iva', permission: 'view_ccf_sales_ledger', order: 2 },
  { id: 'iva-ventas-fac', label: 'Ventas a Consumidor', path: '/iva/ventas-fac', icon: 'FileText', parent: 'iva', permission: 'view_fac_sales_ledger', order: 3 },
  { id: 'industrial', label: 'Huevo Industrial', icon: 'Sparkles', parent: null, order: 100 },
  { id: 'industrial-dashboard', label: 'Panel IoT / SCADA', path: '/industrial/planta', icon: 'Monitor', parent: 'industrial', permission: 'view_industrial_dashboard', order: 1 },
  { id: 'industrial-reception', label: 'Recepción MP', path: '/industrial/recepcion', icon: 'Truck', parent: 'industrial', permission: 'manage_mp_reception', order: 2 },
  { id: 'industrial-production', label: 'Producción y Pasteurización', path: '/industrial/produccion', icon: 'Box', parent: 'industrial', permission: 'manage_production', order: 3 },
  { id: 'industrial-packaging', label: 'Empaque y Congelado', path: '/industrial/empaque', icon: 'Package', parent: 'industrial', permission: 'manage_packaging', order: 4 },
  { id: 'industrial-costs', label: 'Costeo y Mantenimiento', path: '/industrial/costos-mantenimiento', icon: 'Banknote', parent: 'industrial', permission: 'manage_industrial_costs', order: 5 },
  { id: 'industrial-traceability', label: 'Trazabilidad 360°', path: '/industrial/trazabilidad', icon: 'History', parent: 'industrial', permission: 'manage_traceability', order: 6 },
  { id: 'industrial-config', label: 'Ajustes', path: '/industrial/configuracion', icon: 'Settings', parent: 'industrial', permission: 'manage_industrial_settings', order: 7 },
  { id: 'gasolinera', label: 'Gasolinera', icon: 'Fuel', parent: null, order: 110 },
  { id: 'gas-catalogos', label: 'Catálogos', icon: 'Package', parent: 'gasolinera', order: 1 },
  { id: 'gas-distributors', label: 'Distribuidores', path: '/gas-station/distributors', icon: 'Truck', parent: 'gas-catalogos', permission: 'manage_gas_distributors', order: 1 },
  { id: 'gas-islands', label: 'Islas', path: '/gas-station/islands', icon: 'Monitor', parent: 'gas-catalogos', permission: 'manage_gas_islands', order: 2 },
  { id: 'gas-nozzles', label: 'Mangueras', path: '/gas-station/nozzles', icon: 'Fuel', parent: 'gas-catalogos', permission: 'manage_gas_nozzles', order: 3 },
  { id: 'gas-tanks', label: 'Tanques', path: '/gas-station/tanks', icon: 'Droplets', parent: 'gas-catalogos', permission: 'manage_gas_tanks', order: 4 },
  { id: 'gas-expense-categories', label: 'Rubros Gastos', path: '/gas-station/expense-categories', icon: 'Receipt', parent: 'gas-catalogos', permission: 'manage_gas_expense_categories', order: 5 },
  { id: 'gas-despachadores', label: 'Despachadores', path: '/gas-station/despachadores', icon: 'UserCheck', parent: 'gas-catalogos', permission: 'manage_gas_attendants', order: 6 },
  { id: 'gas-desp-nozzles', label: 'Mangueras x Despachador', path: '/gas-station/despachador-nozzles', icon: 'Fuel', parent: 'gas-catalogos', permission: 'manage_gas_attendant_nozzles', order: 7 },
  { id: 'gas-pos-types', label: 'Tipos de POS', path: '/gas-station/pos-tipos', icon: 'Monitor', parent: 'gas-catalogos', permission: 'manage_gas_pos_types', order: 8 },
  { id: 'gas-cierre-lecturas', label: 'Cierre Lecturas', path: '/gas-station/cierre-lecturas', icon: 'Calculator', parent: 'gasolinera', permission: 'manage_gas_readings_closure', order: 2 },
  { id: 'gas-historial-lecturas', label: 'Historial de Lecturas', path: '/gas-station/historial-lecturas', icon: 'History', parent: 'gasolinera', permission: 'view_gas_readings_history', extraPermissions: ['manage_gas_closeout_reopen'], order: 3 },
  { id: 'gas-anticipos', label: 'Anticipos de Clientes', path: '/gas-station/anticipos', icon: 'Banknote', parent: 'gasolinera', permission: 'manage_gas_advances', order: 4 },
  { id: 'gas-entrega-remesas', label: 'Entrega de Remesas', path: '/gas-station/entrega-remesas', icon: 'Handshake', parent: 'gasolinera', permission: 'manage_gas_remesa_delivery', order: 5 },
  { id: 'gas-configuracion', label: 'Configuración', path: '/gas-station/configuracion', icon: 'Settings', parent: 'gasolinera', permission: 'manage_gas_settings', order: 6 },
  { id: 'gas-reportes-parent', label: 'Reportes', icon: 'BarChart3', parent: 'gasolinera', order: 7 },
  { id: 'gas-reporte-ventas', label: 'Lecturas - Ventas', path: '/gas-station/reporte-ventas', icon: 'BarChart3', parent: 'gas-reportes-parent', permission: 'view_gas_fuel_sales_report', order: 1 },
  { id: 'gas-reporte-detalle-cierre', label: 'Detalle del Cierre', path: '/gas-station/reporte-detalle-cierre', icon: 'FileText', parent: 'gas-reportes-parent', permission: 'view_gas_closeout_detail', order: 2 },
  { id: 'gas-reporte-inventario', label: 'Inventario Combustible', path: '/gas-station/reporte-inventario-combustible', icon: 'BarChart3', parent: 'gas-reportes-parent', permission: 'view_gas_fuel_inventory_report', order: 3 },
  { id: 'recursos-humanos', label: 'Recursos Humanos', icon: 'Users', parent: null, order: 120 },
  { id: 'rh-empleados', label: 'Empleados', path: '/rh/empleados', icon: 'Users', parent: 'recursos-humanos', permission: 'manage_rh_empleados', order: 1 },
  { id: 'rh-planilla-vacaciones', label: 'Planilla Vacaciones', path: '/rh/planilla-vacaciones', icon: 'Umbrella', parent: 'recursos-humanos', permission: 'manage_rh_planilla_vacaciones', order: 2 },
  { id: 'rh-planillas', label: 'Planillas', path: '/rh/planillas', icon: 'Calculator', parent: 'recursos-humanos', permission: 'manage_rh_planillas', order: 3 },
  { id: 'rh-planilla-liquidaciones', label: 'Planilla Liquidaciones', path: '/rh/liquidaciones', icon: 'FileText', parent: 'recursos-humanos', permission: 'manage_rh_planilla_liquidaciones', order: 4 },
  { id: 'rh-honorarios', label: 'Honorarios y Servicios', path: '/rh/honorarios', icon: 'FileSignature', parent: 'recursos-humanos', permission: 'manage_rh_honorarios', order: 5 },
  { id: 'rh-planilla-aguinaldos', label: 'Planilla Aguinaldos', path: '/rh/aguinaldos', icon: 'Gift', parent: 'recursos-humanos', permission: 'manage_rh_planilla_aguinaldos', order: 6 },
  { id: 'rh-config', label: 'Config. RH', path: '/rh/config-rh', icon: 'Settings', parent: 'recursos-humanos', permission: 'manage_rh_config', order: 7 },
  { id: 'rh-catalogos', label: 'Catálogos', icon: 'BookOpen', parent: 'recursos-humanos', order: 8 },
  { id: 'rh-afps', label: 'AFPs', path: '/rh/afps', icon: 'Building2', parent: 'rh-catalogos', permission: 'manage_rh_afps', order: 1 },
  { id: 'rh-cargos', label: 'Cargos', path: '/rh/cargos', icon: 'Briefcase', parent: 'rh-catalogos', permission: 'manage_rh_cargos', order: 2 },
  { id: 'rh-descuentos-programados', label: 'Descuentos Programados', path: '/rh/descuentos-programados', icon: 'Wallet', parent: 'rh-catalogos', permission: 'manage_rh_descuentos', order: 3 },
  { id: 'rh-departamentos', label: 'Departamentos de Personal', path: '/rh/departamentos', icon: 'Building2', parent: 'rh-catalogos', permission: 'manage_rh_departamentos', order: 4 },
  { id: 'rh-afp-tasas', label: 'Porcentajes AFP', path: '/rh/afp-tasas', icon: 'BadgePercent', parent: 'rh-catalogos', permission: 'manage_rh_afp_tasas', order: 5 },
  { id: 'rh-isss-tasas', label: 'Porcentajes ISSS', path: '/rh/isss-tasas', icon: 'HeartPulse', parent: 'rh-catalogos', permission: 'manage_rh_isss_tasas', order: 6 },
  { id: 'rh-renta-config', label: 'Renta (ISR)', path: '/rh/renta-config', icon: 'Receipt', parent: 'rh-catalogos', permission: 'manage_rh_renta_config', order: 7 },
  { id: 'rh-aguinaldo-config', label: 'Aguinaldo', path: '/rh/aguinaldo-config', icon: 'Gift', parent: 'rh-catalogos', permission: 'manage_rh_aguinaldo_config', order: 8 },
  { id: 'rh-salario-minimo', label: 'Salario Mínimo', path: '/rh/salario-minimo', icon: 'Banknote', parent: 'rh-catalogos', permission: 'manage_rh_salario_minimo', order: 9 },
  { id: 'rh-tipos-contrato', label: 'Tipos de Contrato', path: '/rh/tipos-contrato', icon: 'FileSignature', parent: 'rh-catalogos', permission: 'manage_rh_tipos_contrato', order: 10 },
  { id: 'rh-cuentas-planillas', label: 'Cuentas de Planillas', path: '/rh/cuentas-planillas', icon: 'Calculator', parent: 'rh-catalogos', permission: 'manage_rh_cuentas_planillas', order: 11 },
  { id: 'seguridad', label: 'Seguridad', icon: 'Shield', parent: null, order: 130 },
  { id: 'users', label: 'Usuarios', path: '/users', icon: 'UserCircle', parent: 'seguridad', permission: 'manage_users', order: 1 },
  { id: 'user-access', label: 'Accesos de Usuario', path: '/user-access', icon: 'GitBranch', parent: 'seguridad', permission: 'manage_user_access', order: 2 },
  { id: 'roles', label: 'Roles', path: '/roles', icon: 'Shield', parent: 'seguridad', permission: 'manage_roles', order: 3 },
  { id: 'audit-log', label: 'Bitácora del Sistema', path: '/seguridad/bitacora', icon: 'ScrollText', parent: 'seguridad', permission: 'manage_system', order: 4 },
  { id: 'connected-users', label: 'Usuarios Conectados', path: '/seguridad/conectados', icon: 'Users', parent: 'seguridad', permission: 'manage_connected_users', order: 5 },
  { id: 'changelog', label: 'Historial de Cambios', path: '/changelog', icon: 'History', parent: 'seguridad', permission: 'manage_changelog', order: 6 },
  { id: 'configuracion', label: 'Configuración', icon: 'Settings', parent: null, order: 140 },
  { id: 'system-settings', label: 'Configuración del Sistema', path: '/configuracion/sistema', icon: 'Settings', parent: 'configuracion', permission: 'manage_system_settings', order: 1 },
  { id: 'smtp', label: 'Configuración SMTP', path: '/configuracion/smtp', icon: 'Settings', parent: 'configuracion', permission: 'manage_smtp', order: 2 },
  { id: 'admin-menu', label: 'Menú del Sistema', path: '/admin/menu-items', icon: 'Menu', parent: 'configuracion', permission: 'manage_menu', order: 3 },
  { id: 'ia', label: 'Inteligencia Artificial', icon: 'Sparkles', parent: null, hide: true, order: 150 },
  { id: 'ai-assistant', label: 'Asistente Novas AI', icon: 'Sparkles', parent: 'ia', permission: 'ai_assistant_access', order: 1, hide: true },
];

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    console.log('Creating menu_items table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT NULL,
        label VARCHAR(100) NOT NULL,
        path VARCHAR(200) NULL,
        icon VARCHAR(50) NULL,
        permission_key VARCHAR(100) NULL,
        extra_permissions JSON NULL,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        hide_in_menu BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
      )
    `);
    console.log('Table created successfully');

    const existing = await pool.query('SELECT COUNT(*) as count FROM menu_items');
    if (existing[0][0].count > 0) {
      console.log(`Table already has ${existing[0][0].count} items, skipping seed`);
      console.log('Migration completed.');
      return;
    }

    console.log('Seeding menu items...');

    const idMap = {};

    const insertStmt = `INSERT INTO menu_items (id, parent_id, label, path, icon, permission_key, extra_permissions, sort_order, is_active, hide_in_menu) VALUES ?`;

    const batchSize = 50;
    const totalItems = MENU_ITEMS.length;

    for (let i = 0; i < totalItems; i += batchSize) {
      const batch = MENU_ITEMS.slice(i, i + batchSize);
      const values = batch.map(item => [
        MENU_ITEMS.indexOf(item) + 1,
        null,
        item.label,
        item.path || null,
        item.icon || null,
        item.permission || null,
        item.extraPermissions ? JSON.stringify(item.extraPermissions) : null,
        item.order || 0,
        true,
        item.hide ? 1 : 0,
      ]);
      await pool.query(insertStmt, [values]);
    }

    const updateStmt = `UPDATE menu_items SET parent_id = ? WHERE id = ?`;
    for (const item of MENU_ITEMS) {
      if (item.parent) {
        const parentIdx = MENU_ITEMS.findIndex(p => p.id === item.parent);
        if (parentIdx !== -1) {
          await pool.query(updateStmt, [parentIdx + 1, MENU_ITEMS.indexOf(item) + 1]);
        }
      }
    }

    console.log(`Seeded ${totalItems} menu items successfully`);
    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
