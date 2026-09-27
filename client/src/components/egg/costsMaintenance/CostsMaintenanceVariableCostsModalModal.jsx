import Money, { MoneyInput } from '../../ui/Money';
import {
    Plus,
    XCircle,
    Trash2
} from 'lucide-react';


export default function CostsMaintenanceVariableCostsModalModal({ model, open = model.variableCostsModal, onClose = () => model.setVariableCostsModal(null) }) {
    const { costConcepts, variableCostsModal, setVariableCostsModal, variableCosts, newVarCost, setNewVarCost, addVariableCost, deleteVariableCost } = model;
    if (!open) return null;
    return (<>{variableCostsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">Costos Variables por Lote</h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-600">
                            Lote: <strong className="text-slate-900 capitalize">{variableCostsModal.product_type}</strong> ({variableCostsModal.presentation})
                        </p>
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Costos Fijos Asignados</div>
                            {(Array.isArray(costConcepts) ? costConcepts : []).map(cc => (
                                <div key={cc.id} className="flex justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                                    <span className="text-slate-600 font-medium">{cc.concept_name}</span>
                                    <span className="font-bold text-slate-900">
                                        <Money value={cc.default_value} />
                                    </span>
                                </div>
                            ))}
                            <div className="text-[10px] font-bold text-slate-500 uppercase pt-2">Costos Variables del Lote</div>
                            {(Array.isArray(variableCosts) ? variableCosts : []).map(vc => (
                                <div key={vc.id} className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 text-xs">
                                    <span className="text-indigo-900 font-semibold">{vc.concept_name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-indigo-700">
                                            <Money value={vc.amount} />
                                        </span>
                                        <button onClick={() => deleteVariableCost(vc.id)} className="text-rose-600 hover:text-rose-700">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <MoneyInput
                                    type="text"
                                    value={newVarCost.concept_name}
                                    onChange={(e) => setNewVarCost({ ...newVarCost, concept_name: e.target.value })}
                                    placeholder="Concepto (ej. Flete extra, Muestreo)"
                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <div className="w-28">
                                    <MoneyInput
                                        value={newVarCost.amount}
                                        onChange={(e) => setNewVarCost({ ...newVarCost, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold text-right focus:outline-none"
                                        step="0.01"
                                    />
                                </div>
                                <button onClick={addVariableCost} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button onClick={() => setVariableCostsModal(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
