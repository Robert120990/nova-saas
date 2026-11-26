import {
    UserCheck, Store, Fuel, Shield, ShoppingBag, Package,
    Wallet, Calculator, Users, Factory, Wrench, Briefcase,
    ClipboardCheck, Layers
} from 'lucide-react';

export const CATEGORY_META = {
    all: {
        label: 'Todos',
        icon: Layers,
        badgeClass: 'bg-slate-800 text-white'
    },
    tienda: {
        label: 'Tienda y POS',
        icon: Store,
        badgeClass: 'bg-indigo-600/95 text-white'
    },
    pista: {
        label: 'Pista / Gasolinera',
        icon: Fuel,
        badgeClass: 'bg-amber-500/95 text-white'
    },
    compras: {
        label: 'Compras y Gastos',
        icon: ShoppingBag,
        badgeClass: 'bg-sky-600/95 text-white'
    },
    inventario: {
        label: 'Inventario y Bodega',
        icon: Package,
        badgeClass: 'bg-teal-600/95 text-white'
    },
    finanzas: {
        label: 'Cuentas por Cobrar y Pagar',
        icon: Wallet,
        badgeClass: 'bg-emerald-600/95 text-white'
    },
    contabilidad: {
        label: 'Contabilidad e IVA',
        icon: Calculator,
        badgeClass: 'bg-violet-600/95 text-white'
    },
    rrhh: {
        label: 'Recursos Humanos',
        icon: Users,
        badgeClass: 'bg-rose-600/95 text-white'
    },
    industrial: {
        label: 'Planta Industrial y CRM',
        icon: Factory,
        badgeClass: 'bg-cyan-600/95 text-white'
    },
    operaciones_admin: {
        label: 'Pozo, Seguridad y Soporte',
        icon: Wrench,
        badgeClass: 'bg-slate-700/95 text-white'
    }
};

export const ROLE_ICON_MAP = {
    Vendedor: UserCheck,
    'Jefe Tienda': Store,
    'Jefe Pista': Fuel,
    SuperAdmin: Shield,
    Admin: Shield,
    Supervisor: Shield,
    Gerencia: Briefcase,
    Contador: Calculator,
    Auxiliar: ClipboardCheck,
    Asistente: ClipboardCheck,
    Auditor: Shield,
    Operaciones: Briefcase,
    Bodega: Package,
    Produccion: Factory,
    Calidad: ClipboardCheck
};

export const ROLE_COLOR_MAP = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    slate: 'bg-slate-100 border-slate-300 text-slate-700'
};
