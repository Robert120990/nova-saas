import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { Plus, Edit, Trash2, Search, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const GasAdvances = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedClienteNombre, setSelectedClienteNombre] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: customersData } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await axios.get('/api/customers', { params: { limit: 1000, es_anticipado: 1 } })).data?.data || [],
    });
    const customers = customersData || [];

    const { data: advancesData, isLoading } = useQuery({
        queryKey: ['gas-advances', searchTerm],
        queryFn: async () => {
            const params = { page: 1, limit: 1000 };
            if (searchTerm) params.search = searchTerm;
            return (await axios.get('/api/gas-station/advances', { params })).data;
        }
    });

    const advances = advancesData?.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedItem) return axios.put(`/api/gas-station/advances/${selectedItem.id}`, data);
            return axios.post('/api/gas-station/advances', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-advances']);
            setIsModalOpen(false);
            setSelectedItem(null);
            toast.success(selectedItem ? 'Anticipo actualizado' : 'Anticipo creado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/advances/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-advances']);
            toast.success('Anticipo eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar anticipo?',
            message: 'Solo se puede eliminar si no tiene consumo registrado.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cliente_id = parseInt(selectedClienteId) || 0;
        const cli = customers.find(c => c.id === cliente_id);
        const cliente_nombre = selectedClienteNombre || cli?.nombre || '';
        console.log('[GasAdvances] submit:', { selectedClienteId, cliente_id, selectedClienteNombre, cliNom: cli?.nombre });
        const payload = {
            cliente_id,
            cliente_nombre,
            monto: parseFloat(e.target.monto.value) || 0,
            fecha: e.target.fecha.value,
            notas: e.target.notas.value,
        };
        mutation.mutate(payload);
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setSelectedClienteId(item?.cliente_id?.toString() || '');
        setSelectedClienteNombre(item?.cliente_nombre || '');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Anticipos de Clientes</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Anticipos</p>
                </div>
                <button
                    onClick={() => { setSelectedItem(null); setSelectedClienteId(''); setSelectedClienteNombre(''); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Anticipo</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por número o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['No.', 'Fecha', 'Cliente', 'NRC', 'Monto', 'Disponible', 'Utilizado', 'Acciones']}
                    data={advances}
                    isLoading={isLoading}
                    renderRow={(item) => {
                        const usado = parseFloat(item.monto) - parseFloat(item.monto_disponible);
                        return (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                <td className="px-3 py-1">
                                    <span className="font-mono font-bold text-xs text-indigo-600">{item.numero}</span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className="text-xs text-slate-600">{item.fecha ? new Date(item.fecha).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className="font-bold text-xs text-slate-900">{item.cliente_nombre || item.customer_nombre || '—'}</span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className="text-xs font-mono text-slate-500">{item.nrc || '-'}</span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className="font-mono font-bold text-xs text-emerald-600">${parseFloat(item.monto).toFixed(2)}</span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className={`font-mono font-bold text-xs ${parseFloat(item.monto_disponible) > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        ${parseFloat(item.monto_disponible).toFixed(2)}
                                    </span>
                                </td>
                                <td className="px-3 py-1">
                                    <span className={`font-mono font-bold text-xs ${usado > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                        ${usado.toFixed(2)}
                                    </span>
                                </td>
                                <td className="px-3 py-1 flex gap-1">
                                    <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15}/></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedItem ? 'Editar Anticipo' : 'Nuevo Anticipo'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Cliente <span className="text-red-400">*</span></label>
                        <SearchableSelect
                            options={customers}
                            value={selectedClienteId}
                            onChange={(e) => {
                                const idVal = e.target.value;
                                const idStr = String(idVal);
                                setSelectedClienteId(idStr);
                                const cli = customers.find(c => String(c.id) === idStr);
                                setSelectedClienteNombre(cli?.nombre || '');
                                console.log('[GasAdvances] select:', { idVal, idStr, cliNom: cli?.nombre });
                            }}
                            placeholder="Buscar cliente..."
                            valueKey="id"
                            labelKey="nombre"
                            displayKey="nombre"
                            codeKey="nrc"
                            codeLabel="NRC"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Monto <span className="text-red-400">*</span></label>
                        <input
                            name="monto"
                            type="number"
                            step="0.01"
                            min="0.01"
                            defaultValue={selectedItem?.monto}
                            required
                            placeholder="0.00"
                            className={fieldCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Fecha</label>
                        <input
                            name="fecha"
                            type="date"
                            defaultValue={selectedItem?.fecha?.split('T')[0] || new Date().toISOString().split('T')[0]}
                            className={fieldCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Notas</label>
                        <textarea
                            name="notas"
                            defaultValue={selectedItem?.notas || ''}
                            placeholder="Notas opcionales..."
                            rows={3}
                            className={`${fieldCls} resize-none`}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedItem ? 'Guardar Cambios' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default GasAdvances;
