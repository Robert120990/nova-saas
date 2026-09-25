import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, Play, StopCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';
import { formatDateTime } from '../utils/dateUtils';

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
    const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
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
            queryClient.invalidateQueries({ queryKey: ['contingency'] });
            refetch();
            setIsStartModalOpen(false);
            setMotivo('');
            toast.success('Contingencia activada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al activar contingencia'),
    });

    const stopMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/contingency/stop/${id}`),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['contingency'] });
            refetch();
            setIsStopConfirmOpen(false);
            if (data.data?.report?.success) {
                toast.success('Contingencia cerrada y reporte enviado a Hacienda');
            } else {
                toast.success('Contingencia cerrada exitosamente');
            }
        },
        onError: (err) => {
            setIsStopConfirmOpen(false);
            toast.error(err.response?.data?.message || err.message || 'Error al cerrar contingencia');
        },
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
                    {!activeContingency ? (
                        <button
                            onClick={() => setIsStartModalOpen(true)}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg transition-all"
                        >
                            <Play size={16} /> Activar Contingencia
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsStopConfirmOpen(true)}
                            disabled={stopMutation.isPending}
                            className="bg-red-500 hover:bg-red-600 active:scale-95 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Historial Compacto en una sola fila sin scroll horizontal */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <Clock size={14} className="text-indigo-600" /> Historial de Contingencias
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">
                        {history.length} {history.length === 1 ? 'registro' : 'registros'}
                    </span>
                </div>
                <div className="w-full">
                    <table className="w-full table-fixed text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="w-12 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">ID</th>
                                <th className="w-36 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inicio</th>
                                <th className="w-36 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fin</th>
                                <th className="w-48 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Motivo</th>
                                <th className="w-24 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-3 py-2 text-[11px] font-mono font-bold text-slate-600 text-center truncate">
                                        #{row.id}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-bold text-slate-800 truncate" title={formatDateTime(row.fecha_inicio)}>
                                        {formatDateTime(row.fecha_inicio)}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600 truncate" title={row.fecha_fin ? formatDateTime(row.fecha_fin) : 'En curso...'}>
                                        {row.fecha_fin ? formatDateTime(row.fecha_fin) : <span className="text-amber-600 font-bold">En curso...</span>}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-medium text-slate-700 truncate" title={CONTINGENCY_TYPES[row.tipo_contingencia] || 'Tipo ' + row.tipo_contingencia}>
                                        {CONTINGENCY_TYPES[row.tipo_contingencia] || 'Tipo ' + row.tipo_contingencia}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 truncate" title={row.motivo || '—'}>
                                        {row.motivo || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-center truncate">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            row.estado === 'OPEN' 
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                            {row.estado === 'OPEN' ? 'Activo' : 'Cerrado'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400 italic">
                                        Sin registros de contingencia
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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

            {/* Modal de Confirmación del Sistema para Cerrar y Reportar */}
            <Modal isOpen={isStopConfirmOpen} onClose={() => !stopMutation.isPending && setIsStopConfirmOpen(false)} title="Confirmar Cierre de Contingencia" maxWidth="max-w-md">
                <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200/70">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
                        <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900">
                                ¿Desea cerrar el período de contingencia?
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Al confirmar, el sistema generará y transmitirá el informe oficial del evento a Hacienda e iniciará el reenvío automático de los documentos acumulados ({pendingDocs} pendientes).
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            disabled={stopMutation.isPending}
                            onClick={() => setIsStopConfirmOpen(false)} 
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            disabled={stopMutation.isPending}
                            onClick={() => activeContingency && stopMutation.mutate(activeContingency.id)} 
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {stopMutation.isPending ? 'Cerrando...' : 'Sí, Cerrar y Reportar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Contingency;
