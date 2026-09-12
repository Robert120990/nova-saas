import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import {
    Plus, Edit, Trash2, Search, FileSignature, FileText,
    Loader2, CheckCircle, Clock, ShieldAlert, X
} from 'lucide-react';
import AccionPersonalModal from '../../components/rh/AccionPersonalModal';
import { ACCIONES_OPCIONES } from '../../components/rh/accionPersonalConstants';

const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const parts = String(val).substring(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return new Date(val).toLocaleDateString('es-SV');
    } catch {
        return String(val);
    }
};

const AccionesPersonal = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [searchParams] = useSearchParams();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [paramEmployee, setParamEmployee] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAccion, setFilterAccion] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loadingPdfId, setLoadingPdfId] = useState(null);

    // Support query param navigation (e.g. from other pages)
    useEffect(() => {
        const empId = searchParams.get('empleado_id');
        const isNuevo = searchParams.get('nuevo') === '1';
        if (empId) {
            axios.get(`/api/rh/empleados/${empId}`).then(res => {
                const emp = res.data;
                if (emp) {
                    if (isNuevo) {
                        setSelected(null);
                        setParamEmployee(emp);
                        setIsModalOpen(true);
                    } else {
                        setSearchTerm(emp.codigo || emp.nombres);
                    }
                }
            }).catch(err => {
                console.error('Error fetching employee from params:', err);
            });
        }
    }, [searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-acciones-personal', debouncedSearch, filterAccion, filterDesde, filterHasta, page],
        queryFn: async () => (await axios.get('/api/rh/acciones-personal', {
            params: {
                search: debouncedSearch || undefined,
                accion_tomar: filterAccion || undefined,
                fecha_desde: filterDesde || undefined,
                fecha_hasta: filterHasta || undefined,
                page
            }
        })).data
    });

    const items = response.data || [];

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/acciones-personal/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-acciones-personal'] });
            queryClient.invalidateQueries({ queryKey: ['rh-empleado-acciones'] });
            toast.success('Acción de personal eliminada');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar');
        }
    });

    const handleDelete = async (item) => {
        const ok = await confirm({
            title: '¿Eliminar Acción de Personal?',
            message: `¿Está seguro de eliminar la acción ${item.codigo} del empleado ${item.empleado_nombres} ${item.empleado_apellidos}? Esta acción no se puede deshacer.`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) {
            deleteMutation.mutate(item.id);
        }
    };

    const handlePrintPDF = async (item) => {
        try {
            setLoadingPdfId(item.id);
            const res = await axios.get(`/api/rh/acciones-personal/${item.id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch (err) {
            console.error('Error al generar PDF:', err);
            toast.error('Error al generar o visualizar el PDF');
        } finally {
            setLoadingPdfId(null);
        }
    };

    const handleOpenCreate = () => {
        setSelected(null);
        setParamEmployee(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setSelected(item);
        setParamEmployee(null);
        setIsModalOpen(true);
    };

    const badgeAccion = (accionKey, dias) => {
        const opt = ACCIONES_OPCIONES.find(o => o.key === accionKey) || { label: accionKey, color: 'text-slate-700 bg-slate-100 border-slate-200' };
        let text = opt.label;
        if (accionKey === 'suspension' && dias) {
            text += ` (${dias} d)`;
        }
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${opt.color}`}>
                {text}
            </span>
        );
    };

    const badgeFirma = (estado) => {
        if (estado === 'firmado') {
            return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Firmado</span>;
        }
        if (estado === 'se_nego_a_firmar') {
            return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"><ShieldAlert size={10} /> Se negó</span>;
        }
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock size={10} /> Pendiente</span>;
    };

    return (
        <div className="space-y-4 text-slate-900 pb-12">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                        <FileSignature size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">Acciones de Personal</h2>
                        <p className="text-slate-500 text-xs font-medium">Gestión de amonestaciones y sanciones conforme a Reglamento Interno de Trabajo</p>
                    </div>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={18} />
                    <span>Nueva Acción</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                    <label className={labelCls}>Buscar</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por código, empleado, causa o correlativo..."
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Sanción / Medida</label>
                    <select
                        value={filterAccion}
                        onChange={e => { setFilterAccion(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="">Todas las medidas</option>
                        {ACCIONES_OPCIONES.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Desde</label>
                    <input
                        type="date"
                        value={filterDesde}
                        onChange={e => { setFilterDesde(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div>
                    <label className={labelCls}>Hasta</label>
                    <input
                        type="date"
                        value={filterHasta}
                        onChange={e => { setFilterHasta(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                {(searchTerm || filterAccion || filterDesde || filterHasta) && (
                    <button
                        onClick={() => { setSearchTerm(''); setFilterAccion(''); setFilterDesde(''); setFilterHasta(''); setPage(1); }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1"
                    >
                        <X size={13} /> Limpiar
                    </button>
                )}
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Correlativo', 'Fecha', 'Empleado', 'Cargo / Depto', 'Sanción Aplicada', 'Causa Resumida', 'Firma', 'Acciones']}
                    data={items}
                    isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2.5">
                                <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                    {item.codigo}
                                </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-medium text-slate-600">
                                {fmtDate(item.fecha)}
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="text-xs font-bold text-slate-800">
                                    {item.empleado_nombres} {item.empleado_apellidos}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    CÓD: {item.empleado_codigo}
                                </span>
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="text-xs font-medium text-slate-700">{item.cargo_nombre || '—'}</div>
                                <div className="text-[10px] text-slate-400">{item.lugar_trabajo || item.departamento_nombre || '—'}</div>
                            </td>
                            <td className="px-3 py-2.5">
                                {badgeAccion(item.accion_tomar, item.dias_suspension)}
                            </td>
                            <td className="px-3 py-2.5 max-w-xs">
                                <p className="text-xs text-slate-600 truncate font-normal" title={item.descripcion_causa}>
                                    {item.descripcion_causa || '—'}
                                </p>
                            </td>
                            <td className="px-3 py-2.5">
                                {badgeFirma(item.estado_firma)}
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handlePrintPDF(item)}
                                        disabled={loadingPdfId === item.id}
                                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Imprimir Documento Oficial (PDF)"
                                    >
                                        {loadingPdfId === item.id ? <Loader2 size={16} className="animate-spin text-indigo-600" /> : <FileText size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleOpenEdit(item)}
                                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item)}
                                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Pagination
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={items.length}
                isLoading={isLoading}
            />

            {/* Reusable Modal */}
            <AccionPersonalModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelected(null);
                    setParamEmployee(null);
                }}
                selectedAction={selected}
                initialEmployee={paramEmployee}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['rh-acciones-personal'] });
                }}
                zIndex="z-50"
            />
        </div>
    );
};

export default AccionesPersonal;
