import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Barcode, Search, Package, Info, AlertCircle, Trash } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../components/ui/Pagination';

const Combos = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCombo, setSelectedCombo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Combo Form State
    const [selectedBranch, setSelectedBranch] = useState('');
    const [comboItems, setComboItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [foundProducts, setFoundProducts] = useState([]);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['combos', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/combos', { params: { search: debouncedSearch, page } })).data
    });

    const combos = response.data || [];

    // Búsqueda de productos para el combo
    useEffect(() => {
        if (productSearch.length > 2 && selectedBranch) {
            const fetchProducts = async () => {
                try {
                    const res = await axios.get('/api/products', { params: { search: productSearch, limit: 5, branch_id: selectedBranch } });
                    setFoundProducts(res.data.data || []);
                } catch (error) {
                    console.error('Error buscando productos:', error);
                }
            };
            fetchProducts();
        } else {
            setFoundProducts([]);
        }
    }, [productSearch, selectedBranch]);

    useEffect(() => {
        if (selectedCombo) {
            setSelectedBranch(selectedCombo.branch_id || '');
            setComboItems(selectedCombo.items.map(item => ({
                product_id: item.product_id,
                name: item.product_name,
                price: item.precio_unitario,
                quantity: item.quantity
            })));
        } else {
            setSelectedBranch('');
            setComboItems([]);
        }
    }, [selectedCombo]);

    const handleBranchChange = (newBranchId) => {
        if (comboItems.length > 0 && newBranchId !== selectedBranch) {
            if (confirm('Al cambiar de sucursal se limpiarán los productos seleccionados. ¿Continuar?')) {
                setComboItems([]);
                setSelectedBranch(newBranchId);
            }
        } else {
            setSelectedBranch(newBranchId);
        }
    };

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedCombo) return axios.put(`/api/combos/${selectedCombo.id}`, data);
            return axios.post('/api/combos', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['combos']);
            setIsModalOpen(false);
            setSelectedCombo(null);
            toast.success(selectedCombo ? 'Combo actualizado' : 'Combo creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar el combo');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/combos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['combos']);
            toast.success('Combo eliminado');
        }
    });

    const addProductToCombo = (product) => {
        if (comboItems.find(item => item.product_id === product.id)) {
            toast.warning('El producto ya está en el combo');
            return;
        }
        setComboItems([...comboItems, {
            product_id: product.id,
            name: product.nombre,
            price: product.precio_unitario,
            quantity: 1
        }]);
        setProductSearch('');
        setFoundProducts([]);
    };

    const updateItemQuantity = (productId, qty) => {
        setComboItems(items => items.map(item => 
            item.product_id === productId ? { ...item, quantity: parseFloat(qty) || 0 } : item
        ));
    };

    const removeItemFromCombo = (productId) => {
        setComboItems(items => items.filter(item => item.product_id !== productId));
    };

    const suggestedPrice = comboItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.items = comboItems;
        data.price = parseFloat(data.price);
        data.branch_id = selectedBranch;
        
        if (!selectedBranch) {
            toast.error('Debe seleccionar una sucursal');
            return;
        }
        if (data.items.length === 0) {
            toast.error('Debe agregar al menos un producto al combo');
            return;
        }
        mutation.mutate(data);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Combos de Productos</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Gestiona paquetes y promociones especiales</p>
                </div>
                <button 
                    onClick={() => { setSelectedCombo(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Combo</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o código de barras..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Sucursal', 'Código / Barras', 'Combo', 'Items', 'Precio Final', 'Acciones']}
                    data={combos}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-6 py-4">
                                <div className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider inline-block">
                                    {c.branch_name || 'Global'}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono font-bold"><Barcode size={10}/> {c.barcode}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{c.name}</div>
                                <div className="text-xs text-slate-500 truncate max-w-xs">{c.description}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {c.items?.map((item, i) => (
                                        <span key={i} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                            {item.quantity}x {item.product_name}
                                        </span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-black text-indigo-600">${parseFloat(c.price).toFixed(2)}</div>
                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">IVA Incluido</div>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => { setSelectedCombo(c); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar combo?')) deleteMutation.mutate(c.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
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
                itemsOnPage={combos.length}
                isLoading={isLoading}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedCombo ? 'Editar Combo' : 'Nuevo Combo'}
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-6">
                    {/* Columna Izquierda: Datos del Combo */}
                    <div className="col-span-2 space-y-4 border-r border-slate-100 pr-6">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Package size={16} className="text-indigo-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Detalles Básicos</h3>
                        </div>
                        
                        <div>
                            <label className={labelCls}>Sucursal de Disponibilidad</label>
                            <select 
                                value={selectedBranch} 
                                onChange={(e) => handleBranchChange(e.target.value)}
                                required 
                                className={fieldCls}
                            >
                                <option value="">Seleccione una sucursal...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Nombre del Combo</label>
                            <input name="name" defaultValue={selectedCombo?.name} required placeholder="Ej: Combo Familiar" className={fieldCls} />
                        </div>

                        <div>
                            <label className={labelCls}>Código de Barras (Único)</label>
                            <input name="barcode" defaultValue={selectedCombo?.barcode} required placeholder="COMB-001" className={fieldCls} />
                        </div>

                        <div>
                            <label className={labelCls}>Descripción</label>
                            <textarea name="description" defaultValue={selectedCombo?.description} placeholder="Breve descripción..." className={`${fieldCls} h-20 resize-none`} />
                        </div>

                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <label className={`${labelCls} text-indigo-600`}>Precio de Venta Final (Con IVA)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-lg font-black">$</span>
                                <input 
                                    name="price" 
                                    type="number" 
                                    step="0.01" 
                                    defaultValue={selectedCombo?.price} 
                                    required 
                                    className="w-full pl-8 pr-4 py-3 bg-white border-2 border-indigo-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xl font-black text-indigo-900" 
                                />
                            </div>
                            <div className="mt-2 flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Sugerido (Suma):</span>
                                <span className="text-xs font-bold text-slate-500">${suggestedPrice.toFixed(2)}</span>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Estado</label>
                            <select name="status" defaultValue={selectedCombo?.status || 'active'} className={fieldCls}>
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo</option>
                            </select>
                        </div>
                    </div>

                    {/* Columna Derecha: Items del Combo */}
                    <div className="col-span-3 flex flex-col h-full bg-slate-50/50 -m-6 p-6 rounded-r-3xl">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                            <Package size={16} className="text-indigo-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Productos Incluidos</h3>
                        </div>

                        {/* Buscador de productos */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder={selectedBranch ? "Escribe para buscar productos..." : "Selecciona una sucursal primero..."}
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                disabled={!selectedBranch}
                                className={`w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 text-sm font-medium shadow-sm transition-all ${!selectedBranch && 'opacity-50 cursor-not-allowed bg-slate-100'}`}
                            />
                            
                            {foundProducts.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
                                    {foundProducts.map(p => (
                                        <button 
                                            key={p.id}
                                            type="button"
                                            onClick={() => addProductToCombo(p)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{p.nombre}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{p.codigo}</span>
                                            </div>
                                            <span className="text-xs font-black text-indigo-600">${parseFloat(p.precio_unitario).toFixed(2)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de items seleccionados */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-[300px]">
                            {comboItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2">
                                    <Package size={48} strokeWidth={1} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Sin productos seleccionados</p>
                                </div>
                            ) : (
                                comboItems.map(item => (
                                    <div key={item.product_id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 group">
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-slate-700">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">Unitario: ${parseFloat(item.price).toFixed(2)}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Cantidad</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    min="0.1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemQuantity(item.product_id, e.target.value)}
                                                    className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeItemFromCombo(item.product_id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95">
                                {selectedCombo ? 'Guardar Combo' : 'Crear Combo'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Combos;
