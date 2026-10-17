import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { unwrapList } from '../utils/apiUtils';
import { toast } from 'sonner';
import { formatDateTime } from '../utils/dateUtils';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import PdfViewerModal from '../components/ui/PdfViewerModal';
import {
    AiTaskSummaryCards,
    AiTaskFiltersBar,
    AiTaskCreateModal,
    AiTaskDetailModal,
    AiTaskOutputPreview,
    AiTaskEditModal,
    AGENT_BADGES,
    PRIORITY_STYLES,
    getTaskActivityMeta
} from '../components/aiTasks';
import {
    Bot,
    Eye,
    RotateCcw,
    Loader2,
    Clock,
    AlertTriangle,
    Pencil,
    Copy
} from 'lucide-react';

const AiAgentTasks = () => {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('todos');
    const [priority, setPriority] = useState('todas');
    const [agentCode, setAgentCode] = useState('todos');
    const [page, setPage] = useState(1);
    const limit = 12;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [selectedTab, setSelectedTab] = useState('logs');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfOpen, setIsPdfOpen] = useState(false);

    const handleOpenEdit = (task) => { setTaskToEdit(task); setIsEditModalOpen(true); };
    const handleOpenPdf = (url) => { setPdfUrl(url); setIsPdfOpen(true); };

    const { data: responseData, isLoading } = useQuery({
        queryKey: ['agent-tasks', search, status, priority, agentCode, page],
        queryFn: async () => {
            const res = await axios.get('/api/agent-tasks', {
                params: { search, status, priority, agent_code: agentCode, page, limit }
            });
            return res.data;
        },
        refetchInterval: (query) => {
            const items = query.state.data?.data || [];
            const hasActive = items.some(t => ['analizando', 'en_proceso', 'pendiente'].includes(t.status) && t.execution_mode !== 'agent_prompt');
            return hasActive ? 3000 : false;
        }
    });

    const tasks = useMemo(() => unwrapList(responseData) || [], [responseData]);
    const pagination = responseData?.pagination || { totalPages: 1, total: 0 };
    const summary = responseData?.summary || {};

    const handleOpenDetail = (taskId, tab = 'logs') => {
        setSelectedTaskId(taskId);
        setSelectedTab(tab);
        setIsDetailModalOpen(true);
    };

    const handleResetFilters = () => {
        setSearch(''); setStatus('todos'); setPriority('todas'); setAgentCode('todos'); setPage(1);
    };

    const handleTaskSuccess = () => { queryClient.invalidateQueries({ queryKey: ['agent-tasks'] }); };

    const handleRetryTask = async (taskId) => {
        try {
            await axios.post(`/api/agent-tasks/${taskId}/retry`);
            toast.success('Tarea actualizada / reencolada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al reintentar la tarea');
        }
    };

    const handleCopyTaskPrompt = (item, meta) => {
        const textToCopy = item.result || `${item.title}\n\n${item.prompt}${item.custom_logs ? `\n\nLogs:\n${item.custom_logs}` : ''}`;
        navigator.clipboard.writeText(textToCopy);
        toast.success(`Prompt + Logs copiados para ${meta.platform.name}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                            <span>Tareas Agénticas</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                Modo 1 API · Modo 2 Prompt + Logs
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">
                            Ejecución autónoma por API Interna o generación de Prompts + Logs para Antigravity, Cursor y Claude Code
                        </p>
                    </div>
                </div>
            </div>

            <AiTaskSummaryCards summary={summary} />

            <AiTaskFiltersBar
                search={search}
                onSearchChange={(val) => { setSearch(val); setPage(1); }}
                status={status}
                onStatusChange={(val) => { setStatus(val); setPage(1); }}
                priority={priority}
                onPriorityChange={(val) => { setPriority(val); setPage(1); }}
                agentCode={agentCode}
                onAgentCodeChange={(val) => { setAgentCode(val); setPage(1); }}
                onOpenNewTask={() => setIsCreateModalOpen(true)}
                onResetFilters={handleResetFilters}
            />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Tarea / Objetivo', 'Prioridad', 'Agente y Modo IA', 'Progreso, Estado y Acción Humana', 'Solicitado', 'Acciones']}
                    data={tasks}
                    isLoading={isLoading}
                    renderRow={(item) => {
                        const agent = AGENT_BADGES[item.assigned_agent_code] || AGENT_BADGES.supervisor;
                        const pStyle = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.media;
                        const meta = getTaskActivityMeta(item);
                        const isRunning = ['analizando', 'en_proceso', 'pendiente'].includes(item.status) && meta.execMode !== 'agent_prompt';

                        return (
                            <tr
                                key={item.id}
                                className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                onClick={() => handleOpenDetail(item.id)}
                            >
                                <td className="px-3.5 py-3 max-w-sm sm:max-w-md">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-indigo-600">#{item.id}</span>
                                        <span className="font-bold text-xs text-slate-900 truncate block">{item.title}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">{item.prompt}</p>
                                    <AiTaskOutputPreview
                                        result={item.result}
                                        outputType={item.output_type}
                                        outputFileUrl={item.output_file_url}
                                        onOpenDetail={() => handleOpenDetail(item.id, 'result')}
                                        onOpenPdf={handleOpenPdf}
                                    />
                                    {item.status === 'fallida' && item.error_message && (
                                        <div className="mt-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 flex items-center gap-1.5 font-medium">
                                            <AlertTriangle size={12} className="shrink-0 text-rose-500" />
                                            <span className="line-clamp-1">{item.error_message}</span>
                                        </div>
                                    )}
                                </td>

                                <td className="px-3 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${pStyle.cls}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
                                        {item.priority}
                                    </span>
                                </td>

                                <td className="px-3 py-3 whitespace-nowrap space-y-1">
                                    <div>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-bold border ${agent.cls}`}>
                                            <span>{agent.icon}</span>
                                            <span>{agent.name}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.modeBadge.cls}`}>
                                            <span>{meta.modeBadge.icon}</span>
                                            <span>{meta.modeBadge.label}</span>
                                        </span>
                                        {meta.hasCustomLogs && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-emerald-300">
                                                📎 Logs
                                            </span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-3 py-3 min-w-[230px] max-w-[270px]">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.statusBadge.cls}`}>
                                            <span>{meta.statusBadge.icon}</span>
                                            <span>{meta.statusBadge.label}</span>
                                        </span>
                                        <span className="font-mono text-xs font-black text-slate-800">{meta.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1.5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                item.status === 'completada' ? 'bg-emerald-500' :
                                                item.status === 'fallida' ? 'bg-rose-500' : 'bg-indigo-600'
                                            }`}
                                            style={{ width: `${meta.progress}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium truncate mb-1" title={item.current_step || item.status}>
                                        {isRunning && <Loader2 size={10} className="inline animate-spin text-indigo-600 mr-1" />}
                                        {item.current_step || item.status}
                                    </div>
                                    <div
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.humanCls}`}
                                        title={meta.humanDetail}
                                    >
                                        <span>{meta.humanBadge}</span>
                                    </div>
                                </td>

                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="text-[11px] font-medium text-slate-800">{item.user_name || 'Usuario'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                        <Clock size={10} />
                                        <span>{formatDateTime(item.created_at)}</span>
                                    </div>
                                </td>

                                <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleOpenDetail(item.id)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Ver bitácora y reporte">
                                            <Eye size={16} />
                                        </button>
                                        {meta.execMode === 'agent_prompt' && (
                                            <button onClick={() => handleCopyTaskPrompt(item, meta)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-xl transition-all" title={`Copiar Prompt + Logs para ${meta.platform.name}`}>
                                                <Copy size={15} />
                                            </button>
                                        )}
                                        {!isRunning && (
                                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Configurar Modo IA / Cargar Logs">
                                                <Pencil size={15} />
                                            </button>
                                        )}
                                        {!isRunning && (
                                            <button onClick={() => handleRetryTask(item.id)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title={meta.execMode === 'agent_prompt' ? 'Regenerar paquete de Prompt + Logs' : 'Reejecutar por API Interna'}>
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                    renderCard={(item) => {
                        const agent = AGENT_BADGES[item.assigned_agent_code] || AGENT_BADGES.supervisor;
                        const pStyle = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.media;
                        const meta = getTaskActivityMeta(item);
                        const isRunning = ['analizando', 'en_proceso', 'pendiente'].includes(item.status) && meta.execMode !== 'agent_prompt';

                        return (
                            <div className="space-y-2.5" onClick={() => handleOpenDetail(item.id)}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold text-indigo-600">#{item.id}</span>
                                            <span className="font-bold text-xs text-slate-900 truncate block">{item.title}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.prompt}</p>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${pStyle.cls}`}>
                                        {item.priority}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pt-1 border-t border-slate-100">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${agent.cls}`}>{agent.icon} {agent.name}</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.statusBadge.cls}`}>{meta.statusBadge.icon} {meta.statusBadge.label} ({meta.progress}%)</span>
                                </div>

                                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${meta.humanCls}`}>
                                    {meta.humanBadge} · <span className="font-medium">{meta.humanDetail}</span>
                                </div>

                                <AiTaskOutputPreview result={item.result} outputType={item.output_type} outputFileUrl={item.output_file_url} onOpenDetail={() => handleOpenDetail(item.id, 'result')} onOpenPdf={handleOpenPdf} />

                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                                    <span>{formatDateTime(item.created_at)}</span>
                                    {!isRunning && (
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }} className="font-bold text-amber-600 hover:text-amber-800">Editar</button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleRetryTask(item.id); }} className="font-bold text-indigo-600 hover:text-indigo-800">{item.status === 'completada' ? 'Reejecutar' : 'Reintentar'}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }}
                />

                {pagination.totalPages > 1 && (
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                        <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={(p) => setPage(p)} />
                    </div>
                )}
            </div>

            <AiTaskCreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={handleTaskSuccess} />
            <AiTaskEditModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setTaskToEdit(null); }} task={taskToEdit} onSuccess={handleTaskSuccess} />
            <AiTaskDetailModal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedTaskId(null); }} taskId={selectedTaskId} initialTab={selectedTab} onTaskUpdated={handleTaskSuccess} onEdit={(task) => { setIsDetailModalOpen(false); handleOpenEdit(task); }} onOpenPdf={handleOpenPdf} />
            <PdfViewerModal isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} pdfUrl={pdfUrl} title="Reporte Agéntico Oficial" />
        </div>
    );
};

export default AiAgentTasks;
