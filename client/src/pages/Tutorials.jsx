import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    GraduationCap, Search, FileDown, CheckCircle2, RefreshCcw, Store, Fuel, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { unwrapList } from '../utils/apiUtils';
import { TutorialCard, RoleGuideCards, TutorialDetailModal } from '../components/tutorials';

export default function Tutorials() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const storageKey = `sipe_tutorials_completed_${user?.id || '0'}`;

    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [activeTutorial, setActiveTutorial] = useState(null);
    const [exportingPack, setExportingPack] = useState(false);

    const [completedSlugs, setCompletedSlugs] = useState(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });

    const { data, isLoading } = useQuery({
        queryKey: ['tutorials', user?.id, user?.company_id, user?.role],
        queryFn: async () => (await axios.get('/api/tutorials')).data
    });

    const tutorials = useMemo(() => unwrapList(data?.tutorials), [data]);
    const categories = useMemo(() => unwrapList(data?.categories), [data]);
    const activeRole = data?.userRole || user?.role || 'Usuario';
    const roleGuide = useMemo(
        () => data?.roleGuide || (Array.isArray(data?.roleGuides) ? data.roleGuides[0] : null),
        [data]
    );

    const effectiveCategory = categories.length <= 1 ? 'all' : selectedCategory;

    const filteredTutorials = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tutorials.filter((t) => {
            if (effectiveCategory !== 'all' && t.category !== effectiveCategory) return false;
            if (!q) return true;
            const hay = `${t.title} ${t.summary} ${(t.steps || []).map(s => `${s.title} ${s.description}`).join(' ')}`.toLowerCase();
            return hay.includes(q);
        });
    }, [tutorials, effectiveCategory, search]);

    const completedCount = useMemo(
        () => tutorials.filter(t => completedSlugs.includes(t.slug)).length,
        [tutorials, completedSlugs]
    );

    const handleToggleComplete = (slug) => {
        setCompletedSlugs((prev) => {
            const exists = prev.includes(slug);
            const next = exists ? prev.filter(s => s !== slug) : [...prev, slug];
            try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const handleDownloadSinglePdf = async (tutorial) => {
        try {
            const res = await axios.get(`/api/tutorials/${tutorial.slug}/pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al generar el PDF del tutorial');
        }
    };

    const handleDownloadPackPdf = async () => {
        setExportingPack(true);
        try {
            const params = new URLSearchParams({
                category: effectiveCategory
            });
            const res = await axios.get(`/api/tutorials/pack/pdf?${params.toString()}`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo generar el manual completo PDF');
        } finally {
            setExportingPack(false);
        }
    };

    const progressPct = tutorials.length > 0 ? Math.round((completedCount / tutorials.length) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Encabezado y Progreso */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-2xl shadow-sm shrink-0">
                        <GraduationCap size={24} />
                    </div>
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                                Centro de Tutoriales Operativos
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                Rol activo: {activeRole}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            Guías paso a paso exclusivas para tu rol activo ({activeRole}) con capturas reales del sistema y manual descargable en PDF.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 min-w-[175px]">
                        <div className="flex items-center justify-between font-bold text-slate-700">
                            <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-600" /> Progreso</span>
                            <span>{completedCount}/{tutorials.length}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadPackPdf}
                        disabled={exportingPack || filteredTutorials.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        {exportingPack ? <RefreshCcw size={14} className="animate-spin" /> : <FileDown size={14} />}
                        <span>Descargar Manual PDF ({filteredTutorials.length})</span>
                    </button>
                </div>
            </div>

            {/* Tarjeta exclusiva del Rol Conectado */}
            <RoleGuideCards
                roleGuide={roleGuide}
                tutorials={tutorials}
            />

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {categories.length > 1 ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                                    effectiveCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Layers size={13} />
                                <span>Todos ({tutorials.length})</span>
                            </button>
                            {categories.map((c) => {
                                const Icon = c.id === 'pista' ? Fuel : Store;
                                const cnt = tutorials.filter(t => t.category === c.id).length;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(c.id)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                                            effectiveCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <Icon size={13} />
                                        <span>{c.label} ({cnt})</span>
                                    </button>
                                );
                            })}
                        </>
                    ) : categories.length === 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-xs font-bold">
                            {categories[0].id === 'pista' ? <Fuel size={13} /> : <Store size={13} />}
                            <span>{categories[0].label} ({tutorials.length})</span>
                        </span>
                    ) : null}
                </div>

                <div className="relative w-full md:w-80">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar tutorial por tema o paso..."
                        className="w-full pl-9 pr-3 py-2 text-[13px] font-medium rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Grilla de Tutoriales */}
            {isLoading ? (
                <div className="py-16 text-center space-y-2 text-slate-500">
                    <RefreshCcw size={26} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold">Cargando tutoriales de tu rol...</p>
                </div>
            ) : filteredTutorials.length === 0 ? (
                <div className="py-14 bg-white rounded-3xl border border-slate-200 text-center space-y-2 px-4">
                    <p className="text-sm font-bold text-slate-700">
                        {tutorials.length === 0
                            ? `Aún no hay tutoriales operativos asignados al rol ${activeRole}.`
                            : 'No se encontraron tutoriales con esos filtros'}
                    </p>
                    {tutorials.length > 0 && (
                        <button
                            type="button"
                            onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                            className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                            Restablecer filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTutorials.map((tut) => (
                        <TutorialCard
                            key={tut.slug}
                            tutorial={tut}
                            completed={completedSlugs.includes(tut.slug)}
                            onOpen={(t) => setActiveTutorial(t)}
                            onDownloadPdf={handleDownloadSinglePdf}
                        />
                    ))}
                </div>
            )}

            <TutorialDetailModal
                isOpen={Boolean(activeTutorial)}
                onClose={() => setActiveTutorial(null)}
                tutorial={activeTutorial}
                isCompleted={Boolean(activeTutorial && completedSlugs.includes(activeTutorial.slug))}
                onToggleComplete={handleToggleComplete}
                onDownloadPdf={handleDownloadSinglePdf}
                onNavigateModule={(routePath) => {
                    setActiveTutorial(null);
                    navigate(routePath);
                }}
            />
        </div>
    );
}
