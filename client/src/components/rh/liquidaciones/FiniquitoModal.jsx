
const FiniquitoModal = ({ open, onClose, onSubmit, model }) => {
    const { fieldCls, finiquitoMotivo, labelCls, setFiniquitoMotivo } = model;
    if (!open) return null;
    return (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={onClose}>
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">Generar Finiquito</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Ingrese el motivo de la liquidacion</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={labelCls}>Motivo de Liquidacion</label>
                                <input type="text" value={finiquitoMotivo} onChange={e => setFiniquitoMotivo(e.target.value)}
                                    className={fieldCls} autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }} />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button type="button" onClick={onClose}
                                className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                            <button type="button" onClick={onSubmit}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                                Generar Finiquito
                            </button>
                        </div>
                    </div>
                </div>
            
    );
};

export default FiniquitoModal;
