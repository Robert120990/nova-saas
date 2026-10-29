import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    AlertTriangle, Clock, ShieldCheck, CalendarX,
    Plus, Radar, ListChecks
} from 'lucide-react';
import { getTodayString, getFirstDayOfMonth, normalizeDateRangeInput } from '../../../utils/dateUtils';
import { useConfirm } from '../../../context/ConfirmContext';
import BiometricDailyRadarView from '../BiometricDailyRadarView';
import BiometricAbsencesHistoryView from '../BiometricAbsencesHistoryView';
import BiometricAbsenceModal from '../BiometricAbsenceModal';
import BiometricAbsenceAuthorizeModal from '../BiometricAbsenceAuthorizeModal';
import AccionPersonalModal from '../AccionPersonalModal';

const BiometricAbsencesTab = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [subView, setSubView] = useState('radar');
    // Radar state
    const [radarDate, setRadarDate] = useState(getTodayString());
    const [radarSearch, setRadarSearch] = useState('');
    const [debouncedRadarSearch, setDebouncedRadarSearch] = useState('');
    const [radarStatusFilter, setRadarStatusFilter] = useState('todos');

    // History state
    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getTodayString());
    const [categoria, setCategoria] = useState('todos');
    const [estadoAutorizacion, setEstadoAutorizacion] = useState('todos');
    const [historySearch, setHistorySearch] = useState('');
    const [debouncedHistorySearch, setDebouncedHistorySearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);

    // Modals state
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [initialModalData, setInitialModalData] = useState(null);
    const [editingAbsence, setEditingAbsence] = useState(null);
    const [authorizingAbsence, setAuthorizingAbsence] = useState(null);
    const [accionEmployee, setAccionEmployee] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedRadarSearch(radarSearch.trim()), 400);
        return () => clearTimeout(t);
    }, [radarSearch]);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedHistorySearch(historySearch.trim()); setPage(1); }, 500);
        return () => clearTimeout(t);
    }, [historySearch]);

    const { data: radarData = { rows: [], summary: {} }, isLoading: isRadarLoading } = useQuery({
        queryKey: ['rh-biometric-daily-radar', radarDate, debouncedRadarSearch, radarStatusFilter],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/absences/daily-radar', {
                params: {
                    date: radarDate,
                    search: debouncedRadarSearch || undefined,
                    statusFilter: radarStatusFilter
                }
            });
            return res.data || { rows: [], summary: {} };
        }
    });

    const { data: historyResp = { data: [], pagination: {}, summary: {} }, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['rh-biometric-absences', startDate, endDate, categoria, estadoAutorizacion, debouncedHistorySearch, page, limit],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/absences', {
                params: {
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    categoria: categoria !== 'todos' ? categoria : undefined,
                    estadoAutorizacion: estadoAutorizacion !== 'todos' ? estadoAutorizacion : undefined,
                    search: debouncedHistorySearch || undefined,
                    page,
                    limit
                }
            });
            return res.data || { data: [], pagination: {}, summary: {} };
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/rh/biometric/absences/${id}`),
        onSuccess: () => {
            toast.success('Registro eliminado correctamente.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-daily-radar'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-absences'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            queryClient.invalidateQueries({ queryKey: ['rh-empleado-ausencias'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar el registro.')
    });

    const handleDelete = async (item) => {
        const ok = await confirm({
            title: '¿Eliminar registro de ausencia/permiso?',
            message: `Se eliminará el registro de ${item.empleado_nombre}. Si no tiene marcación en el reloj, volverá a figurar como Sin Justificar.`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) deleteMutation.mutate(item.id);
    };

    const radarSum = radarData?.summary || {};
    const histSum = historyResp?.summary || {};

    return (
        <div className="space-y-5">
            {/* Tarjetas KPI Interactivas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <button
                    type="button"
                    onClick={() => { setSubView('radar'); setRadarStatusFilter('sin_justificar'); }}
                    className="p-4 rounded-2xl bg-white border border-rose-200/80 hover:border-rose-300 shadow-sm text-left transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-600 uppercase">No Llegaron · Sin Justificar</span>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">{radarSum.sin_justificar || 0}</p>
                    <p className="text-[11px] text-slate-400 font-medium">De {radarSum.total_activos || 0} activos en fecha radar</p>
                </button>

                <button
                    type="button"
                    onClick={() => { setSubView('historial'); setEstadoAutorizacion('pendiente'); setPage(1); }}
                    className="p-4 rounded-2xl bg-white border border-amber-200/80 hover:border-amber-300 shadow-sm text-left transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-600 uppercase">Pendientes de Autorizar</span>
                        <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">{histSum.pendientes || 0}</p>
                    <p className="text-[11px] text-slate-400 font-medium">Permisos solicitados en revisión</p>
                </button>

                <button
                    type="button"
                    onClick={() => { setSubView('historial'); setEstadoAutorizacion('autorizado'); setPage(1); }}
                    className="p-4 rounded-2xl bg-white border border-emerald-200/80 hover:border-emerald-300 shadow-sm text-left transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-600 uppercase">Autorizados (De Ley / Internos)</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                        {(histSum.autorizados_con_goce || 0) + (histSum.autorizados_sin_goce || 0)}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                        {histSum.autorizados_con_goce || 0} con goce · {histSum.autorizados_sin_goce || 0} sin goce
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => { setSubView('historial'); setCategoria('injustificada'); setPage(1); }}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-sm text-left transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Injustificadas / No Autorizadas</span>
                        <CalendarX className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">{histSum.injustificadas || 0}</p>
                    <p className="text-[11px] text-slate-400 font-medium">Sin permiso o rechazadas en período</p>
                </button>
            </div>

            {/* Selector de Sub-vista + Botón Nuevo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start">
                    <button
                        type="button"
                        onClick={() => setSubView('radar')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subView === 'radar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        <Radar className="w-4 h-4" />
                        <span>Radar Diario (¿Quién no llegó?)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubView('historial')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subView === 'historial' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        <ListChecks className="w-4 h-4" />
                        <span>Bitácora de Permisos y Autorizaciones</span>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setEditingAbsence(null);
                        setInitialModalData({ fecha: radarDate, categoria: 'interna' });
                        setIsAbsenceModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Permiso / Inasistencia</span>
                </button>
            </div>

            {subView === 'radar' ? (
                <BiometricDailyRadarView
                    date={radarDate}
                    onDateChange={setRadarDate}
                    search={radarSearch}
                    onSearchChange={setRadarSearch}
                    statusFilter={radarStatusFilter}
                    onStatusFilterChange={setRadarStatusFilter}
                    radarData={radarData}
                    isLoading={isRadarLoading}
                    onJustifyEmployee={(row, defaultCat) => {
                        setEditingAbsence(null);
                        setInitialModalData({
                            empleado_id: row.empleado_id,
                            fecha: row.fecha,
                            categoria: defaultCat,
                            lockEmployee: true
                        });
                        setIsAbsenceModalOpen(true);
                    }}
                    onEditAbsence={(abs) => {
                        setInitialModalData(null);
                        setEditingAbsence(abs);
                        setIsAbsenceModalOpen(true);
                    }}
                    onAuthorizeAbsence={(abs) => setAuthorizingAbsence(abs)}
                    onOpenAccionPersonal={(row) => setAccionEmployee({
                        id: row.empleado_id,
                        nombres: row.nombres,
                        apellidos: row.apellidos,
                        codigo: row.codigo,
                        cargo_nombre: row.cargo_nombre,
                        departamento_nombre: row.departamento_nombre,
                        fecha_ingreso: row.fecha_ingreso
                    })}
                />
            ) : (
                <BiometricAbsencesHistoryView
                    startDate={startDate}
                    onStartDateChange={(v) => {
                        const next = normalizeDateRangeInput('start', v, startDate, endDate);
                        setStartDate(next.startDate);
                        setEndDate(next.endDate);
                        setPage(1);
                    }}
                    endDate={endDate}
                    onEndDateChange={(v) => {
                        const next = normalizeDateRangeInput('end', v, startDate, endDate);
                        setStartDate(next.startDate);
                        setEndDate(next.endDate);
                        setPage(1);
                    }}
                    categoria={categoria}
                    onCategoriaChange={(v) => { setCategoria(v); setPage(1); }}
                    estadoAutorizacion={estadoAutorizacion}
                    onEstadoAutorizacionChange={(v) => { setEstadoAutorizacion(v); setPage(1); }}
                    search={historySearch}
                    onSearchChange={setHistorySearch}
                    rows={historyResp?.data || []}
                    pagination={historyResp?.pagination || { total: 0, page: 1, totalPages: 1, limit }}
                    limit={limit}
                    onLimitChange={(newLim) => { setLimit(newLim); setPage(1); }}
                    onPageChange={setPage}
                    isLoading={isHistoryLoading}
                    onEdit={(abs) => {
                        setInitialModalData(null);
                        setEditingAbsence(abs);
                        setIsAbsenceModalOpen(true);
                    }}
                    onAuthorize={(abs) => setAuthorizingAbsence(abs)}
                    onDelete={handleDelete}
                    onOpenAccionPersonal={(emp) => setAccionEmployee({
                        id: emp.empleado_id,
                        nombres: emp.nombres,
                        apellidos: emp.apellidos,
                        codigo: emp.codigo,
                        cargo_nombre: emp.cargo_nombre,
                        departamento_nombre: emp.departamento_nombre,
                        fecha_ingreso: emp.fecha_ingreso
                    })}
                />
            )}

            {/* Modales Modulares */}
            <BiometricAbsenceModal
                open={isAbsenceModalOpen}
                onClose={() => { setIsAbsenceModalOpen(false); setEditingAbsence(null); setInitialModalData(null); }}
                initialData={initialModalData}
                editingAbsence={editingAbsence}
            />

            <BiometricAbsenceAuthorizeModal
                open={!!authorizingAbsence}
                onClose={() => setAuthorizingAbsence(null)}
                absence={authorizingAbsence}
            />

            <AccionPersonalModal
                isOpen={!!accionEmployee}
                onClose={() => setAccionEmployee(null)}
                initialEmployee={accionEmployee}
            />
        </div>
    );
};

export default BiometricAbsencesTab;
