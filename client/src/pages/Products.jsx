import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Barcode, Store, Monitor, ShieldCheck, Tag, Box, Search } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../components/ui/Pagination';

const Products = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [selectedPos, setSelectedPos] = useState([]);
    const [activeTab, setActiveTab] = useState('general');
    const [mappingSearch, setMappingSearch] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['products', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/products', { params: { search: debouncedSearch, page } })).data
    });

    const products = response.data || [];

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: allPos = [] } = useQuery({
        queryKey: ['pos'],
        queryFn: async () => (await axios.get('/api/pos')).data
    });

    // Catalogs
    const { data: catTipoItem = [] } = useQuery({
        queryKey: ['cat_011_tipo_item'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_011_tipo_item')).data
    });

    const { data: catUnidadMedida = [] } = useQuery({
        queryKey: ['cat_014_unidad_medida'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_014_unidad_medida')).data
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 5000 } })).data?.data || []
    });


    useEffect(() => {
        if (selectedProduct) {
            setSelectedBranches(selectedProduct.branches || []);
            setSelectedPos(selectedProduct.pos || []);
        } else {
            setSelectedBranches([]);
            setSelectedPos([]);
        }
    }, [selectedProduct]);

    // Fetch potential base products for mapping when editing/creating
    const { data: mappingProducts = [] } = useQuery({
        queryKey: ['products-mapping', mappingSearch],
        queryFn: async () => {
            if (mappingSearch.length < 2) return []; 
            const res = await axios.get('/api/products', { 
                params: { search: mappingSearch, limit: 20 } 
            });
            return res.data.data;
        },
        enabled: mappingSearch.length >= 2,
    });

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedProduct) return axios.put(`/api/products/${selectedProduct.id}`, data);
            return axios.post('/api/products', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            setIsModalOpen(false);
            setSelectedProduct(null);
            toast.success(selectedProduct ? 'Producto actualizado' : 'Producto creado');
        },
        onError: (error) => {
            console.error('Error al guardar producto:', error);
            const message = error.response?.data?.message || 'Error al guardar producto';
            toast.error(message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/products/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            toast.success('Producto eliminado');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Handle multi-select fields (checkboxes)
        data.branches = formData.getAll('branches');
        data.pos = formData.getAll('pos');
        data.tributes = formData.getAll('tributes');

        // Ensure numeric fields are correctly typed
        data.precio_unitario = parseFloat(data.precio_unitario);
        data.tipo_operacion = parseInt(data.tipo_operacion);
        data.tipo_combustible = parseInt(data.tipo_combustible);

        data.afecta_inventario = parseInt(data.afecta_inventario) === 1;
        data.costo = parseFloat(data.costo);
        data.stock_minimo = parseFloat(data.stock_minimo);
        data.permitir_existencia_negativa = parseInt(data.permitir_existencia_negativa) === 1;

        // Convert empty strings to null for foreign key fields
        if (data.category_id === '' || data.category_id === 'null') data.category_id = null;
        if (data.unidad_medida === '') data.unidad_medida = null;
        if (data.tipo_item === '') data.tipo_item = null;
        if (data.codigo_barra === '') data.codigo_barra = null;
        if (data.discount_from_id === '' || data.discount_from_id === 'null') data.discount_from_id = null;
        else data.discount_from_id = parseInt(data.discount_from_id);

        mutation.mutate(data);
    };

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setActiveTab('general');
        setIsModalOpen(true);
    };

    const toggleBranch = (id) => {
        setSelectedBranches(prev => {
            const isCurrentlySelected = prev.includes(id);
            const newBranches = isCurrentlySelected ? prev.filter(b => b !== id) : [...prev, id];
            
            if (isCurrentlySelected) {
                // Uncheck all POS belonging to this branch
                const posOfBranch = allPos.filter(p => p.branch_id === id).map(p => p.id);
                setSelectedPos(prevPos => prevPos.filter(pId => !posOfBranch.includes(pId)));
            }
            
            return newBranches;
        });
    };

    const togglePos = (id) => {
        setSelectedPos(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };


    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm text-[Spanish]">Gestión de inventario y sección fiscal</p>
                </div>
                <button 
                    onClick={() => { setSelectedProduct(null); setActiveTab('general'); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Producto</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por código, nombre o descripción..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Código', 'Nombre / Descripción', 'Precio Unit.', 'Detalles', 'Acciones']}
                    data={products}
                    isLoading={isLoading}
                    renderRow={(p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-6 py-4">
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{p.codigo}</span>
                                {p.codigo_barra && <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Barcode size={10}/> {p.codigo_barra}</div>}
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{p.nombre}</div>
                                <div className="text-xs text-slate-500 truncate max-w-xs">{p.descripcion}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">${parseFloat(p.precio_unitario).toFixed(2)}</div>
                                <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1">
                                    {p.category_name || 'Sin Categoría'}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block w-fit uppercase">
                                        {catUnidadMedida.find(um => um.code == p.unidad_medida)?.description || p.unidad_medida}
                                    </span>
                                    <span className="text-[10px] text-indigo-500 font-bold uppercase">
                                        {catTipoItem.find(ti => ti.code == p.tipo_item)?.description || p.tipo_item}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar producto?')) deleteMutation.mutate(p.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
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
                itemsOnPage={products.length}
                isLoading={isLoading}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedProduct ? 'Editar Producto' : 'Nuevo Producto'}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                    {/* Header with Product Name */}
                    {selectedProduct && (
                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                                {selectedProduct.nombre.substring(0, 2)}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Editando Producto</span>
                                <span className="text-sm font-bold text-slate-700 leading-none">{selectedProduct.nombre}</span>
                            </div>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        {[
                            { id: 'general', label: 'General', icon: <Box size={14} /> },
                            { id: 'fiscal', label: 'Fiscal', icon: <ShieldCheck size={14} /> },
                            { id: 'inventario', label: 'Inventario', icon: <Tag size={14} /> },
                            { id: 'disponibilidad', label: 'Disponibilidad', icon: <Store size={14} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-[400px] relative">
                        {/* General Information */}
                        <div className={`space-y-4 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'general' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Box size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Información General</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Código</label>
                                    <input name="codigo" defaultValue={selectedProduct?.codigo} required placeholder="PROD-001" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Código de Barras</label>
                                    <input name="codigo_barra" defaultValue={selectedProduct?.codigo_barra} placeholder="741000..." className={fieldCls} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Nombre del Producto</label>
                                <input name="nombre" defaultValue={selectedProduct?.nombre} required placeholder="Nombre descriptivo" className={fieldCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Descripción</label>
                                <textarea name="descripcion" defaultValue={selectedProduct?.descripcion} placeholder="Características, marca, modelo..." className={`${fieldCls} h-20 resize-none`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Precio Unitario</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                        <input name="precio_unitario" type="number" step="0.0001" defaultValue={selectedProduct?.precio_unitario} required className={`${fieldCls} pl-7`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Categoría</label>
                                    <select name="category_id" defaultValue={selectedProduct?.category_id || ''} className={fieldCls}>
                                        <option value="">Sin Categoría</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Unidad de Medida</label>
                                    <select name="unidad_medida" defaultValue={selectedProduct?.unidad_medida || '59'} className={fieldCls}>
                                        {catUnidadMedida.map(um => (
                                            <option key={um.code} value={um.code}>{um.description}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo de Ítem</label>
                                    <select name="tipo_item" defaultValue={selectedProduct?.tipo_item || '1'} className={fieldCls}>
                                        {catTipoItem.map(ti => (
                                            <option key={ti.code} value={ti.code}>{ti.description}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Fiscal Section */}
                        <div className={`space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'fiscal' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                <ShieldCheck size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Configuración Fiscal</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className={labelCls}>Tipo de Operación</label>
                                    <select name="tipo_operacion" defaultValue={selectedProduct?.tipo_operacion || 1} className={fieldCls}>
                                        <option value={1}>Gravada</option>
                                        <option value={2}>Exenta</option>
                                        <option value={3}>No Sujeta</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo de Combustible</label>
                                    <select name="tipo_combustible" defaultValue={selectedProduct?.tipo_combustible || 0} className={fieldCls}>
                                        <option value={0}>Ninguno</option>
                                        <option value={1}>Regular</option>
                                        <option value={2}>Especial</option>
                                        <option value={3}>Diesel</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3 text-blue-700">
                                <ShieldCheck size={20} className="shrink-0" />
                                <p className="text-xs font-medium">Esta configuración afecta cómo se reporta el producto en los Documentos Tributarios Electrónicos (DTE).</p>
                            </div>
                        </div>

                        {/* Inventory Section */}
                        <div className={`space-y-4 bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'inventario' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
                                <Tag size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Configuración de Inventario</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Estado del Producto</label>
                                    <select name="status" defaultValue={selectedProduct?.status || 'activo'} className={fieldCls}>
                                        <option value="activo">Activo</option>
                                        <option value="inactivo">Inactivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>¿Afecta Inventario?</label>
                                    <select name="afecta_inventario" defaultValue={selectedProduct?.afecta_inventario ?? 1} className={fieldCls}>
                                        <option value={1}>Sí</option>
                                        <option value={0}>No</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Costo Unitario</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                        <input name="costo" type="number" step="0.0001" defaultValue={selectedProduct?.costo ?? 0} className={`${fieldCls} pl-7`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Stock Mínimo</label>
                                    <input name="stock_minimo" type="number" step="0.01" defaultValue={selectedProduct?.stock_minimo ?? 0} className={fieldCls} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>¿Permitir Existencia Negativa?</label>
                                <select name="permitir_existencia_negativa" defaultValue={selectedProduct?.permitir_existencia_negativa ?? 1} className={fieldCls}>
                                    <option value={1}>Sí (Permitir vender sin stock)</option>
                                    <option value={0}>No (Control estricto)</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Vincular Inventario (Descontar de...)</label>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar producto base (código o nombre)..." 
                                        className={`${fieldCls} h-8 text-xs bg-slate-50 border-dashed`}
                                        value={mappingSearch}
                                        onChange={(e) => setMappingSearch(e.target.value)}
                                    />
                                    <select name="discount_from_id" defaultValue={selectedProduct?.discount_from_id || ''} className={fieldCls}>
                                        <option value="">No vincular (Manejo Normal)</option>
                                        
                                        {/* If we have a selected base product already, always show it */}
                                        {selectedProduct?.discount_from_id && (
                                            <option value={selectedProduct.discount_from_id}>
                                                [ACTUAL] {selectedProduct.discount_from_name || `ID ${selectedProduct.discount_from_id}`}
                                            </option>
                                        )}

                                        {/* Show search results */}
                                        {mappingProducts
                                            .filter(p => p.id !== selectedProduct?.id && p.id !== selectedProduct?.discount_from_id)
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                            ))
                                        }

                                        {/* Fallback to loaded products if search is empty */}
                                        {mappingSearch === '' && products
                                            .filter(p => p.id !== selectedProduct?.id && p.id !== selectedProduct?.discount_from_id)
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <p className="text-[10px] text-indigo-500 mt-1 font-medium italic">
                                    * Escribe al menos 2 caracteres arriba para cargar resultados del servidor.
                                </p>
                            </div>
                        </div>

                        {/* Availability Section */}
                        <div className={`space-y-6 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'disponibilidad' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Store size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Disponibilidad en Sucursales y POS</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                                        <Store size={14} className="text-indigo-600"/> Sucursales Autorizadas
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {branches.map(b => (
                                            <label key={b.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                selectedBranches.includes(b.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                            }`}>
                                                <input type="checkbox" name="branches" value={b.id} checked={selectedBranches.includes(b.id)} onChange={() => toggleBranch(b.id)} className="sr-only" />
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${selectedBranches.includes(b.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                    {selectedBranches.includes(b.id) && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                                <span className="text-[11px] font-bold truncate">{b.nombre}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                                        <Monitor size={14} className="text-indigo-600"/> Puntos de Venta (POS)
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {allPos.filter(p => selectedBranches.includes(p.branch_id)).map(p => (
                                            <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                selectedPos.includes(p.id) ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                            }`}>
                                                <input type="checkbox" name="pos" value={p.id} checked={selectedPos.includes(p.id)} onChange={() => togglePos(p.id)} className="sr-only" />
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${selectedPos.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                    {selectedPos.includes(p.id) && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                                <div className="flex flex-col text-xs font-bold truncate">
                                                    <span>{p.nombre}</span>
                                                </div>
                                            </label>
                                        ))}
                                        {selectedBranches.length === 0 && (
                                            <div className="col-span-2 py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecciona una sucursal para ver terminales</p>
                                            </div>
                                        )}
                                        {selectedBranches.length > 0 && allPos.filter(p => selectedBranches.includes(p.branch_id)).length === 0 && (
                                            <div className="col-span-2 py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay terminales configuradas en estas sucursales</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95">
                            {selectedProduct ? 'Guardar Cambios' : 'Registrar Producto'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Products;
