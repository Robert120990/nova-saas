import { UserCheck, Store, Fuel, ChevronRight } from 'lucide-react';

const ROLE_ICON_MAP = {
    Vendedor: UserCheck,
    'Jefe Tienda': Store,
    'Jefe Pista': Fuel
};

const COLOR_MAP = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800'
};

export default function RoleGuideCards({
    roleGuides = [],
    tutorials = [],
    selectedRole,
    activeUserRole,
    onSelectRole
}) {
    const guides = Array.isArray(roleGuides) ? roleGuides : [];
    if (guides.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {guides.map((guide) => {
                const Icon = ROLE_ICON_MAP[guide.role] || UserCheck;
                const isSelected = selectedRole === guide.role;
                const isMyRole = String(activeUserRole || '').toLowerCase() === String(guide.role).toLowerCase();
                const count = (Array.isArray(tutorials) ? tutorials : []).filter(
                    t => Array.isArray(t.roles) && t.roles.includes(guide.role)
                ).length;

                return (
                    <button
                        key={guide.role}
                        type="button"
                        onClick={() => onSelectRole(isSelected ? 'all' : guide.role)}
                        className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                            isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
                        }`}
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`p-2 rounded-xl border ${
                                            isSelected
                                                ? 'bg-white/15 border-white/20 text-white'
                                                : (COLOR_MAP[guide.color] || COLOR_MAP.indigo)
                                        }`}
                                    >
                                        <Icon size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-sm font-extrabold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                {guide.role}
                                            </span>
                                            {isMyRole && (
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                                                    }`}
                                                >
                                                    Tu Rol
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                            {guide.badge}
                                        </span>
                                    </div>
                                </div>

                                <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                        isSelected ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-700'
                                    }`}
                                >
                                    {count} guías
                                </span>
                            </div>

                            <p className={`text-xs leading-relaxed ${isSelected ? 'text-indigo-50' : 'text-slate-600'}`}>
                                {guide.summary}
                            </p>
                        </div>

                        <div className={`flex items-center justify-between text-[11px] font-bold pt-2 border-t ${isSelected ? 'border-white/20 text-white' : 'border-slate-100 text-indigo-600'}`}>
                            <span>{isSelected ? 'Mostrando solo este rol (clic para quitar)' : 'Filtrar guías de este rol'}</span>
                            <ChevronRight size={14} />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
