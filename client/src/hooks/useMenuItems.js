import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo } from 'react';
import iconMap from '../config/iconMap';

export const GROUP_MODULE_MAP = {
    'Huevo Industrial': 'egg_industrial',
    'Industrial': 'egg_industrial',
    'Planta de Huevo': 'egg_industrial',
    'Gasolinera': 'gas_station',
    'Control de Pozo': 'pozo',
    'CRM': 'crm',
    'Contabilidad': 'accounting',
    'Recursos Humanos': 'human_resources',
    'Ventas': 'sales',
    'Cuentas por Cobrar': 'sales',
    'Compras': 'purchases',
    'Cuentas por Pagar': 'purchases',
    'Inventario': 'inventory',
};

export const ITEM_MODULE_MAP = {
    '/ventas/combustibles': 'gas_station',
    '/ventas/dtes-turno': 'gas_station',
    '/ventas/entrega-remesas': 'gas_station',
};

function normalize(item) {
    return {
        ...item,
        permission: item.permission_key,
        hideInMenu: !!item.hide_in_menu,
        icon: iconMap[item.icon] || iconMap.Circle,
        children: [],
    };
}

function buildTree(items) {
    const itemMap = {};
    const roots = [];

    items.forEach(item => {
        // Asegurar que calendario tenga su propia clave de permiso
        const itemPerm = item.path === '/industrial/calendario' 
            ? 'manage_production_calendar' 
            : item.permission_key;

        itemMap[item.id] = {
            ...normalize(item),
            permission: itemPerm,
            permission_key: itemPerm,
        };
    });

    // Grupos raíz clave para rescatar submenús con parent_id desfasado
    let industrialRoot = Object.values(itemMap).find(i => !i.parent_id && (i.label?.includes('Industrial') || i.label?.includes('Huevo')));
    let crmRoot = Object.values(itemMap).find(i => !i.parent_id && i.label === 'CRM');

    // Si CRM no existe en raíces de la BD, crearlo virtualmente para navegación
    if (!crmRoot) {
        crmRoot = {
            id: 'virtual-crm-root',
            label: 'CRM',
            icon: iconMap.Handshake || iconMap.Circle,
            children: [],
            permission: null,
            hideInMenu: false
        };
        roots.push(crmRoot);
    }

    items.forEach(item => {
        const normalized = itemMap[item.id];
        if (item.parent_id && itemMap[item.parent_id]) {
            itemMap[item.parent_id].children.push(normalized);
        } else if (!item.parent_id) {
            roots.push(normalized);
        } else {
            // Huérfano con parent_id que no existe en el catálogo
            if (item.path?.startsWith('/industrial/') && industrialRoot) {
                industrialRoot.children.push(normalized);
            } else if (item.path?.startsWith('/crm/') && crmRoot) {
                crmRoot.children.push(normalized);
            } else {
                roots.push(normalized);
            }
        }
    });

    // Asegurar submenús clave en CRM
    if (crmRoot) {
        if (!crmRoot.children.some(c => c.path === '/crm/cotizaciones')) {
            crmRoot.children.unshift({
                id: 'virtual-crm-quotations',
                label: 'Cotizador Comercial',
                path: '/crm/cotizaciones',
                permission: 'manage_crm_quotes',
                permission_key: 'manage_crm_quotes',
                hideInMenu: false,
                icon: iconMap.FileText || iconMap.Circle,
                children: []
            });
        }
        if (!crmRoot.children.some(c => c.path === '/crm/acuerdos')) {
            crmRoot.children.push({
                id: 'virtual-crm-agreements',
                label: 'Acuerdos con Clientes',
                path: '/crm/acuerdos',
                permission: 'manage_customer_agreements',
                permission_key: 'manage_customer_agreements',
                hideInMenu: false,
                icon: iconMap.FileSignature || iconMap.Circle,
                children: []
            });
        }
        if (!crmRoot.children.some(c => c.path === '/crm/configuracion')) {
            crmRoot.children.push({
                id: 'virtual-crm-config',
                label: 'Configuración de CRM',
                path: '/crm/configuracion',
                permission: 'manage_crm_settings',
                permission_key: 'manage_crm_settings',
                hideInMenu: false,
                icon: iconMap.Settings || iconMap.Circle,
                children: []
            });
        }
    }

    // Asegurar submenú Calendario en Huevo Industrial
    if (industrialRoot && !industrialRoot.children.some(c => c.path === '/industrial/calendario')) {
        industrialRoot.children.splice(3, 0, {
            id: 'virtual-industrial-calendar',
            label: 'Calendario de Producción',
            path: '/industrial/calendario',
            permission: 'manage_production_calendar',
            permission_key: 'manage_production_calendar',
            hideInMenu: false,
            icon: iconMap.Calendar || iconMap.Circle,
            children: []
        });
    }

    // Asegurar reportes de inventario (Valorización y Rotación)
    const invReportsNode = Object.values(itemMap).find(i => 
        (i.id === 60 || i.id === 'inventory-reports') ||
        (i.children && i.children.some(c => c.path === '/inventario/reportes/stock'))
    );

    if (invReportsNode) {
        if (!invReportsNode.children.some(c => c.path === '/inventario/reportes/valorizacion')) {
            invReportsNode.children.push({
                id: 'virtual-inventory-valuation',
                label: 'Valorización y Márgenes',
                path: '/inventario/reportes/valorizacion',
                permission: 'view_inventory_valuation_report',
                permission_key: 'view_inventory_valuation_report',
                hideInMenu: false,
                icon: iconMap.TrendingUp || iconMap.Circle,
                children: []
            });
        }
        if (!invReportsNode.children.some(c => c.path === '/inventario/reportes/rotacion')) {
            invReportsNode.children.push({
                id: 'virtual-inventory-turnover',
                label: 'Rotación y Obsolescencia',
                path: '/inventario/reportes/rotacion',
                permission: 'view_inventory_turnover_report',
                permission_key: 'view_inventory_turnover_report',
                hideInMenu: false,
                icon: iconMap.Clock || iconMap.Circle,
                children: []
            });
        }
    }

    // Asegurar Liquidación IVA y Pago a Cuenta en Libros de IVA
    const ivaNode = Object.values(itemMap).find(i => 
        (i.id === 63 || i.label === 'Libros de IVA') ||
        (i.children && i.children.some(c => c.path === '/iva/compras'))
    );
    if (ivaNode && !ivaNode.children.some(c => c.path === '/iva/liquidacion')) {
        ivaNode.children.push({
            id: 'virtual-vat-liquidation',
            label: 'Liquidación IVA y Pago a Cuenta',
            path: '/iva/liquidacion',
            permission: 'view_vat_liquidation',
            permission_key: 'view_vat_liquidation',
            hideInMenu: false,
            icon: iconMap.Calculator || iconMap.Circle,
            children: []
        });
    }

    // Asegurar Reporte de Cheques de Contado en Reportes de Compras
    const purchaseReportsNode = Object.values(itemMap).find(i => 
        (i.id === 52) ||
        (i.children && i.children.some(c => c.path === '/compras/reportes/compras'))
    );
    if (purchaseReportsNode && !purchaseReportsNode.children.some(c => c.path === '/compras/reportes/chq-contado')) {
        purchaseReportsNode.children.push({
            id: 'virtual-purchase-checks-report',
            label: 'Reporte de Cheques de Contado',
            path: '/compras/reportes/chq-contado',
            permission: 'view_purchase_checks_report',
            permission_key: 'view_purchase_checks_report',
            hideInMenu: false,
            icon: iconMap.CreditCard || iconMap.Circle,
            children: []
        });
    }

    // Asegurar Reporte de Estado de Cuenta en Reportes de Cuentas por Cobrar (CXC)
    const cxcReportsNode = Object.values(itemMap).find(i => 
        (i.id === 30) ||
        (i.children && i.children.some(c => c.path === '/cxc/reportes/saldos'))
    );
    if (cxcReportsNode && !cxcReportsNode.children.some(c => c.path === '/cxc/reportes/estado-cuenta')) {
        cxcReportsNode.children.push({
            id: 'virtual-cxc-statement-report',
            label: 'Reporte de Estado de Cuenta',
            path: '/cxc/reportes/estado-cuenta',
            permission: 'view_cxc_statement_report',
            permission_key: 'view_cxc_statement_report',
            hideInMenu: false,
            icon: iconMap.FileText || iconMap.Circle,
            children: []
        });
    }

    // Asegurar Reporte de Lubricantes Vendidos en Reportes de Gasolinera
    const gasReportsNode = Object.values(itemMap).find(i => 
        (i.id === 90) ||
        (i.children && i.children.some(c => c.path === '/gas-station/reporte-resumen-gln-vendidos'))
    );
    if (gasReportsNode && !gasReportsNode.children.some(c => c.path === '/gas-station/reporte-lubricantes-vendidos')) {
        gasReportsNode.children.push({
            id: 'virtual-gas-lubricants-report',
            label: 'Lubricantes Vendidos',
            path: '/gas-station/reporte-lubricantes-vendidos',
            permission: 'view_gas_lubricants_report',
            permission_key: 'view_gas_lubricants_report',
            hideInMenu: false,
            icon: iconMap.Droplets || iconMap.Circle,
            children: []
        });
    }

    // Asegurar Reporte de Complementarias Emitidas en Reportes de Gasolinera
    if (gasReportsNode && !gasReportsNode.children.some(c => c.path === '/gas-station/reporte-complementarias')) {
        gasReportsNode.children.push({
            id: 'virtual-gas-complementarias-report',
            label: 'Complementarias Emitidas',
            path: '/gas-station/reporte-complementarias',
            permission: 'view_gas_complementarias_report',
            permission_key: 'view_gas_complementarias_report',
            hideInMenu: false,
            icon: iconMap.FileCheck || iconMap.Circle,
            children: []
        });
    }

    // Asegurar Reporte Analítico de Ventas y Proyección en Reportes de Gasolinera
    if (gasReportsNode && !gasReportsNode.children.some(c => c.path === '/gas-station/reporte-analitico-ventas')) {
        gasReportsNode.children.push({
            id: 'virtual-gas-ventas-analytics-report',
            label: 'Ventas Analíticas y Proyección',
            path: '/gas-station/reporte-analitico-ventas',
            permission: 'view_gas_ventas_analytics',
            permission_key: 'view_gas_ventas_analytics',
            hideInMenu: false,
            icon: iconMap.TrendingUp || iconMap.Circle,
            children: []
        });
    }

    return roots;
}

export function useMenuItems() {
    const { data: flatItems = [], isLoading } = useQuery({
        queryKey: ['menu-items'],
        queryFn: async () => {
            const res = await axios.get('/api/menu-items?active_only=true');
            return res.data;
        },
        staleTime: 2 * 60 * 1000,
    });

    const tree = useMemo(() => buildTree(flatItems), [flatItems]);

    const topLevelItems = useMemo(() => {
        return tree.filter(item => !item.parent_id && (!item.hide_in_menu && !item.hideInMenu) && item.path);
    }, [tree]);

    const menuConfig = useMemo(() => {
        return tree.filter(item => {
            if (item.parent_id || item.hide_in_menu || item.hideInMenu) return false;
            const hasVisibleChildren = item.children?.some(c => !c.hide_in_menu && !c.hideInMenu);
            return !item.path || hasVisibleChildren;
        });
    }, [tree]);

    return { topLevelItems, menuConfig, flatItems, isLoading };
}

function getRootParent(flatItems, item) {
    let current = item;
    let visited = new Set();
    while (current.parent_id) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        const parent = flatItems.find(i => i.id === current.parent_id);
        if (!parent) break;
        current = parent;
    }
    return current;
}

export const SPECIAL_PERM_KEYS = new Set([
    'regenerate_dte',
    'manage_gas_closeout_reopen',
    'manage_customers_batch_delete',
    'view_amounts',
    'manage_shifts_edit',
    'send_sales_rrs',
    'close_pozo_cortes',
    'ai_assistant_access',
]);

export const SPECIAL_PERM_LABELS = {
    regenerate_dte: 'Regenerar DTEs',
    manage_gas_closeout_reopen: 'Reabrir Cierres de Turno',
    manage_customers_batch_delete: 'Eliminación Masiva de Clientes',
    view_amounts: 'Ver Montos en el Sistema',
    manage_shifts_edit: 'Editar Turnos de Venta',
    send_sales_rrs: 'Enviar Ventas a RRS',
    close_pozo_cortes: 'Cerrar / Reabrir Cortes de Pozo',
    ai_assistant_access: 'Acceso a Asistente Novas AI',
};

export function isSpecialItem(item, key) {
    const permKey = key || item?.permission_key;
    if (permKey && SPECIAL_PERM_KEYS.has(permKey)) return true;
    if (item && item.hide_in_menu && !item.path && item.permission_key) return true;
    return false;
}

export function isReportItem(item, flatItems = []) {
    if (!item) return false;
    if (isSpecialItem(item)) return false;
    const path = (item.path || '').toLowerCase();
    const label = (item.label || '').toLowerCase();
    const key = (item.permission_key || item.id || '').toLowerCase();

    if (
        path.includes('/reportes/') || 
        path.includes('/report/') || 
        path.startsWith('/iva/ventas-') || 
        path.startsWith('/iva/compras') || 
        path.includes('/libro-') || 
        path.includes('galonaje-vendido') || 
        path.includes('reporte-')
    ) {
        return true;
    }
    if (
        label.includes('reporte') || 
        label.includes('libro') || 
        label.includes('informe') || 
        label.includes('balance') || 
        label.includes('estado de resultados') || 
        label.includes('flujo de efectivo') || 
        label.includes('cédula de auditoría') || 
        label.includes('cedula de auditoria') || 
        label.includes('listado de partidas') || 
        label.includes('auxiliar de operaciones') || 
        label.includes('constancia de sueldo') || 
        label.includes('carta de renta')
    ) {
        return true;
    }
    if (
        key.includes('_report') || 
        key.includes('_ledger') || 
        key.includes('_balances') || 
        key.includes('_pending_docs')
    ) {
        return true;
    }
    if (item.parent_id && Array.isArray(flatItems)) {
        const parent = flatItems.find(p => p.id === item.parent_id);
        if (parent && (parent.label || '').toLowerCase().includes('reporte')) {
            return true;
        }
    }
    return false;
}

export function useMenuPermissions() {
    const { data: flatItems = [] } = useQuery({
        queryKey: ['menu-items-all'],
        queryFn: async () => (await axios.get('/api/menu-items')).data,
        staleTime: 30 * 60 * 1000,
    });

    return useMemo(() => {
        const groups = {};
        const seen = {};

        // Identificar raíces conocidas
        const industrialRoot = flatItems.find(i => !i.parent_id && (i.label?.includes('Industrial') || i.label?.includes('Huevo')));
        const crmRoot = flatItems.find(i => !i.parent_id && i.label === 'CRM');

        flatItems.forEach(rawItem => {
            // Clonar para no mutar flatItems
            const item = { ...rawItem };

            // Asegurar que calendario tenga clave de permiso diferenciada
            if (item.path === '/industrial/calendario') {
                item.permission_key = 'manage_production_calendar';
            } else if (item.path === '/crm/configuracion') {
                item.permission_key = 'manage_crm_settings';
            }

            if (!item.permission_key) return;

            let root = getRootParent(flatItems, item);

            // Re-asignar grupo para rutas industriales o CRM si están huérfanas
            if (item.path?.startsWith('/industrial/') && industrialRoot) {
                root = industrialRoot;
            } else if (item.path?.startsWith('/crm/')) {
                root = crmRoot || { id: 'crm-group', label: 'CRM', icon: 'Handshake', sort_order: 130 };
            }

            const groupId = root.id;
            if (!groups[groupId]) {
                groups[groupId] = {
                    id: groupId,
                    label: root.label,
                    icon: root.icon,
                    sort_order: root.sort_order || 0,
                    permissions: [],
                };
            }

            const isSpecial = isSpecialItem(item);
            const isReport = !isSpecial && isReportItem(item, flatItems);
            const label = SPECIAL_PERM_LABELS[item.permission_key] || item.label;

            if (!seen[item.permission_key]) {
                seen[item.permission_key] = true;
                groups[groupId].permissions.push({ 
                    id: item.permission_key, 
                    label: label,
                    isReport: isReport,
                    isSpecial: isSpecial,
                    sort_order: item.sort_order ?? 0
                });
            } else {
                const existingPerm = groups[groupId]?.permissions.find(p => p.id === item.permission_key);
                if (existingPerm) {
                    // Si el ítem actual es una opción normal de menú, prevalece sobre reportes
                    if (!isReport && !isSpecial && existingPerm.isReport) {
                        existingPerm.isReport = false;
                        existingPerm.label = label;
                        existingPerm.sort_order = item.sort_order ?? existingPerm.sort_order;
                    }
                    if (isSpecial) {
                        existingPerm.isSpecial = true;
                        existingPerm.isReport = false;
                    }
                }
            }

            if (item.extra_permissions) {
                let extras = item.extra_permissions;
                if (typeof extras === 'string') {
                    try { extras = JSON.parse(extras); } catch (e) { extras = []; }
                }
                if (Array.isArray(extras)) {
                    extras.forEach(perm => {
                        if (!seen[perm]) {
                            seen[perm] = true;
                            const permLabel = SPECIAL_PERM_LABELS[perm] || `${item.label} (${perm})`;
                            groups[groupId].permissions.push({ 
                                id: perm, 
                                label: permLabel,
                                isReport: false,
                                isSpecial: true,
                                sort_order: (item.sort_order ?? 0) + 100
                            });
                        }
                    });
                }
            }
        });

        // Garantizar que Huevo Industrial contenga Calendario de Producción
        const indGroup = Object.values(groups).find(g => g.label?.includes('Industrial') || g.label?.includes('Huevo'));
        if (indGroup) {
            if (!indGroup.permissions.some(p => p.id === 'manage_production_calendar')) {
                indGroup.permissions.push({ 
                    id: 'manage_production_calendar', 
                    label: 'Calendario de Producción',
                    isReport: false,
                    isSpecial: false,
                    sort_order: 3
                });
                seen['manage_production_calendar'] = true;
            }
        }

        // Garantizar que CRM aparezca como grupo en la asignación de Roles
        let crmGroup = Object.values(groups).find(g => g.label === 'CRM');
        if (!crmGroup) {
            crmGroup = {
                id: 'crm-group',
                label: 'CRM',
                icon: 'Handshake',
                sort_order: 130,
                permissions: []
            };
            groups['crm-group'] = crmGroup;
        }

        if (!crmGroup.permissions.some(p => p.id === 'manage_customer_agreements')) {
            crmGroup.permissions.push({ 
                id: 'manage_customer_agreements', 
                label: 'Acuerdos con Clientes',
                isReport: false,
                isSpecial: false,
                sort_order: 10
            });
            seen['manage_customer_agreements'] = true;
        }

        if (!crmGroup.permissions.some(p => p.id === 'manage_crm_settings')) {
            crmGroup.permissions.push({ 
                id: 'manage_crm_settings', 
                label: 'Configuración de CRM',
                isReport: false,
                isSpecial: false,
                sort_order: 20
            });
            seen['manage_crm_settings'] = true;
        }

        // Jerarquía estricta dentro de cada grupo:
        // 1. Opciones normales del menú
        // 2. Reportes
        // 3. Permisos especiales
        const getPriority = (p) => {
            if (p.isSpecial) return 3;
            if (p.isReport) return 2;
            return 1;
        };

        Object.values(groups).forEach(group => {
            group.permissions.sort((a, b) => {
                const pA = getPriority(a);
                const pB = getPriority(b);
                if (pA !== pB) return pA - pB;
                return (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.label || '').localeCompare(b.label || '');
            });
        });

        return Object.values(groups);
    }, [flatItems]);
}
