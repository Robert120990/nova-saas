import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../ui/Table';
import AguinaldosModal from './AguinaldosModal';
import Money from '../../ui/Money';
import { unwrapList } from '../../../utils/apiUtils';
import { useRhPayrollRequest } from '../../../hooks/useRhPayrollRequest';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, FileText, ReceiptText } from 'lucide-react';
import PlanillaReportModal from '../PlanillaReportModal';

const yearNow = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => yearNow - 2 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const AguinaldosScreen = ({ companyId }) => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterAño, setFilterAño] = useState(yearNow);
    const [previewPeriodo, setPreviewPeriodo] = useState(null);

    // Modal form
    const [calcAño, setCalcAño] = useState(yearNow);
    const [calcMes, setCalcMes] = useState(12);
    const [calcDeptoId, setCalcDeptoId] = useState('');
    const [calculado, setCalculado] = useState([]);
    const [calculando, setCalculando] = useState(false);
    const [yaExiste, setYaExiste] = useState(false);
    const [calculatedContext, setCalculatedContext] = useState(null);
    const context = JSON.stringify([companyId, calcAño, calcMes, calcDeptoId, isModalOpen]);
    const requestScope = useRhPayrollRequest(context);
    const headers = { 'x-company-id': companyId };

    const { data: resumen = [], isLoading } = useQuery({
        queryKey: ['rh-planilla-aguinaldos-resumen', companyId, filterAño],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/rh/planilla-aguinaldos/resumen', { params: { año: filterAño || undefined }, headers, signal })),
        enabled: !!companyId,
        staleTime: 0
    });

    const { data: deptos = [] } = useQuery({
        queryKey: ['rh-departamentos-all', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/rh/departamentos', { params: { limit: 5000 }, headers, signal })),
        enabled: isModalOpen && !!companyId
    });

    const deleteMutation = useMutation({
        mutationFn: ({ año, mes, departamento_id }) => {
            const params = { año, mes };
            if (departamento_id) params.departamento_id = departamento_id;
            return axios.delete('/api/rh/planilla-aguinaldos/periodo', { params, headers });
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-planilla-aguinaldos-resumen'] }); toast.success('Planilla eliminada'); },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El período o registro de aguinaldo ya no existe o fue eliminado');
                queryClient.invalidateQueries({ queryKey: ['rh-planilla-aguinaldos-resumen'] });
            } else {
                toast.error(error.response?.data?.message || 'Error al eliminar');
            }
        }
    });

    const saveMutation = useMutation({
        mutationFn: ({ payload }) => axios.post('/api/rh/planilla-aguinaldos', payload, { headers }),
        onSuccess: async (_res, { request }) => {
            await queryClient.invalidateQueries({ queryKey: ['rh-planilla-aguinaldos-resumen', companyId] });
            if (request.isCurrent()) setYaExiste(true);
            toast.success('Planilla guardada');
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El registro o período de aguinaldo ya no existe o fue eliminado');
            } else {
                toast.error(error.response?.data?.message || 'Error al guardar');
            }
        }
    });

    const handleDelete = async (r) => {
        const ok = await confirm({ title: 'Eliminar planilla?', message: `Se eliminara la planilla de ${months.find(m => m.value === r.periodo_mes)?.label} ${r.periodo_año}${r.departamento_nombre ? ' (' + r.departamento_nombre + ')' : ' (Todos)'}.`, confirmLabel: 'Si, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate({ año: r.periodo_año, mes: r.periodo_mes, departamento_id: r.filtro_departamento_id || 0 });
    };

    const handleVerPlanillaPDF = (r) => {
        setPreviewPeriodo({
            anio: r.periodo_año,
            mes: r.periodo_mes || 12,
            departamento_id: r.filtro_departamento_id,
            departamento_nombre: r.departamento_nombre,
            tipo: 'aguinaldo'
        });
    };

    const handleVerRecibosPDF = (r) => {
        setPreviewPeriodo({
            anio: r.periodo_año,
            mes: r.periodo_mes || 12,
            departamento_id: r.filtro_departamento_id,
            departamento_nombre: r.departamento_nombre,
            tipo: 'aguinaldo-recibos'
        });
    };

    const handleDownloadCSV = async (r) => {
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos', { params, headers });
            const rows = unwrapList(res).filter(item => String(item.filtro_departamento_id || '') === String(r.filtro_departamento_id || ''));
            if (!rows.length) return toast.error('Sin datos');
            const sortedRows = [...rows].sort((a, b) => {
                const cuentaA = String(a.cuenta_planillera || '').trim();
                const cuentaB = String(b.cuenta_planillera || '').trim();
                const hasA = Boolean(cuentaA && cuentaA !== '0' && cuentaA !== '-');
                const hasB = Boolean(cuentaB && cuentaB !== '0' && cuentaB !== '-');
                if (hasA && !hasB) return -1;
                if (!hasA && hasB) return 1;
                return 0;
            });
            const csv = sortedRows.map(item => {
                const cuenta = String(item.cuenta_planillera || '');
                const monto = parseFloat(item.monto_recibir || 0).toFixed(2);
                const nombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                return `${cuenta}\t${monto}\t${nombre}`;
            }).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `AGUINALDOS_${r.periodo_año}${r.periodo_mes}_${r.departamento_nombre || 'TODOS'}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            toast.success('CSV descargado');
        } catch { toast.error('Error al descargar CSV'); }
    };

    const handleVerPlanilla = async (r) => {
        if (saveMutation.isPending) return;
        const department = r.filtro_departamento_id ? String(r.filtro_departamento_id) : '';
        const nextContext = JSON.stringify([companyId, r.periodo_año, r.periodo_mes, department, true]);
        requestScope.setContext(nextContext);
        const request = requestScope.begin();
        setCalcAño(r.periodo_año);
        setCalcMes(r.periodo_mes);
        setCalcDeptoId(department);
        setCalculado([]);
        setCalculatedContext(null);
        setYaExiste(true);
        setIsModalOpen(true);
        setCalculando(true);
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos', { params, headers, signal: request.signal });
            if (!request.isCurrent()) return;
            setCalculado(unwrapList(res).filter(item => String(item.filtro_departamento_id || '') === department));
            setCalculatedContext(nextContext);
        } catch (error) {
            if (request.isCurrent()) toast.error(error.response?.data?.message || 'Error al cargar la planilla guardada');
        } finally {
            if (request.isCurrent()) setCalculando(false);
        }
    };

    const handleCalcular = async () => {
        if (!calcAño || calculando || saveMutation.isPending) return;
        const request = requestScope.begin();
        setCalculando(true);
        try {
            const params = { año: calcAño, mes: calcMes };
            if (calcDeptoId) params.departamento_id = calcDeptoId;
            const res = await axios.get('/api/rh/planilla-aguinaldos/calcular', { params, headers, signal: request.signal });
            if (!request.isCurrent()) return;
            setCalculado(unwrapList(res));
            setCalculatedContext(context);
            setYaExiste(false);
        } catch (error) {
            if (request.isCurrent()) toast.error(error.response?.data?.message || 'Error al calcular');
        } finally {
            if (request.isCurrent()) setCalculando(false);
        }
    };

    const openNewModal = () => {
        if (saveMutation.isPending) return;
        requestScope.cancel();
        setCalcAño(yearNow);
        setCalcMes(12);
        setCalcDeptoId('');
        setCalculado([]);
        setCalculatedContext(null);
        setCalculando(false);
        setYaExiste(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (saveMutation.isPending) return;
        requestScope.cancel();
        setIsModalOpen(false);
        setCalculado([]);
        setCalculatedContext(null);
        setCalculando(false);
    };

    const changeFilter = (field, value) => {
        if (saveMutation.isPending) return;
        requestScope.cancel();
        setCalculado([]);
        setCalculatedContext(null);
        setCalculando(false);
        setYaExiste(false);
        if (field === 'year') setCalcAño(value);
        if (field === 'month') setCalcMes(value);
        if (field === 'department') setCalcDeptoId(value);
    };

    const canSave = calculatedContext === context && !calculando && !yaExiste && calculado.length > 0;
    const handleGuardar = () => {
        if (!canSave || saveMutation.isPending) return toast.error('Calcule los filtros actuales antes de guardar');
        saveMutation.mutate({ request: requestScope.begin(), payload: { año: calcAño, mes: calcMes, items: calculado, filtro_departamento_id: calcDeptoId || null } });
    };

    const model = { isModalOpen, calcAño, calcMes, calcDeptoId, calculado, calculando, yaExiste, deptos, years, months, handleCalcular, setPreviewPeriodo, saveMutation, closeModal, changeFilter, handleGuardar, canSave };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planilla de Aguinaldos</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Calculo y gestion de aguinaldos por departamento</p>
                </div>
                <button onClick={openNewModal}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Planilla</span>
                </button>
            </div>

            <div className="flex gap-3 items-end">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={filterAño} onChange={e => setFilterAño(e.target.value ? parseInt(e.target.value) : '')}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Periodo', 'Departamento', 'Empleados', 'Monto Total', 'Acciones']}
                    data={resumen} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={`${item.periodo_año}-${item.periodo_mes}-${item.filtro_departamento_id || 'todos'}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_año}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs text-slate-500">{item.departamento_nombre || 'Todos'}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">{item.total_empleados}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-emerald-600"><Money value={item.total_monto} /></span>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleVerPlanilla(item)} className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalle de planilla"><Eye size={15} /></button>
                                <button onClick={() => handleVerPlanillaPDF(item)} className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver Planilla de Aguinaldos en PDF (Formato Oficial)"><FileText size={15} /></button>
                                <button onClick={() => handleVerRecibosPDF(item)} className="p-1 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Ver e Imprimir Recibos de Aguinaldo Masivos"><ReceiptText size={15} /></button>
                                <button onClick={() => handleDownloadCSV(item)} className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Descargar CSV"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                                <button onClick={() => handleDelete(item)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar planilla"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <AguinaldosModal open={isModalOpen} onClose={closeModal} onSubmit={handleGuardar} model={model} />

            {/* Modal de Vista Previa de Reportes / Recibos */}
            <PlanillaReportModal
                isOpen={!!previewPeriodo}
                onClose={() => setPreviewPeriodo(null)}
                periodo={previewPeriodo}
            />
        </div>
    );
};

export default AguinaldosScreen;
