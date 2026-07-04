import { 
    LayoutDashboard, 
    Building2, 
    GitBranch, 
    Monitor, 
    Users, 
    ShoppingCart, 
    Package, 
    Shield,
    UserCircle,
    Truck,
    Banknote,
    FileText,
    BarChart3,
    History,
    Tag,
    Settings,
    Box,
    ArrowLeftRight,
    ArrowUpDown,
    Calendar,
    Calculator,
    AlertTriangle,
    CreditCard,
    BookOpen,
    Receipt,
    Lock,
    Unlock,
    Sparkles,
    Undo2,
    ScrollText,
    Fuel,
    Droplets,
    UserCheck,
    Briefcase,
    Wallet,
    BadgePercent,
    HeartPulse,
    Gift,
    FileSignature,
    Umbrella
} from 'lucide-react';

export const topLevelItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
];

export const menuConfig = [
    {
        id: 'sistema',
        label: 'Sistema',
        icon: Building2,
        children: [
            { id: 'companies', label: 'Empresas', path: '/companies', icon: Building2, permission: 'manage_companies' },
            { id: 'branches', label: 'Sucursales', path: '/branches', icon: GitBranch, permission: 'manage_branches' },
            { id: 'pos', label: 'Gestión de Cajas', path: '/pos', icon: Monitor, permission: 'manage_pos' },
        ]
    },
    {
        id: 'ventas',
        label: 'Ventas',
        icon: Monitor,
        children: [
            { id: 'pos-terminal', label: 'Punto de Venta (POS)', path: '/ventas/nueva', icon: Monitor, permission: 'manage_pos_terminal' },
            { id: 'ventas-historial', label: 'Historial de Ventas', path: '/ventas', icon: FileText, permission: 'view_sales_history' },
            { id: 'ventas-combos', label: 'Combos de Productos', path: '/ventas/combos', icon: Package, permission: 'manage_combos' },
            { id: 'ventas-combustibles', label: 'Precios de Combustible', path: '/ventas/combustibles', icon: Banknote, permission: 'manage_fuel_prices' },
            { id: 'ventas-descuentos', label: 'Descuentos por Cliente', path: '/ventas/descuentos', icon: Tag, permission: 'manage_customer_discounts' },
            { id: 'ventas-reglas-descuento', label: 'Reglas de Descuento', path: '/ventas/reglas-descuento', icon: Tag, permission: 'manage_discount_rules' },
            { id: 'ventas-contingencia', label: 'Contingencia DTE', path: '/ventas/contingencia', icon: AlertTriangle, permission: 'manage_dte_contingency' },
            { id: 'ventas-retorno', label: 'Retorno / ERET', path: '/ventas/retorno', icon: Undo2, permission: 'manage_dte_return' },
            { id: 'pos-cierre', label: 'Corte de Caja', path: '/ventas/cierre', icon: Calculator, permission: 'manage_cash_closure' },
            { 
                id: 'ventas-reportes-parent', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'ventas-report-ventas', label: 'Reporte de Ventas', path: '/ventas/reportes/ventas', icon: FileText, permission: 'view_sales_report' },
                    { id: 'ventas-report-diarias', label: 'Reporte de Ventas Diarias', path: '/ventas/reportes/diarias', icon: FileText, permission: 'view_daily_sales_report' },
                    { id: 'ventas-report-categoria', label: 'Ventas por Categoría', path: '/ventas/reportes/categoria', icon: FileText, permission: 'view_sales_by_category' },
                    { id: 'ventas-report-pos', label: 'Ventas por POS', path: '/ventas/reportes/pos', icon: FileText, permission: 'view_sales_by_pos' },
                ]
            },
        ]
    },
    {
        id: 'contabilidad',
        label: 'Contabilidad',
        icon: BookOpen,
        children: [
            { id: 'contabilidad-cuentas', label: 'Catálogo de Cuentas', path: '/contabilidad/cuentas', icon: BookOpen, permission: 'manage_account_chart' },
            { id: 'contabilidad-partidas', label: 'Partidas Contables', path: '/contabilidad/partidas', icon: FileText, permission: 'manage_accounting_entries' },
            { id: 'contabilidad-cierre', label: 'Cierre Anual', path: '/contabilidad/cierre', icon: Lock, permission: 'manage_annual_close' },
            { id: 'contabilidad-apertura', label: 'Apertura de Ejercicio', path: '/contabilidad/apertura', icon: Unlock, permission: 'manage_fiscal_year_open' },
            { id: 'contabilidad-ajustes', label: 'Ajustes', path: '/contabilidad/ajustes', icon: Settings, permission: 'manage_accounting_adjustments' },
        ]
    },
    {
        id: 'cxc',
        label: 'Cuentas por Cobrar',
        icon: CreditCard,
        children: [
            { id: 'cxc-estado-cuenta', label: 'Consulta de Cliente', path: '/cxc/estado-cuenta', icon: FileText, permission: 'view_customer_statement' },
            { id: 'cxc-abonos', label: 'Abonos / Pagos', path: '/cxc/abonos', icon: Banknote, permission: 'manage_cxc_payments' },
            { 
                id: 'cxc-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'cxc-report-balances', label: 'Saldos de Clientes', path: '/cxc/reportes/saldos', icon: FileText, permission: 'view_cxc_balances' },
                    { id: 'cxc-report-pending-detailed', label: 'Documentos Pendientes', path: '/cxc/reportes/documentos-pendientes', icon: FileText, permission: 'view_cxc_pending_docs' },
                ]
            },

        ]
    },
    {
        id: 'cxp',
        label: 'Cuentas por Pagar',
        icon: CreditCard,
        children: [
            { id: 'cxp-estado-cuenta', label: 'Consulta de Proveedor', path: '/cxp/estado-cuenta', icon: FileText, permission: 'view_provider_statement' },
            { id: 'cxp-abonos', label: 'Abonos / Pagos', path: '/cxp/abonos', icon: Banknote, permission: 'manage_cxp_payments' },
            { 
                id: 'cxp-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'cxp-report-balances', label: 'Saldos de Proveedores', path: '/cxp/reportes/saldos', icon: FileText, permission: 'view_cxp_balances' },
                    { id: 'cxp-report-pending-detailed', label: 'Documentos por Pagar', path: '/cxp/reportes/documentos-pendientes', icon: FileText, permission: 'view_cxp_pending_docs' },
                ]
            },

        ]
    },
    {
        id: 'catalogos',
        label: 'Catálogos',
        icon: Package,
        children: [
            { id: 'customers', label: 'Clientes', path: '/customers', icon: ShoppingCart, permission: 'manage_customers' },
            { id: 'providers', label: 'Proveedores', path: '/providers', icon: Truck, permission: 'manage_providers' },
            { id: 'categories', label: 'Categorías', path: '/categories', icon: Tag, permission: 'manage_categories' },
            { id: 'products', label: 'Productos', path: '/products', icon: Package, permission: 'manage_products' },
            { id: 'sellers', label: 'Vendedores', path: '/sellers', icon: Users, permission: 'manage_sellers' },
        ]
    },
    {
        id: 'compras',
        label: 'Compras',
        icon: ShoppingCart,
        children: [
            { id: 'compras-lista', label: 'Gestión de Compras', path: '/compras', icon: FileText, permission: 'manage_purchases_list' },
            { id: 'compras-gastos', label: 'Gastos', path: '/compras/gastos', icon: Banknote, permission: 'manage_expenses' },
            { id: 'purchase-period', label: 'Periodo de Compras', path: '/compras/periodo', icon: Calendar, permission: 'manage_purchase_period' },
            { 
                id: 'compras-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'compras-report-compras', label: 'Reporte de Compras', path: '/compras/reportes/compras', icon: FileText, permission: 'view_purchases_report' },
                    { id: 'compras-report-gastos', label: 'Reporte de Gastos', path: '/compras/reportes/gastos', icon: FileText, permission: 'view_expenses_report' },
                ]
            },
        ]
    },
    {
        id: 'inventario',
        label: 'Inventario',
        icon: Box,
        children: [
            { id: 'transfers', label: 'Traslados', path: '/inventario/traslados', icon: ArrowLeftRight, permission: 'manage_transfers' },
            { id: 'adjustments', label: 'Movimientos', path: '/inventario/movimientos', icon: ArrowUpDown, permission: 'manage_inventory_adjustments' },
            { id: 'physical-inventory', label: 'Inventario Físico', path: '/inventario/fisico', icon: Calculator, permission: 'manage_physical_inventory' },
            { id: 'kardex', label: 'Consulta Kardex', path: '/inventario/kardex', icon: History, permission: 'manage_kardex' },
            { 
                id: 'inventory-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'inventory-report-stock', label: 'Reporte de Stock', path: '/inventario/reportes/stock', icon: FileText, permission: 'view_stock_report' },
                    { id: 'inventory-report-movements', label: 'Reporte de Movimientos', path: '/inventario/reportes/movimientos', icon: History, permission: 'view_movement_report' },
                ]
            },
        ]
    },
    {
        id: 'iva',
        label: 'Libros de IVA',
        icon: Calculator,
        children: [
            { id: 'iva-compras', label: 'Libro de Compras', path: '/iva/compras', icon: FileText, permission: 'view_purchase_ledger' },
            { id: 'iva-ventas-ccf', label: 'Ventas a Contribuyentes', path: '/iva/ventas-ccf', icon: FileText, permission: 'view_ccf_sales_ledger' },
            { id: 'iva-ventas-fac', label: 'Ventas a Consumidor', path: '/iva/ventas-fac', icon: FileText, permission: 'view_fac_sales_ledger' },
        ]
    },
    {
        id: 'industrial',
        label: 'Huevo Industrial',
        icon: Sparkles,
        children: [
            { id: 'industrial-dashboard', label: 'Panel IoT / SCADA', path: '/industrial/planta', icon: Monitor, permission: 'view_industrial_dashboard' },
            { id: 'industrial-reception', label: 'Recepción MP', path: '/industrial/recepcion', icon: Truck, permission: 'manage_mp_reception' },
            { id: 'industrial-production', label: 'Producción y Pasteurización', path: '/industrial/produccion', icon: Box, permission: 'manage_production' },
            { id: 'industrial-packaging', label: 'Empaque y Congelado', path: '/industrial/empaque', icon: Package, permission: 'manage_packaging' },
            { id: 'industrial-costs', label: 'Costeo y Mantenimiento', path: '/industrial/costos-mantenimiento', icon: Banknote, permission: 'manage_industrial_costs' },
            { id: 'industrial-traceability', label: 'Trazabilidad 360°', path: '/industrial/trazabilidad', icon: History, permission: 'manage_traceability' },
            { id: 'industrial-config', label: 'Ajustes', path: '/industrial/configuracion', icon: Settings, permission: 'manage_industrial_settings' }
        ]
    },
    {
        id: 'gasolinera',
        label: 'Gasolinera',
        icon: Fuel,
        children: [
            { 
                id: 'gas-catalogos', 
                label: 'Catálogos', 
                icon: Package,
                children: [
                    { id: 'gas-distributors', label: 'Distribuidores', path: '/gas-station/distributors', icon: Truck, permission: 'manage_gas_distributors' },
                    { id: 'gas-islands', label: 'Islas', path: '/gas-station/islands', icon: Monitor, permission: 'manage_gas_islands' },
                    { id: 'gas-nozzles', label: 'Mangueras', path: '/gas-station/nozzles', icon: Fuel, permission: 'manage_gas_nozzles' },
                    { id: 'gas-tanks', label: 'Tanques', path: '/gas-station/tanks', icon: Droplets, permission: 'manage_gas_tanks' },
                    { id: 'gas-expense-categories', label: 'Rubros Gastos', path: '/gas-station/expense-categories', icon: Receipt, permission: 'manage_gas_expense_categories' },
                    { id: 'gas-despachadores', label: 'Despachadores', path: '/gas-station/despachadores', icon: UserCheck, permission: 'manage_gas_attendants' },
                    { id: 'gas-desp-nozzles', label: 'Mangueras x Despachador', path: '/gas-station/despachador-nozzles', icon: Fuel, permission: 'manage_gas_attendant_nozzles' },
                    { id: 'gas-pos-types', label: 'Tipos de POS', path: '/gas-station/pos-tipos', icon: Monitor, permission: 'manage_gas_pos_types' },
                ]
            },
            { id: 'gas-cierre-lecturas', label: 'Cierre Lecturas', path: '/gas-station/cierre-lecturas', icon: Calculator, permission: 'manage_gas_readings_closure' },
            { id: 'gas-historial-lecturas', label: 'Historial de Lecturas', path: '/gas-station/historial-lecturas', icon: History, permission: 'view_gas_readings_history' },
            { id: 'gas-anticipos', label: 'Anticipos de Clientes', path: '/gas-station/anticipos', icon: Banknote, permission: 'manage_gas_advances' },
            { id: 'gas-configuracion', label: 'Configuración', path: '/gas-station/configuracion', icon: Settings, permission: 'manage_gas_settings' },
            { id: 'gas-reportes', label: 'Reportes', path: '/gas-station/reportes', icon: BarChart3, permission: 'view_gas_reports' },
        ]
    },
    {
        id: 'recursos-humanos',
        label: 'Recursos Humanos',
        icon: Users,
        children: [
            { id: 'rh-empleados', label: 'Empleados', path: '/rh/empleados', icon: Users, permission: 'manage_rh_empleados' },
            { id: 'rh-planilla-vacaciones', label: 'Planilla Vacaciones', path: '/rh/planilla-vacaciones', icon: Umbrella, permission: 'manage_rh_planilla_vacaciones' },
            { id: 'rh-planilla-liquidaciones', label: 'Planilla Liquidaciones', path: '/rh/liquidaciones', icon: FileText, permission: 'manage_rh_planilla_liquidaciones' },
            { id: 'rh-honorarios', label: 'Honorarios y Servicios', path: '/rh/honorarios', icon: FileSignature, permission: 'manage_rh_honorarios' },
            { id: 'rh-planilla-aguinaldos', label: 'Planilla Aguinaldos', path: '/rh/aguinaldos', icon: Gift, permission: 'manage_rh_planilla_aguinaldos' },
            { id: 'rh-config', label: 'Config. RH', path: '/rh/config-rh', icon: Settings, permission: 'manage_rh_config' },
            {
                id: 'rh-catalogos',
                label: 'Catálogos',
                icon: BookOpen,
                children: [
                    { id: 'rh-afps', label: 'AFPs', path: '/rh/afps', icon: Building2, permission: 'manage_rh_afps' },
                    { id: 'rh-cargos', label: 'Cargos', path: '/rh/cargos', icon: Briefcase, permission: 'manage_rh_cargos' },
                    { id: 'rh-descuentos-programados', label: 'Descuentos Programados', path: '/rh/descuentos-programados', icon: Wallet, permission: 'manage_rh_descuentos' },
                    { id: 'rh-departamentos', label: 'Departamentos de Personal', path: '/rh/departamentos', icon: Building2, permission: 'manage_rh_departamentos' },
                    { id: 'rh-afp-tasas', label: 'Porcentajes AFP', path: '/rh/afp-tasas', icon: BadgePercent, permission: 'manage_rh_afp_tasas' },
                    { id: 'rh-isss-tasas', label: 'Porcentajes ISSS', path: '/rh/isss-tasas', icon: HeartPulse, permission: 'manage_rh_isss_tasas' },
                    { id: 'rh-renta-config', label: 'Renta (ISR)', path: '/rh/renta-config', icon: Receipt, permission: 'manage_rh_renta_config' },
                    { id: 'rh-aguinaldo-config', label: 'Aguinaldo', path: '/rh/aguinaldo-config', icon: Gift, permission: 'manage_rh_aguinaldo_config' },
                    { id: 'rh-salario-minimo', label: 'Salario Mínimo', path: '/rh/salario-minimo', icon: Banknote, permission: 'manage_rh_salario_minimo' },
                    { id: 'rh-tipos-contrato', label: 'Tipos de Contrato', path: '/rh/tipos-contrato', icon: FileSignature, permission: 'manage_rh_tipos_contrato' },
                    { id: 'rh-cuentas-planillas', label: 'Cuentas de Planillas', path: '/rh/cuentas-planillas', icon: Calculator, permission: 'manage_rh_cuentas_planillas' },
                ]
            },
        ]
    },
    {
        id: 'seguridad',
        label: 'Seguridad',
        icon: Shield,
        children: [
            { id: 'users', label: 'Usuarios', path: '/users', icon: UserCircle, permission: 'manage_users' },
            { id: 'user-access', label: 'Accesos de Usuario', path: '/user-access', icon: GitBranch, permission: 'manage_user_access' },
            { id: 'roles', label: 'Roles', path: '/roles', icon: Shield, permission: 'manage_roles' },
            { id: 'audit-log', label: 'Bitácora del Sistema', path: '/seguridad/bitacora', icon: ScrollText, permission: 'manage_system' },
            { id: 'connected-users', label: 'Usuarios Conectados', path: '/seguridad/conectados', icon: Users, permission: 'manage_users' },
            { id: 'changelog', label: 'Historial de Cambios', path: '/changelog', icon: History, permission: 'manage_system' },
        ]
    },
    {
        id: 'configuracion',
        label: 'Configuración',
        icon: Settings,
        children: [
            { id: 'system-settings', label: 'Configuración del Sistema', path: '/configuracion/sistema', icon: Settings, permission: 'manage_system_settings' },
            { id: 'smtp', label: 'Configuración SMTP', path: '/configuracion/smtp', icon: Settings, permission: 'manage_smtp' },
        ]
    },
    {
        id: 'ia',
        label: 'Inteligencia Artificial',
        icon: Sparkles,
        hideInMenu: true,
        children: [
            { id: 'ai-assistant', label: 'Asistente Novas AI', permission: 'ai_assistant_access' }
        ]
    }
];

export const getAllPermissions = () => {
    const groups = [];
    
    menuConfig.forEach(group => {
        const perms = [];
        
        const extractPermissions = (items, prefix = '') => {
            items.forEach(item => {
                if (item.permission) {
                    const fullLabel = prefix ? `${prefix} - ${item.label}` : item.label;
                    perms.push({ id: item.permission, label: fullLabel });
                }
                
                if (item.children) {
                    const nextPrefix = item.label === 'Reportes' ? 'Reportes' : '';
                    extractPermissions(item.children, nextPrefix);
                }
            });
        };

        extractPermissions(group.children);

        if (perms.length > 0) {
            groups.push({
                id: group.id,
                label: group.label,
                icon: group.icon,
                permissions: perms
            });
        }
    });

    return groups;
};
