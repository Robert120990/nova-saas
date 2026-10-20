import { Percent, DollarSign, X } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { MoneyInput } from '../ui/Money';

const CustomerDiscountModal = ({
    isOpen,
    onClose,
    formData,
    setFormData,
    branches = [],
    loadCustomersOptions,
    loadProductsOptions,
    onSubmit,
    isSaving = false
}) => {
    if (!isOpen) return null;
    const isEditing = Boolean(formData.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none">
                            {isEditing ? 'Editar Regla de Descuento' : 'Nueva Regla Personalizada'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {isEditing ? 'Modifica el acuerdo comercial del cliente' : 'Configura un acuerdo comercial'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-slate-100 p-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all focus:outline-none"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-5">
                    <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-1.5 font-spanish">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Para la Sucursal</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-bold text-sm transition-all"
                                value={formData.branch_id}
                                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value, product_id: '', product_name: '' })}
                            >
                                <option value="">-- SELECCIONAR SUCURSAL --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 font-spanish">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Elegir Cliente</label>
                            <SearchableSelect
                                placeholder="BUSCAR CLIENTE..."
                                loadOptions={loadCustomersOptions}
                                value={formData.customer_id}
                                selectedLabel={formData.customer_name || null}
                                onChange={(e, opt) => setFormData({
                                    ...formData,
                                    customer_id: e.target.value,
                                    customer_name: opt?.nombre || formData.customer_name
                                })}
                                valueKey="id"
                                labelKey="nombre"
                                codeKey="numero_documento"
                                codeLabel="DOC"
                            />
                        </div>

                        <div className="space-y-1.5 font-spanish text-spanish">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Elegir Producto</label>
                            <SearchableSelect
                                placeholder={!formData.branch_id ? 'DEBE ELEGIR SUCURSAL PRIMERO...' : 'BUSCAR PRODUCTO ACTIVO...'}
                                loadOptions={loadProductsOptions}
                                value={formData.product_id}
                                selectedLabel={formData.product_name || null}
                                onChange={(e, opt) => setFormData({
                                    ...formData,
                                    product_id: e.target.value,
                                    product_name: opt?.nombre || formData.product_name
                                })}
                                valueKey="id"
                                labelKey="nombre"
                                codeKey="codigo"
                                codeLabel="SKU"
                                disabled={!formData.branch_id}
                            />
                            {!formData.branch_id && (
                                <p className="text-[9px] font-bold text-rose-400 uppercase italic animate-pulse">
                                    Debe seleccionar una sucursal para listar los productos disponibles.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                            <div className="space-y-1.5 font-spanish">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tipo Descuento</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, discount_type: 'PORCENTAJE' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                                            formData.discount_type === 'PORCENTAJE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                                        }`}
                                    >
                                        <Percent size={14} /> %
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, discount_type: 'VALOR' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                                            formData.discount_type === 'VALOR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                                        }`}
                                    >
                                        <DollarSign size={14} /> VALOR
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5 font-spanish">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Valor</label>
                                <MoneyInput
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-bold text-sm transition-all"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 bg-slate-50/50 -mx-8 -mb-8 px-8 py-6 border-t border-slate-50 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !formData.branch_id}
                            className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                        >
                            {isSaving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Aplicar Regla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomerDiscountModal;
