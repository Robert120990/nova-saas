import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Gift, Calculator, Save, Eye, AlertCircle } from 'lucide-react';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

const yearNow = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => yearNow - 2 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const Aguinaldos = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterAño, setFilterAño] = useState(yearNow);

    // Modal form
    const [calcAño, setCalcAño] = useState(yearNow);
    const [calcMes, setCalcMes] = useState(12);
    const [calcDeptoId, setCalcDeptoId] = useState('');
    const [calculado, setCalculado] = useState([]);
    const [calculando, setCalculando] = useState(false);
    const [yaExiste, setYaExiste] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: resumen = [], isLoading } = useQuery({
        queryKey: ['rh-planilla-aguinaldos-resumen', filterAño],
        queryFn: async () => (await axios.get('/api/rh/planilla-aguinaldos/resumen', { params: { año: filterAño } })).data
    });

    const { data: deptosResp = { data: [] } } = useQuery({
        queryKey: ['rh-departamentos-aguinaldos'],
        queryFn: async () => (await axios.get('/api/rh/departamentos')).data,
        enabled: isModalOpen
    });
    const deptos = deptosResp.data || [];

    const deleteMutation = useMutation({
        mutationFn: ({ año, mes, departamento_id }) => {
            const params = { año, mes };
            if (departamento_id) params.departamento_id = departamento_id;
            return axios.delete('/api/rh/planilla-aguinaldos/periodo', { params });
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-planilla-aguinaldos-resumen'] }); toast.success('Planilla eliminada'); },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const saveMutation = useMutation({
        mutationFn: () => axios.post('/api/rh/planilla-aguinaldos', { año: calcAño, mes: calcMes, items: calculado, filtro_departamento_id: calcDeptoId || null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-aguinaldos-resumen'] });
            setYaExiste(true);
            setCalculado([]);
            toast.success('Planilla guardada');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const handleDelete = async (r) => {
        const ok = await confirm({ title: 'Eliminar planilla?', message: `Se eliminara la planilla de ${months.find(m => m.value === r.periodo_mes)?.label} ${r.periodo_año}${r.departamento_nombre ? ' (' + r.departamento_nombre + ')' : ' (Todos)'}.`, confirmLabel: 'Si, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate({ año: r.periodo_año, mes: r.periodo_mes, departamento_id: r.filtro_departamento_id || 0 });
    };

    const handleDownloadPDF = async (r) => {
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos/pdf', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Aguinaldos_${r.periodo_año}_${r.periodo_mes}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado');
        } catch { toast.error('Error al descargar PDF'); }
    };
    const handleDownloadRecibos = async (r) => {
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos/recibos', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Recibos_Aguinaldos_${r.periodo_año}_${r.periodo_mes}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Recibos generados');
        } catch { toast.error('Error al generar recibos'); }
    };

    const handleDownloadCSV = async (r) => {
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos', { params });
            const rows = res.data;
            if (!rows.length) return toast.error('Sin datos');
            const csv = rows.map(item => {
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
            toast.success('CSV descargado');
        } catch { toast.error('Error al descargar CSV'); }
    };

    const handleVerPlanilla = async (r) => {
        setCalcAño(r.periodo_año);
        setCalcMes(r.periodo_mes);
        setCalcDeptoId(r.filtro_departamento_id ? String(r.filtro_departamento_id) : '');
        try {
            const params = { año: r.periodo_año, mes: r.periodo_mes };
            if (r.filtro_departamento_id) params.departamento_id = r.filtro_departamento_id;
            const res = await axios.get('/api/rh/planilla-aguinaldos', { params });
            setCalculado(res.data);
            setYaExiste(true);
        } catch { setCalculado([]); }
        setIsModalOpen(true);
    };

    const handleCalcular = async () => {
        if (!calcAño) return;
        setCalculando(true);
        try {
            const params = { año: calcAño, mes: calcMes };
            if (calcDeptoId) params.departamento_id = calcDeptoId;
            const res = await axios.get('/api/rh/planilla-aguinaldos/calcular', { params });
            setCalculado(res.data);
            setYaExiste(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al calcular');
        } finally {
            setCalculando(false);
        }
    };

    const openNewModal = () => {
        setCalcAño(yearNow);
        setCalcMes(12);
        setCalcDeptoId('');
        setCalculado([]);
        setYaExiste(false);
        setIsModalOpen(true);
    };

    const fmtDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return String(dateStr);
            const d = date.getUTCDate().toString().padStart(2, '0');
            const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const y = date.getUTCFullYear();
            return `${d}/${m}/${y}`;
        } catch (e) { return String(dateStr); }
    };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
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
                    <select value={filterAño} onChange={e => setFilterAño(parseInt(e.target.value))}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
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
                                <span className="text-xs font-bold text-emerald-600">${parseFloat(item.total_monto).toFixed(2)}</span>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleVerPlanilla(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver planilla"><Eye size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDownloadRecibos(item)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Recibos individuales"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button>
                                <button onClick={() => handleDownloadCSV(item)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Descargar CSV"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                                <button onClick={() => handleDelete(item)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setCalculado([]); }}
                title="Planilla de Aguinaldos" maxWidth="max-w-5xl">
                <div className="space-y-3 pb-2">
                    {/* Filters in modal */}
                    <div className="flex gap-2 items-end">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Año</label>
                            <select value={calcAño} onChange={e => setCalcAño(parseInt(e.target.value))}
                                className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Mes</label>
                            <select value={calcMes} onChange={e => setCalcMes(parseInt(e.target.value))}
                                className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Departamento</label>
                            <select value={calcDeptoId} onChange={e => setCalcDeptoId(e.target.value)}
                                className="w-44 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                <option value="">TODOS</option>
                                {deptos.map(d => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
                            </select>
                        </div>
                        <button type="button" onClick={handleCalcular} disabled={calculando || !calcAño}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 h-8">
                            <Calculator size={14} />
                            {calculando ? 'Calculando...' : 'Calcular'}
                        </button>
                    </div>

                    {yaExiste && calculado.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <AlertCircle size={14} className="text-amber-600 shrink-0" />
                            <span className="text-[10px] font-bold text-amber-700">Planilla guardada para este periodo.</span>
                        </div>
                    )}

                    {/* Table */}
                    {calculado.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                            <table className="w-full text-[12px] whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-12">Codigo</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] max-w-[180px]">Nombre</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] max-w-[120px]">Cargo</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">F. Ingreso</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">F. Base</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-10">Dias</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-10">Tabla</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Aguinaldo</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Excedente</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-12">Renta</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Recibir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculado.map((item, i) => (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="px-1.5 py-0.5 font-mono font-bold text-indigo-500">{item.codigo}</td>
                                            <td className="px-1.5 py-0.5 font-bold text-slate-700 max-w-[180px] truncate">{item.nombres} {item.apellidos}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500 max-w-[120px] truncate">{item.cargo_nombre || '-'}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500">{fmtDate(item.fecha_ingreso)}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500">{fmtDate(item.fecha_base)}</td>
                                            <td className="px-1.5 py-0.5 text-right text-slate-600">{item.dias_antiguedad}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-slate-700">{item.dias_segun_tabla}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-indigo-600">${parseFloat(item.aguinaldo_calculado).toFixed(2)}</td>
                                            <td className="px-1.5 py-0.5 text-right text-slate-600">${parseFloat(item.excedente).toFixed(2)}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-red-600">${parseFloat(item.renta).toFixed(2)}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-emerald-600">${parseFloat(item.monto_recibir).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {calculado.length === 0 && !calculando && (
                        <div className="py-10 text-center">
                            <Gift size={24} className="mx-auto text-slate-300 mb-1" />
                            <p className="text-[10px] font-bold text-slate-400">Seleccione filtros y presione Calcular</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        {calculado.length > 0 && !yaExiste && (
                            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50">
                                <Save size={14} />
                                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        )}
                        <button type="button" onClick={() => { setIsModalOpen(false); setCalculado([]); }}
                            className="px-4 py-1.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs">Cerrar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Aguinaldos;
