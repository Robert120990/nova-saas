export const LBS_TO_KG = 0.453592;

export const REASON_OPTIONS = [
    {
        value: 'venta_factura',
        label: 'Venta Directa (Factura)',
        shortLabel: 'Venta / Factura',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
        value: 'merma_dano',
        label: 'Merma / Daño / Quebrado',
        shortLabel: 'Merma / Daño',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    {
        value: 'donacion',
        label: 'Donación / Muestra',
        shortLabel: 'Donación',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
        value: 'ajuste_inventario',
        label: 'Ajuste de Inventario',
        shortLabel: 'Ajuste Inv.',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
        value: 'otro',
        label: 'Otro Motivo No Productivo',
        shortLabel: 'Otro',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    }
];

export const REASON_MAP = REASON_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = opt;
    return acc;
}, {});

export const LOT_STATUS_STYLES = {
    aprobado: { label: 'Aprobado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pendiente_aprobacion: { label: 'Pendiente Calidad', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    rechazado: { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    cuarentena: { label: 'Cuarentena', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
};

export const formatLbs = (val) => {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

export const lbsToKg = (val) => {
    const n = (parseFloat(val) || 0) * LBS_TO_KG;
    return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};
