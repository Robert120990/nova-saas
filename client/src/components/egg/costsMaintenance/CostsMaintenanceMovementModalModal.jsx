import {
    XCircle
} from 'lucide-react';


export default function CostsMaintenanceMovementModalModal({ model, open = model.movementModal, onClose = () => model.setMovementModal(null), onSave = model.handleMovementSubmit }) {
    const { movementModal, setMovementModal, movementForm, setMovementForm } = model;
    if (!open) return null;
    return (<>{movementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 border border-slate-200 shadow-2xl space-y-4 text-xs max-h-[92dvh] overflow-y-auto my-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="min-w-0 pr-2">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase leading-snug truncate">Movimiento de Envases</h3>
                                <p className="text-xs text-slate-500 font-medium truncate">{movementModal.customer_name}</p>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={onSave} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tipo de Movimiento</label>
                                <select
                                    value={movementForm.movement_type}
                                    onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="devolucion">Devolución a Planta (- Retorno de Envases Vacíos)</option>
                                    <option value="entrega">Entrega a Cliente (+ Despacho con Producto)</option>
                                    <option value="ajuste">Ajuste Manual de Inventario</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Cubetas Físicas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={movementForm.cubetas_qty}
                                        onChange={(e) => setMovementForm({ ...movementForm, cubetas_qty: e.target.value })}
                                        placeholder="Ej: 20"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tapaderas Físicas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={movementForm.tapaderas_qty}
                                        onChange={(e) => setMovementForm({ ...movementForm, tapaderas_qty: e.target.value })}
                                        placeholder="Ej: 18"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Desglose opcional por presentación */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                    Desglose por Peso Facturado (Opcional)
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">De 30 LB</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={movementForm.cubetas_30lb_qty || ''}
                                            onChange={(e) => {
                                                const v30 = e.target.value;
                                                const v32 = movementForm.cubetas_32lb_qty || 0;
                                                const sum = (parseInt(v30, 10) || 0) + (parseInt(v32, 10) || 0);
                                                setMovementForm({
                                                    ...movementForm,
                                                    cubetas_30lb_qty: v30,
                                                    cubetas_qty: sum > 0 ? sum : movementForm.cubetas_qty
                                                });
                                            }}
                                            placeholder="Cant. 30 LB"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">De 32 LB</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={movementForm.cubetas_32lb_qty || ''}
                                            onChange={(e) => {
                                                const v32 = e.target.value;
                                                const v30 = movementForm.cubetas_30lb_qty || 0;
                                                const sum = (parseInt(v30, 10) || 0) + (parseInt(v32, 10) || 0);
                                                setMovementForm({
                                                    ...movementForm,
                                                    cubetas_32lb_qty: v32,
                                                    cubetas_qty: sum > 0 ? sum : movementForm.cubetas_qty
                                                });
                                            }}
                                            placeholder="Cant. 32 LB"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Fecha del Movimiento</label>
                                <input
                                    type="date"
                                    value={movementForm.movement_date}
                                    onChange={(e) => setMovementForm({ ...movementForm, movement_date: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Documento de Referencia (Remisión / Recibo)</label>
                                <input
                                    type="text"
                                    value={movementForm.reference_document}
                                    onChange={(e) => setMovementForm({ ...movementForm, reference_document: e.target.value })}
                                    placeholder="Ej: Recibo de Retorno #145 / Remisión #R-4502"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Observaciones</label>
                                <textarea
                                    value={movementForm.notes}
                                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                                    placeholder="Condición de las cubetas, faltante de tapaderas rotas, etc..."
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm h-16"
                                />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setMovementModal(null)}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all text-center"
                                >
                                    Confirmar Movimiento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
