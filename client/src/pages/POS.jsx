import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Monitor, Edit, Trash2, Power } from 'lucide-react';
import { toast } from 'sonner';

const POS = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);

    const { data: posList = [], isLoading } = useQuery({
        queryKey: ['pos'],
        queryFn: async () => (await axios.get('/api/pos')).data
    });

    const { data: branches = [] } = useQuery({ 
        queryKey: ['branches'], 
        queryFn: async () => (await axios.get('/api/branches')).data 
    });

    const createMutation = useMutation({
        mutationFn: (newPos) => axios.post('/api/pos', newPos),
        onSuccess: () => {
            queryClient.invalidateQueries(['pos']);
            setIsModalOpen(false);
            toast.success('Caja/POS creada');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/pos/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['pos']);
            setIsModalOpen(false);
            setSelectedPos(null);
            toast.success('Punto de venta actualizado');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/pos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['pos']);
            toast.success('Punto de venta eliminado');
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }) => axios.put(`/api/pos/${id}`, { status: status === 'activo' ? 'inactivo' : 'activo' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['pos']);
            toast.success('Estado actualizado');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (selectedPos) {
            updateMutation.mutate({ id: selectedPos.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (pos) => {
        setSelectedPos(pos);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('¿Estás seguro de eliminar este punto de venta?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Puntos de Venta (POS)</h2>
                    <p className="text-slate-500 font-medium">Terminales de facturación por sucursal</p>
                </div>
                <button 
                    onClick={() => { setSelectedPos(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo POS</span>
                </button>
            </div>

            <Table 
                headers={['Sucursal', 'Código POS', 'Nombre terminal', 'Estado', 'Acciones']}
                data={posList}
                isLoading={isLoading}
                renderRow={(pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">{pos.branch_name || 'Desconocida'}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">ID Branch: {pos.branch_id}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold font-mono border border-indigo-100">
                                {pos.codigo}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{pos.nombre}</td>
                        <td className="px-6 py-4">
                            <button
                                onClick={() => toggleStatusMutation.mutate({ id: pos.id, status: pos.status })}
                                className={`group flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${
                                    pos.status === 'activo' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${pos.status === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                {pos.status === 'activo' ? 'activo' : 'inactivo'}
                                <Power size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleEdit(pos)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Editar"
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(pos.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Eliminar"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedPos ? "Editar Punto de Venta" : "Nuevo Punto de Venta"}
            >
                <form onSubmit={handleSubmit} className="space-y-5 p-1">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Sucursal</label>
                        <select 
                            name="branch_id" 
                            defaultValue={selectedPos?.branch_id}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all appearance-none" 
                            required
                        >
                            <option value="">Selecciona Sucursal</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre} ({b.codigo})</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Código POS</label>
                        <input 
                            name="codigo" 
                            defaultValue={selectedPos?.codigo}
                            placeholder="Ej: BOX-01" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-mono" 
                            required 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Terminal</label>
                        <input 
                            name="nombre" 
                            defaultValue={selectedPos?.nombre}
                            placeholder="Caja Principal / Terminal Móvil" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" 
                            required 
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {selectedPos ? 'Actualizar' : 'Crear Terminal'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
export default POS;
