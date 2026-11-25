import { useState } from 'react';
import { PlayCircle, FileDown, Clock, CheckCircle2, Layers } from 'lucide-react';

export default function TutorialCard({
    tutorial,
    completed = false,
    onOpen,
    onDownloadPdf
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const isPista = tutorial.category === 'pista';
    const roles = Array.isArray(tutorial.roles) ? tutorial.roles : [];
    const stepsCount = Array.isArray(tutorial.steps) ? tutorial.steps.length : 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col overflow-hidden group">
            <div
                onClick={() => onOpen(tutorial)}
                className="relative aspect-[1480/880] bg-slate-100 overflow-hidden border-b border-slate-100 cursor-pointer"
            >
                {tutorial.coverImage && !imgFailed ? (
                    <img
                        src={`/tutorials/${tutorial.coverImage}`}
                        alt={tutorial.title}
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                        Vista previa
                    </div>
                )}

                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-900/85 text-white text-[10px] font-black">
                        #{tutorial.order}
                    </span>
                    <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide ${
                            isPista
                                ? 'bg-amber-500/95 text-white'
                                : 'bg-indigo-600/95 text-white'
                        }`}
                    >
                        {tutorial.categoryLabel}
                    </span>
                </div>

                {completed && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shadow">
                        <CheckCircle2 size={11} />
                        <span>Visto</span>
                    </span>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                    <h3
                        onClick={() => onOpen(tutorial)}
                        className="text-sm font-bold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                        {tutorial.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {tutorial.summary}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-0.5">
                        {roles.slice(0, 4).map((r) => (
                            <span
                                key={r}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold"
                            >
                                {r}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <Layers size={12} className="text-indigo-500" />
                            {stepsCount} pasos
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {tutorial.duration}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onDownloadPdf(tutorial)}
                            title="Descargar tutorial en PDF"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-bold cursor-pointer"
                        >
                            <FileDown size={12} />
                            <span>PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpen(tutorial)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                            <PlayCircle size={12} />
                            <span>Ver Guía</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
