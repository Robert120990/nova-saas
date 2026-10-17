export const AGENT_BADGES = {
    supervisor: { name: 'Supervisor', icon: '👑', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    dte: { name: 'Fiscal DTE', icon: '⚡', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    accounting: { name: 'Contador CPA', icon: '⚖️', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    inventory: { name: 'Inventario', icon: '📦', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    gas: { name: 'Combustibles', icon: '⛽', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    sales: { name: 'Ventas', icon: '📈', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    tech: { name: 'SysAdmin', icon: '🛠️', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    support: { name: 'Soporte & Tickets', icon: '🎫', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
};

export const PRIORITY_STYLES = {
    alta: { cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },
    media: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    baja: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
};

export const OUTPUT_TYPES = {
    texto: { id: 'texto', label: 'Texto / Markdown', icon: '📝', desc: 'Resumen ejecutivo y tablas en pantalla', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    pdf: { id: 'pdf', label: 'PDF Oficial', icon: '📄', desc: 'Formato contable membretado oficial', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    excel: { id: 'excel', label: 'Excel (.xlsx)', icon: '📊', desc: 'Libro de cálculo estructurado descargable', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    imagen: { id: 'imagen', label: 'Gráfico / Imagen', icon: '🖼️', desc: 'Infografía visual de curvas y KPIs', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
};
