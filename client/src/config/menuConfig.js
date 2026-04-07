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
    CreditCard,
    Sparkles
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
            { id: 'pos-terminal', label: 'Punto de Venta (POS)', path: '/ventas/nueva', icon: Monitor, permission: 'manage_sales' },
            { id: 'ventas-historial', label: 'Historial de Ventas', path: '/ventas', icon: FileText, permission: 'view_sales' },
            { id: 'ventas-combos', label: 'Combos de Productos', path: '/ventas/combos', icon: Package, permission: 'manage_combos' },
            { id: 'ventas-combustibles', label: 'Precios de Combustible', path: '/ventas/combustibles', icon: Banknote, permission: 'manage_sales' },
            { id: 'ventas-descuentos', label: 'Descuentos por Cliente', path: '/ventas/descuentos', icon: Tag, permission: 'manage_sales' },
            { id: 'pos-cierre', label: 'Corte de Caja', path: '/ventas/cierre', icon: Calculator, permission: 'manage_sales' },
            { 
                id: 'ventas-reportes-parent', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'ventas-report-ventas', label: 'Reporte de Ventas', path: '/ventas/reportes/ventas', icon: FileText, permission: 'manage_sales' },
                    { id: 'ventas-report-diarias', label: 'Reporte de Ventas Diarias', path: '/ventas/reportes/diarias', icon: FileText, permission: 'manage_sales' },
                    { id: 'ventas-report-categoria', label: 'Ventas por Categoría', path: '/ventas/reportes/categoria', icon: FileText, permission: 'manage_sales' },
                ]
            },
        ]
    },
    {
        id: 'cxc',
        label: 'Cuentas por Cobrar',
        icon: CreditCard,
        children: [
            { id: 'cxc-estado-cuenta', label: 'Consulta de Cliente', path: '/cxc/estado-cuenta', icon: FileText, permission: 'view_sales' },
            { id: 'cxc-abonos', label: 'Abonos / Pagos', path: '/cxc/abonos', icon: Banknote, permission: 'manage_sales' },
            { 
                id: 'cxc-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'cxc-report-balances', label: 'Saldos de Clientes', path: '/cxc/reportes/saldos', icon: FileText, permission: 'view_sales' },
                ]
            },

        ]
    },
    {
        id: 'cxp',
        label: 'Cuentas por Pagar',
        icon: CreditCard,
        children: [
            { id: 'cxp-estado-cuenta', label: 'Consulta de Proveedor', path: '/cxp/estado-cuenta', icon: FileText, permission: 'manage_purchases' },
            { id: 'cxp-abonos', label: 'Abonos / Pagos', path: '/cxp/abonos', icon: Banknote, permission: 'manage_purchases' },
            { 
                id: 'cxp-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'cxp-report-balances', label: 'Saldos de Proveedores', path: '/cxp/reportes/saldos', icon: FileText, permission: 'manage_purchases' },
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
            { id: 'compras-lista', label: 'Gestión de Compras', path: '/compras', icon: FileText, permission: 'manage_purchases' },
            { id: 'compras-gastos', label: 'Gastos', path: '/compras/gastos', icon: Banknote, permission: 'manage_purchases' },
            { id: 'purchase-period', label: 'Periodo de Compras', path: '/compras/periodo', icon: Calendar, permission: 'manage_purchase_period' },
            { 
                id: 'compras-reports', 
                label: 'Reportes', 
                icon: BarChart3,
                children: [
                    { id: 'compras-report-compras', label: 'Reporte de Compras', path: '/compras/reportes/compras', icon: FileText, permission: 'manage_purchases' },
                    { id: 'compras-report-gastos', label: 'Reporte de Gastos', path: '/compras/reportes/gastos', icon: FileText, permission: 'manage_purchases' },
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
                    { id: 'inventory-report-stock', label: 'Reporte de Stock', path: '/inventario/reportes/stock', icon: FileText, permission: 'manage_kardex' },
                    { id: 'inventory-report-movements', label: 'Reporte de Movimientos', path: '/inventario/reportes/movimientos', icon: History, permission: 'manage_kardex' },
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
                    
                    // Solo evitar duplicados exactos (mismo ID y misma Etiqueta)
                    const isDuplicate = perms.some(p => p.id === item.permission && p.label === fullLabel);
                    
                    if (!isDuplicate) {
                        perms.push({ id: item.permission, label: fullLabel });
                    }
                }
                
                if (item.children) {
                    // Si el item se llama "Reportes", pasamos el prefijo a los hijos
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
