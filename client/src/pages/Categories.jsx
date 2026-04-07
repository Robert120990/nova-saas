import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Tag, Search } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../components/ui/Pagination';

const Categories = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['categories', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/categories', { params: { search: debouncedSearch, page } })).data
    });

    const categories = response.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedCategory) return axios.put(`/api/categories/${selectedCategory.id}`, data);
            return axios.post('/api/categories', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            setIsModalOpen(false);
            setSelectedCategory(null);
            toast.success(selectedCategory ? 'Categoría actualizada' : 'Categoría creada');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar categoría');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            toast.success('Categoría eliminada');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('handleSubmit triggered in Categories.jsx');
        try {
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            console.log('DATA TO SAVE (CATEGORY):', data);
            mutation.mutate(data);
        } catch (error) {
            console.error('Error in handleSubmit (Categories):', error);
            toast.error('Error al procesar el formulario');
        }
    };

    const handleEdit = (category) => {
        setSelectedCategory(category);
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Categorías de Productos</h2>
                    <p className="text-slate-500 mt-1 font-medium">Clasificación para tu inventario</p>
                </div>
                <button 
                    onClick={() => { setSelectedCategory(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nueva Categoría</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o descripción..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Nombre', 'Descripción', 'Acciones']}
                    data={categories}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Tag size={16}/></div>
                                    <span className="font-bold text-slate-900">{c.name}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">{c.description || '-'}</td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar categoría?')) deleteMutation.mutate(c.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
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
                itemsOnPage={categories.length}
                isLoading={isLoading}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Nombre</label>
                        <input name="name" defaultValue={selectedCategory?.name} required placeholder="Electrónicos, Alimentos, etc." className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Descripción</label>
                        <textarea name="description" defaultValue={selectedCategory?.description} placeholder="Breve descripción de la categoría" className={`${fieldCls} h-24 resize-none`} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedCategory ? 'Guardar Cambios' : 'Registrar Categoría')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Categories;
