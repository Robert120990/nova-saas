import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Fuel, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const GasDespachadorNozzles = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [selectedDespachadorId, setSelectedDespachadorId] = useState('');

    const { data: despachadores = [], error: despError } = useQuery({
        queryKey: ['gas-despachadores', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/despachadores', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: nozzles = [], error: nozzError } = useQuery({
        queryKey: ['gas-nozzles-all', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/nozzles', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: assignedNozzleIds = [], error: assignedError } = useQuery({
        queryKey: ['gas-despachador-nozzles', selectedDespachadorId, user?.branch_id],
        queryFn: async () => (await axios.get(`/api/gas-station/despachadores/${selectedDespachadorId}/nozzles`)).data,
        enabled: !!selectedDespachadorId
    });

    const { data: allAssignments = [], error: assignError } = useQuery({
        queryKey: ['gas-despachador-nozzles-all-page', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/despachador-nozzles/all')).data
    });

    React.useEffect(() => {
        if (despError) toast.error('Error al cargar despachadores');
    }, [despError]);

    React.useEffect(() => {
        if (nozzError) toast.error('Error al cargar mangueras');
    }, [nozzError]);

    React.useEffect(() => {
        if (assignedError) toast.error('Error al cargar asignaciones del despachador');
    }, [assignedError]);

    React.useEffect(() => {
        if (assignError) toast.error('Error al cargar asignaciones');
    }, [assignError]);

    const safeNozzles = Array.isArray(nozzles) ? nozzles : [];
    const safeAllAssignments = Array.isArray(allAssignments) ? allAssignments : [];
    const safeDespachadores = Array.isArray(despachadores) ? despachadores : [];

    const [selected, setSelected] = useState([]);
    const [savingNozzleId, setSavingNozzleId] = useState(null);

    React.useEffect(() => {
        setSelected(Array.isArray(assignedNozzleIds) ? assignedNozzleIds : []);
    }, [assignedNozzleIds]);

    const saveMutation = useMutation({
        mutationFn: (nozzle_ids) => axios.put(`/api/gas-station/despachadores/${selectedDespachadorId}/nozzles`, { nozzle_ids }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gas-despachador-nozzles', selectedDespachadorId] });
            queryClient.invalidateQueries({ queryKey: ['gas-despachador-nozzles-all'] });
            setSavingNozzleId(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar');
            setSavingNozzleId(null);
        }
    });

    const toggleNozzle = (nozzleId) => {
        const newSelected = selected.includes(nozzleId)
            ? selected.filter(id => id !== nozzleId)
            : [...selected, nozzleId];
        setSelected(newSelected);
        setSavingNozzleId(nozzleId);
        saveMutation.mutate(newSelected);
    };

    const nozzleAssignmentMap = {};
    safeAllAssignments.forEach(a => {
        nozzleAssignmentMap[a.nozzle_id] = { despachador_id: a.despachador_id, despachador_codigo: a.despachador_codigo };
    });

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-lg font-bold text-slate-800 mb-1">Asignación de Mangueras</h1>
            <p className="text-xs text-slate-400 mb-6">Seleccione un despachador y asigne las mangueras correspondientes</p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Despachador
                </label>
                <select
                    value={selectedDespachadorId}
                    onChange={(e) => setSelectedDespachadorId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                    <option value="">-- Seleccionar despachador --</option>
                    {safeDespachadores.map(d => (
                        <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                    ))}
                </select>

                {selectedDespachadorId && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Mangueras</h3>
                        {safeNozzles.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No hay mangueras registradas.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {safeNozzles.map(n => {
                                    const assignment = nozzleAssignmentMap[n.id];
                                    const isAssignedToCurrent = selected.includes(n.id);
                                    const isOccupied = assignment && assignment.despachador_id !== parseInt(selectedDespachadorId);
                                    const isSaving = savingNozzleId === n.id;

                                    if (isOccupied) {
                                        return (
                                            <div
                                                key={n.id}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-400 cursor-not-allowed"
                                                title={`Asignada a ${assignment.despachador_codigo}`}
                                            >
                                                <Lock size={14} className="text-slate-300" />
                                                <div className="text-left leading-tight">
                                                    <span className="font-bold">{n.codigo}</span>
                                                    {n.product_nombre && (
                                                        <span className="text-[10px] text-slate-400 block">{n.product_nombre}</span>
                                                    )}
                                                    {n.island_codigo && (
                                                        <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                    )}
                                                    <span className="text-[10px] text-amber-500 block">{assignment.despachador_codigo}</span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => toggleNozzle(n.id)}
                                            disabled={isSaving}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                                                isSaving ? 'opacity-50 pointer-events-none' : ''
                                            } ${
                                                isAssignedToCurrent
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                        >
                                            {isSaving ? (
                                                <Loader2 size={14} className="animate-spin text-indigo-400" />
                                            ) : (
                                                <Fuel size={14} className={isAssignedToCurrent ? 'text-indigo-500' : 'text-slate-300'} />
                                            )}
                                            <div className="text-left leading-tight">
                                                <span className="font-bold">{n.codigo}</span>
                                                {n.product_nombre && (
                                                    <span className="text-[10px] text-slate-500 block">{n.product_nombre}</span>
                                                )}
                                                {n.island_codigo && (
                                                    <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-3">
                            <Lock size={10} className="inline mr-1" />
                            Mangueras ocupadas por otro despachador.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GasDespachadorNozzles;
