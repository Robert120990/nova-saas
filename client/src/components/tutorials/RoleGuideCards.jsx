import { UserCheck, CheckCircle2 } from 'lucide-react';
import { ROLE_ICON_MAP, ROLE_COLOR_MAP } from './tutorialMeta';

export default function RoleGuideCards({
    roleGuide,
    roleGuides = [],
    tutorials = []
}) {
    const guide = roleGuide || (Array.isArray(roleGuides) ? roleGuides[0] : null);
    if (!guide) return null;

    const Icon = ROLE_ICON_MAP[guide.role] || UserCheck;
    const count = Array.isArray(tutorials) ? tutorials.length : 0;
    const highlights = Array.isArray(guide.highlights) ? guide.highlights : [];

    return (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-2.5 rounded-2xl border shrink-0 ${ROLE_COLOR_MAP[guide.color] || ROLE_COLOR_MAP.indigo}`}>
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
