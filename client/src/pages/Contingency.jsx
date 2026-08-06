import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, Play, StopCircle, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';

const CONTINGENCY_TYPES = {
    1: 'No disponibilidad del sistema MH',
    2: 'Falla en suministro eléctrico',
    3: 'Falla en servicio de Internet',
    4: 'Falla tecnológica del emisor',
    5: 'Otras causas'
};

const Contingency = () => {
    const queryClient = useQueryClient();
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [tipoContingencia, setTipoContingencia] = useState(1);

    const { data: status, refetch } = useQuery({
        queryKey: ['contingency', 'status'],
        queryFn: async () => (await axios.get('/api/contingency/status')).data,
        refetchInterval: 30000,
    });

    const startMutation = useMutation({
        mutationFn: (data) => axios.post('/api/contingency/start', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['contingency']);
            setIsStartModalOpen(false);
            toast.success('Contingencia activada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const stopMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/contingency/stop/${id}`),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['contingency']);
            if (data.data?.report?.success) {
                toast.success('Contingencia cerrada y reporte enviado a Hacienda');
            } else {
                toast.success('Contingencia cerrada');
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const history = status?.history || [];
    const pendingDocs = status?.pendingDocs || 0;
    const sentDocs = status?.sentDocs || 0;
    const activeContingency = history.find(c => c.estado === 'OPEN');

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <AlertTriangle size={28} className="text-amber-500" />
                        Contingencia DTE
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión de modo contingencia para documentos tributarios</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => refetch()} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all" title="Refrescar">
                        <RefreshCw size={18} className="text-slate-600" />
                    </button>
                    {!activeContingency ? (
                        <button
                            onClick={() => setIsStartModalOpen(true)}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg"
                        >
                            <Play size={16} /> Activar Contingencia
                        </button>
                    ) : (
                        <button
                            onClick={() => { if (confirm('¿Cerrar contingencia y enviar reporte a Hacienda?')) stopMutation.mutate(activeContingency.id); }}
                            disabled={stopMutation.isPending}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg"
                        >
                            <StopCircle size={16} /> {stopMutation.isPending ? 'Cerrando...' : 'Cerrar y Reportar'}
                        </button>
                    )}
                </div>
            </div>

            {/* Estado Actual */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-6 rounded-2xl border shadow-sm ${activeContingency ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${activeContingency ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="text-[10px] font-black uppercase tracking-wider">{activeContingency ? 'En Contingencia' : 'Modo Normal'}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">
                        {activeContingency
                            ? CONTINGENCY_TYPES[activeContingency.tipo_contingencia] || 'Activo'
                            : 'Sin incidencias'}
                    </p>
                </div>
                <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pendientes de envío</span>
                    <p className="text-2xl font-black text-amber-600">{pendingDocs}</p>
                </div>
                <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Enviados post-contingencia</span>
                    <p className="text-2xl font-black text-emerald-600">{sentDocs}</p>
                </div>
            </div>

            {/* Historial */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                    <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Clock size={14} /> Historial de Contingencias
                    </h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Inicio</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Fin</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Tipo</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Motivo</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {history.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50/50">
                                <td className="px-6 py-3 text-xs font-bold">{new Date(row.fecha_inicio).toLocaleString('es-SV')}</td>
                                <td className="px-6 py-3 text-xs">{row.fecha_fin ? new Date(row.fecha_fin).toLocaleString('es-SV') : '—'}</td>
                                <td className="px-6 py-3 text-xs">{CONTINGENCY_TYPES[row.tipo_contingencia] || 'Tipo ' + row.tipo_contingencia}</td>
                                <td className="px-6 py-3 text-xs text-slate-500 max-w-xs truncate">{row.motivo}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.estado === 'OPEN' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {row.estado === 'OPEN' ? 'Activo' : 'Cerrado'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Sin registros de contingencia</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isStartModalOpen} onClose={() => setIsStartModalOpen(false)} title="Activar Contingencia" maxWidth="max-w-md">
                <form onSubmit={(e) => { e.preventDefault(); startMutation.mutate({ motivo, tipoContingencia }); }} className="space-y-4 pt-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Tipo de Contingencia</label>
                        <select value={tipoContingencia} onChange={(e) => setTipoContingencia(parseInt(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                            {Object.entries(CONTINGENCY_TYPES).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Motivo / Descripción</label>
                        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" rows={3} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsStartModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-400">Cancelar</button>
                        <button type="submit" disabled={startMutation.isPending} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-black uppercase text-xs">
                            {startMutation.isPending ? 'Activando...' : 'Activar Contingencia'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Contingency;
