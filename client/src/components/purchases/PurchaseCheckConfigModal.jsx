import { Loader2, RefreshCw, Save } from 'lucide-react';
import Modal from '../ui/Modal';

const PurchaseCheckConfigModal = ({
    isOpen,
    onClose,
    branches = [],
    configBranchId,
    setConfigBranchId,
    configData,
    configRrsId,
    setConfigRrsId,
    configCodDestino,
    setConfigCodDestino,
    onSyncProviders,
    isSyncing,
    onSaveConfig,
    isSavingConfig
}) => {
    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2.5 sm:py-3 px-3.5 sm:px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Configuración RRS — Chq Contado"
            maxWidth="max-w-xl"
        >
            <div className="space-y-4 sm:space-y-5">
                <div>
                    <label className={`${labelCls} block mb-1`}>Sucursal</label>
                    <select 
                        value={configBranchId} 
                        onChange={(e) => setConfigBranchId(e.target.value)} 
                        className={inputCls}
                    >
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                {configData && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`${labelCls} block mb-1`}>ID Empresa RRS</label>
                                <input 
                                    type="text" 
                                    value={configRrsId} 
                                    onChange={(e) => setConfigRrsId(e.target.value)}
                                    placeholder="Ej: 014" 
                                    className={inputCls} 
                                />
                            </div>
                            <div>
                                <label className={`${labelCls} block mb-1`}>Código Destino</label>
                                <input 
                                    type="text" 
                                    value={configCodDestino} 
                                    onChange={(e) => setConfigCodDestino(e.target.value)}
                                    placeholder="Ej: 01" 
                                    className={inputCls} 
                                />
                            </div>
                        </div>

                        {configData.config && (
                            <>
                                <hr className="border-slate-200" />
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <p className="text-[11px] font-bold text-slate-700 uppercase">Sincronizar Proveedores</p>
                                    <p className="text-[10px] text-slate-500 leading-relaxed">
                                        Sincroniza todos los proveedores del sistema con RRS (db_system_rrs).
                                        El match se hace por NIT, NRC o código generado.
                                    </p>
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={onSyncProviders}
                                            disabled={isSyncing}
                                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 active:scale-95"
                                        >
                                            {isSyncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Proveedores'}</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={onClose}
                        disabled={isSavingConfig}
                        className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs uppercase tracking-wider text-center"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={onSaveConfig}
                        disabled={isSavingConfig}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                    >
                        {isSavingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>{isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseCheckConfigModal;