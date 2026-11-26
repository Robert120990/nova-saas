import { UserCheck, Store, Fuel, Shield, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

const ROLE_ICON_MAP = {
    Vendedor: UserCheck,
    'Jefe Tienda': Store,
    'Jefe Pista': Fuel,
    SuperAdmin: Shield,
    Admin: Shield,
    Supervisor: Shield,
    Gerencia: Shield
};

const COLOR_MAP = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700'
};

const FEATURED_ROLES = ['Vendedor', 'Jefe Tienda', 'Jefe Pista'];

function countForRole(tutorials, roleName) {
    const key = String(roleName || '').toLowerCase();
    return (Array.isArray(tutorials) ? tutorials : []).filter(
        t => t.isUniversal || (Array.isArray(t.roles) && t.roles.some(r => String(r).toLowerCase() === key))
    ).length;
}

export default function RoleGuideCards({
    isSuperAdmin = false,
    roleGuide,
    roleGuides = [],
    tutorials = [],
    selectedRole = 'all',
    onSelectRole
}) {
    const guide = roleGuide || (Array.isArray(roleGuides) ? roleGuides[0] : null);
    if (!guide) return null;

    const Icon = ROLE_ICON_MAP[guide.role] || UserCheck;
    const count = Array.isArray(tutorials) ? tutorials.length : 0;
    const highlights = Array.isArray(guide.highlights) ? guide.highlights : [];

    if (!isSuperAdmin) {
        return (
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className={`p-2.5 rounded-2xl border shrink-0 ${COLOR_MAP[guide.color] || COLOR_MAP.indigo}`}>
                            <Icon size={20} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-900">
                                    {guide.role}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wide">
                                    Tu Rol Conectado
                                </span>
                                {guide.badge && (
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                                        · {guide.badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                {guide.summary}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-black">
                            {count} {count === 1 ? 'guía disponible' : 'guías disponibles'}
                        </span>
                    </div>
                </div>

                {highlights.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
                        {highlights.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-xs text-slate-700 leading-relaxed"
                            >
                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const featured = (Array.isArray(roleGuides) ? roleGuides : []).filter(g => FEATURED_ROLES.includes(g.role));
    const secondary = (Array.isArray(roleGuides) ? roleGuides : []).filter(g => !FEATURED_ROLES.includes(g.role));

    return (
        <div className="space-y-3">
            <div className="bg-white p-4 rounded-3xl border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-2xl border bg-indigo-50 border-indigo-200 text-indigo-700 shrink-0">
                        <Shield size={20} />
                    </div>
                    <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-900">Acceso Total (SuperAdmin)</h3>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase">
                                {count} guías en total
                            </span>
                        </div>
                        <p className="text-xs text-slate-600">
                            Visualizas todos los tutoriales del sistema. Selecciona cualquier rol si deseas previsualizar sus guías o exportar su manual.
                        </p>
                    </div>
                </div>

                {selectedRole !== 'all' && (
                    <button
                        type="button"
                        onClick={() => onSelectRole?.('all')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shrink-0 self-start sm:self-center"
                    >
                        <Layers size={13} />
                        <span>Ver Todos ({count})</span>
                    </button>
                )}
            </div>

            {featured.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {featured.map((g) => {
                        const RIcon = ROLE_ICON_MAP[g.role] || UserCheck;
                        const isSelected = selectedRole === g.role;
                        const roleCount = countForRole(tutorials, g.role);
                        return (
                            <button
                                key={g.role}
                                type="button"
                                onClick={() => onSelectRole?.(isSelected ? 'all' : g.role)}
                                className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                        : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
                                }`}
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-xl border ${isSelected ? 'bg-white/15 border-white/20 text-white' : (COLOR_MAP[g.color] || COLOR_MAP.indigo)}`}>
                                                <RIcon size={15} />
                                            </div>
                                            <div>
                                                <div className={`text-sm font-extrabold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{g.role}</div>
                                                <div className={`text-[10px] font-bold uppercase ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>{g.badge}</div>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${isSelected ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {roleCount} guías
                                        </span>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${isSelected ? 'text-indigo-50' : 'text-slate-600'}`}>{g.summary}</p>
                                </div>
                                <div className={`flex items-center justify-between text-[11px] font-bold pt-2 border-t ${isSelected ? 'border-white/20 text-white' : 'border-slate-100 text-indigo-600'}`}>
                                    <span>{isSelected ? 'Mostrando este rol (clic para quitar)' : 'Previsualizar guías del rol'}</span>
                                    <ChevronRight size={13} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {secondary.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Otros roles:</span>
                    {secondary.map((g) => {
                        const isSelected = selectedRole === g.role;
                        const roleCount = countForRole(tutorials, g.role);
                        return (
                            <button
                                key={g.role}
                                type="button"
                                onClick={() => onSelectRole?.(isSelected ? 'all' : g.role)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                }`}
                            >
                                {g.role} ({roleCount})
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
