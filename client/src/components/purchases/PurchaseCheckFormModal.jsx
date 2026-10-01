import { Loader2, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import SearchableSelect from '../ui/SearchableSelect';

const PurchaseCheckFormModal = ({
    isOpen,
    onClose,
    isEditing,
    isSaving,
    branches = [],
    branchId,
    setBranchId,
    fecha,
    setFecha,
    providerId,
    setProviderId,
    providerNombre,
    monto,
    setMonto,
    destino,
    setDestino,
    loadProvidersOptions,
    onSave
}) => {
    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2.5 sm:py-3 px-3.5 sm:px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { if (!isSaving) onClose(); }}
            title={isEditing ? 'Editar Chq Contado' : 'Nuevo Chq Contado'}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                        <label className={`${labelCls} block mb-1`}>Sucursal</label>
                        <select 
                            value={branchId} 
                            onChange={(e) => setBranchId(e.target.value)} 
                            className={inputCls}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Fecha</label>
                        <input 
                            type="date" 
                            value={fecha} 
                            onChange={(e) => setFecha(e.target.value)} 
                            className={inputCls} 
                        />
                    </div>
                </div>

                <div>
                    <label className={`${labelCls} block mb-1`}>Proveedor</label>
                    <SearchableSelect
                        loadOptions={loadProvidersOptions}
                        value={providerId}
                        onChange={(e) => setProviderId(e.target.value)}
                        valueKey="id"
                        labelKey="nombre"
                        placeholder="BUSCAR PROVEEDOR..."
                        codeKey="nrc"
                        codeLabel="NRC"
                        selectedLabel={providerNombre}
                        dropdownWidth={420}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                        <label className={`${labelCls} block mb-1.5`}>Monto ($)</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00"
                            className={inputCls} 
                        />
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Destino</label>
                        <select 
                            value={destino} 
                            onChange={(e) => setDestino(e.target.value)} 
                            className={inputCls}
                        >
                            <option value="P">PISTA</option>
                            <option value="T">TIENDA</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        disabled={isSaving}
                        className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs uppercase tracking-wider text-center"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>{isSaving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseCheckFormModal;