import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Ticket, Camera, Eye, Image as ImageIcon, CheckCircle2,
    Clock, AlertCircle, Lock, Sparkles, Keyboard, Bot
} from 'lucide-react';
import { toast } from 'sonner';
import { useTickets } from '../context/TicketContext';
import { unwrapList, unwrapPagination } from '../utils/apiUtils';
import { formatDateTime } from '../utils/dateUtils';
import Pagination from '../components/ui/Pagination';
import { TicketSummaryCards, TicketFiltersBar, TicketAiBundleModal } from '../components/tickets';

const STATUS_CONFIG = {
    abierto: { label: 'Abierto', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
    en_proceso: { label: 'En Proceso', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: Clock },
    resuelto: { label: 'Resuelto', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cerrado: { label: 'Cerrado', badge: 'bg-slate-100 text-slate-600 border-slate-200', icon: Lock }
};

const PRIORITY_BADGES = {
    baja: 'bg-slate-100 text-slate-600 border-slate-200',
    media: 'bg-amber-50 text-amber-700 border-amber-200',
    alta: 'bg-orange-50 text-orange-700 border-orange-200',
    urgente: 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold'
};

const TYPE_LABELS = {
    problema: 'Problema / Error',
    requerimiento: 'Requerimiento',
    mejora: 'Mejora',
    consulta: 'Consulta'
};

const SupportTickets = () => {
    const queryClient = useQueryClient();
    const { openQuickTicket, openTicketDetail, canManageTickets } = useTickets();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [priority, setPriority] = useState('');
    const [mineOnly, setMineOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [aiBundleOpen, setAiBundleOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: statsData = {} } = useQuery({
        queryKey: ['support-tickets-stats'],
        queryFn: async () => {
            const res = await axios.get('/api/tickets/stats');
            return res.data?.data || {};
        }
    });

    const { data: ticketsResponse, isLoading } = useQuery({
        queryKey: ['support-tickets', debouncedSearch, page, limit, status, type, priority, mineOnly],
        queryFn: async () => {
            const res = await axios.get('/api/tickets', {
                params: {
                    search: debouncedSearch,
                    page,
                    limit,
                    status: status || undefined,
                    type: type || undefined,
                    priority: priority || undefined,
                    mine: mineOnly ? 'true' : undefined
                }
            });
            return {
                items: unwrapList(res),
                pagination: unwrapPagination(res)
            };
        }
    });

    const toggleAiMutation = useMutation({
        mutationFn: ({ id, nextVal }) => axios.put(`/api/tickets/${id}/ai-review`, { include_in_ai_prompt: nextVal }),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            toast.success(vars.nextVal ? 'Ticket agregado al paquete para IA' : 'Ticket retirado del paquete para IA');
        },
        onError: () => toast.error('No se pudo actualizar la selección para IA')
    });

    const tickets = Array.isArray(ticketsResponse?.items) ? ticketsResponse.items : [];
    const pagination = ticketsResponse?.pagination || { total: 0, page: 1, totalPages: 1 };
    const aiSelectedCount = Number(statsData?.seleccionados_ia || 0);

    const handleResetFilters = () => {
        setSearch('');
        setDebouncedSearch('');
        setStatus('');
        setType('');
        setPriority('');
        setMineOnly(false);
        setPage(1);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 shrink-0">
                        <Ticket size={22} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                                Centro de Soporte y Tickets
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Sparkles size={11} /> Conectado a Telegram
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Reporta problemas o requerimientos con captura WebP anotada. Selecciona tickets técnicos y empaca el prompt para resolución con IA.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                        <Keyboard size={14} className="text-indigo-500" />
                        <span>Atajo:</span>
                        <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] font-bold text-slate-800">Ctrl+K</kbd>
                        <span>→ <strong className="text-indigo-600">ticket</strong></span>
                    </div>

                    {canManageTickets && (
                        <button
                            type="button"
                            onClick={() => setAiBundleOpen(true)}
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer w-full sm:w-auto"
                        >
                            <Bot size={15} className="text-indigo-400" />
                            <span>Empaquetar Prompt IA</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                {aiSelectedCount}
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => openQuickTicket({ autoCapture: true })}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 w-full sm:w-auto"
                    >
                        <Camera size={15} />
                        <span>Nuevo Ticket con Captura</span>
                    </button>
                </div>
            </div>

            <TicketSummaryCards
                stats={statsData}
                activeStatus={status}
                onSelectStatus={(s) => {
                    setStatus((prev) => (prev === s ? '' : s));
                    setPage(1);
                }}
            />

            <TicketFiltersBar
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={(v) => { setStatus(v); setPage(1); }}
                type={type}
                onTypeChange={(v) => { setType(v); setPage(1); }}
                priority={priority}
                onPriorityChange={(v) => { setPriority(v); setPage(1); }}
                mineOnly={mineOnly}
                onMineOnlyChange={(v) => { setMineOnly(v); setPage(1); }}
                canManage={canManageTickets}
                onReset={handleResetFilters}
            />

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3.5 px-4">Código</th>
                                <th className="py-3.5 px-4">Asunto / Módulo</th>
                                <th className="py-3.5 px-4">Tipo</th>
                                <th className="py-3.5 px-4">Prioridad</th>
                                <th className="py-3.5 px-4">Solicitante</th>
                                <th className="py-3.5 px-4">Estado</th>
                                <th className="py-3.5 px-4">Fecha</th>
                                <th className="py-3.5 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[13px]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-medium">
                                        Cargando listado de tickets...
                                    </td>
                                </tr>
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center">
                                        <Ticket size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-sm font-bold text-slate-600">No se encontraron tickets de soporte</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Usa el botón &ldquo;Nuevo Ticket con Captura&rdquo; o presiona Ctrl + K y escribe &ldquo;ticket&rdquo;.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                (Array.isArray(tickets) ? tickets : []).map((t) => {
                                    const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.abierto;
                                    const StIcon = st.icon;
                                    const inAi = Boolean(t.include_in_ai_prompt);
                                    return (
                                        <tr
                                            key={t.id}
                                            onClick={() => openTicketDetail(t.id)}
                                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${inAi ? 'bg-indigo-50/30' : ''}`}
                                        >
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                        {t.code}
                                                    </span>
                                                    {t.screenshot_url && (
                                                        <ImageIcon size={14} className="text-slate-400" title="Contiene captura de pantalla WebP" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 max-w-xs sm:max-w-md">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-bold text-slate-800 truncate">{t.subject}</p>
                                                    {t.diagnostic_relevance === 'alta' && (
                                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200" title="El diagnóstico automático detectó un error en navegador/servidor directamente relacionado">
                                                            Error Log {t.diagnostic_score ? `${t.diagnostic_score}%` : ''}
                                                        </span>
                                                    )}
                                                    {t.diagnostic_relevance === 'media' && (
                                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title="Posible error en consola/red vinculado">
                                                            Log {t.diagnostic_score ? `${t.diagnostic_score}%` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-400 font-medium block truncate">
                                                    {t.module_name || 'General'} {t.company_name ? `· ${t.company_name}` : ''}
                                                    {t.ai_notes ? ` · 🎯 Nota IA: "${t.ai_notes}"` : ''}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className="text-xs font-semibold text-slate-600">{TYPE_LABELS[t.type] || t.type}</span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_BADGES[t.priority] || ''}`}>
                                                    {t.priority}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700 text-xs">{t.creator_name || t.creator_username}</span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.badge}`}>
                                                    <StIcon size={12} />
                                                    <span>{st.label}</span>
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                                                {formatDateTime(t.created_at)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="inline-flex items-center gap-1.5">
                                                    {canManageTickets && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAiMutation.mutate({ id: t.id, nextVal: !inAi })}
                                                            title={inAi ? 'Incluido en el paquete de prompt para IA (clic para quitar)' : 'Incluir este ticket en el paquete de prompt para IA'}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                                                inAi
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                    : 'bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-slate-200'
                                                            }`}
                                                        >
                                                            <Bot size={13} />
                                                            <span>{inAi ? 'En IA ✓' : 'IA'}</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openTicketDetail(t.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 text-xs font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Detalle</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={pagination.page || page}
                    totalPages={pagination.totalPages || 1}
                    totalItems={pagination.total || 0}
                    itemsOnPage={tickets.length}
                    limit={limit}
                    onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                    onPageChange={setPage}
                    isLoading={isLoading}
                />
            </div>

            <TicketAiBundleModal
                open={aiBundleOpen}
                onClose={() => setAiBundleOpen(false)}
            />
        </div>
    );
};

export default SupportTickets;
