import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Search, Trash } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { useConfirm } from '../../context/ConfirmContext';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
const labelCls = "block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1";

const ComboModal = ({
    isOpen,
    open,
    onClose,
    selectedCombo,
    branches = [],
    onSubmit
}) => {
    const isVisible = isOpen ?? open ?? false;
    const confirm = useConfirm();

    const [selectedBranch, setSelectedBranch] = useState('');
    const [comboItems, setComboItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [foundProducts, setFoundProducts] = useState([]);

    useDirtyTracker('combo-modal', isVisible && comboItems.length > 0);

    // Búsqueda de productos para el combo
    useEffect(() => {
        if (productSearch.length > 2 && selectedBranch) {
            const fetchProducts = async () => {
                try {
                    const res = await axios.get('/api/products', { 
                        params: { search: productSearch, limit: 5, branch_id: selectedBranch } 
                    });
                    setFoundProducts(res.data?.data || []);
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
            setComboItems((Array.isArray(selectedCombo.items) ? selectedCombo.items : []).map(item => ({
                product_id: item.product_id,
                name: item.product_name,
                price: item.precio_unitario,
                quantity: item.quantity
            })));
        } else {
            setSelectedBranch('');
            setComboItems([]);
        }
        setProductSearch('');
        setFoundProducts([]);
    }, [selectedCombo, isVisible]);

    if (!isVisible) return null;

    const handleBranchChange = async (newBranchId) => {
        if (comboItems.length > 0 && newBranchId !== selectedBranch) {
            const ok = await confirm({
                title: '¿Cambiar sucursal?',
                message: 'Al cambiar de sucursal se limpiarán los productos seleccionados en el combo. ¿Desea continuar?',
                confirmLabel: 'Sí, cambiar',
                variant: 'warning',
            });
            if (ok) {
                setComboItems([]);
                setSelectedBranch(newBranchId);
            }
        } else {
            setSelectedBranch(newBranchId);
        }
    };

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

    const handleFormSubmit = (e) => {
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
        onSubmit(data);
    };

    return (
        <Modal 
            isOpen={isVisible} 
            onClose={onClose} 
            title={selectedCombo ? 'Editar Combo' : 'Nuevo Combo'}
            maxWidth="max-w-4xl"
        >
            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Columna Izquierda: Datos del Combo */}
                <div className="lg:col-span-2 space-y-4 lg:border-r lg:border-slate-100 lg:pr-6 border-b border-slate-100 pb-6 lg:pb-0">
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
                            <span className="text-xs font-bold text-slate-500"><Money value={suggestedPrice} /></span>
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
                <div className="lg:col-span-3 lg:flex lg:flex-col lg:h-full lg:bg-slate-50/50 lg:-m-6 lg:p-6 lg:rounded-r-3xl">
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
                                        <span className="text-xs font-black text-indigo-600"><Money value={p.precio_unitario} /></span>
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
                                <div key={item.product_id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 sm:gap-4 group">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-700">{item.name}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">Unitario: <Money value={item.price} /></div>
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
                                            className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-slate-200 mt-4">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm w-full sm:w-auto">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 w-full sm:w-auto">
                            {selectedCombo ? 'Guardar Combo' : 'Crear Combo'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ComboModal;
