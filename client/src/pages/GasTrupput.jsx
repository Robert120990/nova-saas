import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';

const GasTrupput = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedClienteNombre, setSelectedClienteNombre] = useState('');
    const [precioValue, setPrecioValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_trupput: 1 }
        });
        return data;
    };

    const { data: trupputData, isLoading } = useQuery({
        queryKey: ['gas-trupput', searchTerm],
        queryFn: async () => {
            const params = { page: 1, limit: 1000 };
            if (searchTerm) params.search = searchTerm;
            return (await axios.get('/api/gas-station/trupput', { params })).data;
        }
    });

    const trupputList = trupputData?.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedItem) return axios.put(`/api/gas-station/trupput/${selectedItem.id}`, data);
            return axios.post('/api/gas-station/trupput', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-trupput']);
            setIsModalOpen(false);
            setSelectedItem(null);
            toast.success(selectedItem ? 'Cliente Trupput actualizado' : 'Cliente Trupput creado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/trupput/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-trupput']);
            toast.success('Cliente Trupput eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar cliente Trupput?',
            message: 'Solo se puede eliminar si no tiene galones despachados en cierres.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cliente_id = parseInt(selectedClienteId) || 0;
        const cliente_nombre = selectedClienteNombre || '';
        const payload = {
            cliente_id,
            cliente_nombre,
            galones: parseFloat(e.target.galones.value) || 0,
            precio: parseFloat(precioValue) || 0,
            fecha: e.target.fecha.value,
            notas: e.target.notas.value,
        };
        mutation.mutate(payload);
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setSelectedClienteId(item?.cliente_id?.toString() || '');
        setSelectedClienteNombre(item?.cliente_nombre || item?.customer_nombre || '');
        setPrecioValue(item?.precio || '');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Clientes Trupput</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Prepago por Galonaje</p>
                </div>
                <button
                    onClick={() => { setSelectedItem(null); setSelectedClienteId(''); setSelectedClienteNombre(''); setPrecioValue(''); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nueva Recarga</span>
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
                <div className="overflow-x-auto">
                    <table className="w-full table-cards">
                        <thead>
                            <tr className="text-[11px] font-bold text-slate-500 uppercase bg-slate-50">
                                <th className="px-3 py-2 text-left">No.</th>
                                <th className="px-3 py-2 text-left">Fecha</th>
                                <th className="px-3 py-2 text-left">Cliente</th>
                                <th className="px-3 py-2 text-left">NRC</th>
                                <th className="px-3 py-2 text-right">Galones</th>
                                <th className="px-3 py-2 text-right">Precio</th>
                                <th className="px-3 py-2 text-right">Monto</th>
                                <th className="px-3 py-2 text-right">Disponible</th>
                                <th className="px-3 py-2 text-right">Usado</th>
                                <th className="px-3 py-2 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-400">Cargando...</td></tr>
                            ) : trupputList.length === 0 ? (
                                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-400">No se encontraron registros</td></tr>
                            ) : trupputList.map(item => {
                                const usado = parseFloat(item.galones) - parseFloat(item.galones_disponibles);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <td data-label="No." className="px-3 py-1">
                                            <span className="font-mono font-bold text-xs text-indigo-600">{item.numero}</span>
                                        </td>
                                        <td data-label="Fecha" className="px-3 py-1">
                                            <span className="text-xs text-slate-600">{item.fecha ? new Date(item.fecha).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                                        </td>
                                        <td data-label="Cliente" className="px-3 py-1">
                                            <span className="font-bold text-xs text-slate-900">{item.cliente_nombre || item.customer_nombre || '—'}</span>
                                        </td>
                                        <td data-label="NRC" className="px-3 py-1">
                                            <span className="text-xs font-mono text-slate-500">{item.nrc || '-'}</span>
                                        </td>
                                        <td data-label="Galones" className="px-3 py-1 text-right">
                                            <span className="font-mono font-bold text-xs text-slate-900">{parseFloat(item.galones).toFixed(4)}</span>
                                        </td>
                                        <td data-label="Precio" className="px-3 py-1 text-right">
                                            <span className="font-mono text-xs text-slate-500"><Money value={item.precio} /></span>
                                        </td>
                                        <td data-label="Monto" className="px-3 py-1 text-right">
                                            <span className="font-mono font-bold text-xs text-emerald-600"><Money value={item.monto} /></span>
                                        </td>
                                        <td data-label="Disponible" className="px-3 py-1 text-right">
                                            <span className={`font-mono font-bold text-xs ${parseFloat(item.galones_disponibles) > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                {parseFloat(item.galones_disponibles).toFixed(4)}
                                            </span>
                                        </td>
                                        <td data-label="Usado" className="px-3 py-1 text-right">
                                            <span className={`font-mono font-bold text-xs ${usado > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                {usado.toFixed(4)}
                                            </span>
                                        </td>
                                        <td data-label="Acciones" className="px-3 py-1">
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15}/></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedItem ? 'Editar Recarga Trupput' : 'Nueva Recarga Trupput'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Cliente <span className="text-red-400">*</span></label>
                        <SearchableSelect
                            loadOptions={loadCustomersOptions}
                            value={selectedClienteId}
                            onChange={(e, opt) => {
                                setSelectedClienteId(e.target.value);
                                setSelectedClienteNombre(opt?.nombre || '');
                            }}
                            placeholder="Buscar cliente..."
                            valueKey="id"
                            labelKey="nombre"
                            displayKey="nombre"
                            codeKey="nrc"
                            codeLabel="NRC"
                            selectedLabel={selectedClienteNombre}
                            dropdownWidth={420}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Galones <span className="text-red-400">*</span></label>
                            <input
                                name="galones"
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                defaultValue={selectedItem?.galones}
                                required
                                placeholder="0.0000"
                                className={fieldCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Precio por Galón</label>
                            <MoneyInput
                                name="precio"
                                value={precioValue}
                                onChange={(e) => setPrecioValue(e.target.value)}
                                placeholder="0.00"
                                className={fieldCls}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Fecha</label>
                        <input
                            name="fecha"
                            type="date"
                            defaultValue={(selectedItem?.fecha || new Date().toISOString().split('T')[0]).split('T')[0]}
                            className={fieldCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Notas</label>
                        <textarea
                            name="notas"
                            defaultValue={selectedItem?.notas || ''}
                            placeholder="Notas opcionales..."
                            rows={2}
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

export default GasTrupput;