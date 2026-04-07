import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { Plus, Search, Edit, Trash2, Power, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const Sellers = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [sellerToDelete, setSellerToDelete] = useState(null);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [selectedPosId, setSelectedPosId] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['sellers', search, page],
        queryFn: async () => (await axios.get('/api/sellers', { params: { search, page, limit: 10 } })).data
    });

    const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: async () => (await axios.get('/api/branches')).data });
    
    // POS globales para nombres en la tabla
    const { data: allPos = [] } = useQuery({ 
        queryKey: ['pos-all'], 
        queryFn: async () => (await axios.get('/api/pos')).data 
    });

    // POS filtrados para el formulario (dependiente de la sucursal seleccionada)
    const { data: filteredPos = [] } = useQuery({
        queryKey: ['pos-filtered', selectedBranchId],
        queryFn: async () => {
            if (!selectedBranchId) return [];
            const { data } = await axios.get('/api/pos', {
                params: { branch_id: selectedBranchId, status: 'activo' }
            });
            return data;
        },
        enabled: !!selectedBranchId
    });

    const mutation = useMutation({
        mutationFn: (sellerData) => {
            if (selectedSeller) return axios.put(`/api/sellers/${selectedSeller.id}`, sellerData);
            return axios.post('/api/sellers', sellerData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['sellers']);
            setIsModalOpen(false);
            setSelectedSeller(null);
            setSelectedBranchId('');
            setSelectedPosId('');
            toast.success(selectedSeller ? 'Vendedor actualizado' : 'Vendedor creado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al procesar la solicitud')
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }) => axios.put(`/api/sellers/${id}`, { status: status === 'activo' ? 'inactivo' : 'activo' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['sellers']);
            toast.success('Estado actualizado');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/sellers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['sellers']);
            setSellerToDelete(null);
            toast.success('Vendedor eliminado');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.allow_price_edit = formData.get('allow_price_edit') === 'on';
        mutation.mutate(data);
    };

    const handleEdit = (seller) => {
        setSelectedSeller(seller);
        setSelectedBranchId(seller.branch_id);
        setSelectedPosId(seller.pos_id || '');
        setIsModalOpen(true);
    };

    const handleBranchChange = (e) => {
        setSelectedBranchId(e.target.value);
        setSelectedPosId(''); // Reset POS when branch changes
    };

    const confirmDelete = () => {
        if (sellerToDelete) {
            deleteMutation.mutate(sellerToDelete.id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Catálogo de Vendedores</h2>
                    <p className="text-slate-500 font-medium font-spanish">Gestiona el personal de ventas y sus accesos al POS</p>
                </div>
                <button
                    onClick={() => { setSelectedSeller(null); setSelectedBranchId(''); setSelectedPosId(''); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <UserPlus size={20}/>
                    <span>Nuevo Vendedor</span>
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre..." 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all outline-none"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            <Table 
                headers={['Vendedor', 'Sucursal / POS', 'Estado', 'Acciones']}
                data={data?.data || []}
                isLoading={isLoading}
                renderRow={(seller) => (
                    <tr key={seller.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase">
                                    {seller.nombre.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900">{seller.nombre}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PIN: ****</span>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700">{seller.branch_name || 'Sin sucursal'}</span>
                                <span className="text-xs text-slate-500">{seller.pos_name || 'Sin POS'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <button
                                onClick={() => toggleStatusMutation.mutate({ id: seller.id, status: seller.status })}
                                className={`group flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${
                                    seller.status === 'activo' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${seller.status === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                {seller.status}
                                <Power size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </button>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => handleEdit(seller)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Editar"><Edit size={18}/></button>
                                <button onClick={() => setSellerToDelete(seller)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Eliminar"><Trash2 size={18}/></button>
                            </div>
                        </td>
                    </tr>
                )}
            />

            {data?.pagination && (
                <Pagination 
                    currentPage={page}
                    totalPages={data.pagination.totalPages}
                    onPageChange={setPage}
                    totalItems={data.pagination.total}
                />
            )}

            {/* Modal de Creación/Edición */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedSeller ? "Editar Vendedor" : "Nuevo Vendedor"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input name="nombre" defaultValue={selectedSeller?.nombre} placeholder="Ej: Juan Pérez" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all font-medium" required />
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña (PIN)</label>
                        <input name="password" type="password" defaultValue={selectedSeller?.password} placeholder="Ej: 1234" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all font-mono" required />
                        <p className="text-[10px] text-slate-400 ml-1 italic font-spanish">Debe ser única por sucursal</p>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                name="allow_price_edit" 
                                defaultChecked={selectedSeller?.allow_price_edit} 
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 font-spanish">Permitir editar precio</span>
                            <span className="text-[10px] text-slate-500 font-spanish">El vendedor podrá modificar el precio unitario en el POS</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Sucursal</label>
                            <select 
                                name="branch_id" 
                                value={selectedBranchId}
                                onChange={handleBranchChange}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all cursor-pointer" 
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Punto de Venta</label>
                            <select
                                name="pos_id"
                                value={selectedPosId}
                                onChange={(e) => setSelectedPosId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!selectedBranchId}
                            >
                                <option value="">Seleccionar...</option>
                                {filteredPos.length > 0 ? (
                                    filteredPos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>)
                                ) : selectedPosId ? (
                                    <option value={selectedPosId} disabled>Cargando POS...</option>
                                ) : null}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {selectedSeller ? 'Guardar Cambios' : 'Crear Vendedor'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Confirmación de Eliminación */}
            <Modal isOpen={!!sellerToDelete} onClose={() => setSellerToDelete(null)} title="Confirmar Eliminación">
                <div className="space-y-4">
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex gap-3 text-rose-700">
                        <Trash2 size={24} className="shrink-0" />
                        <div>
                            <p className="font-bold">¿Estás seguro?</p>
                            <p className="text-sm opacity-90 font-spanish">Estás a punto de eliminar al vendedor <strong>{sellerToDelete?.nombre}</strong>. Esta acción no se puede deshacer.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setSellerToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all">Cancelar</button>
                        <button 
                            onClick={confirmDelete} 
                            disabled={deleteMutation.isPending}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
                        >
                            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar Vendedor'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Sellers;
