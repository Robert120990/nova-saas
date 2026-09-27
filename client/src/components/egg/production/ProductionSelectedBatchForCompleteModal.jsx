



export default function ProductionSelectedBatchForCompleteModal({ model, open = model.selectedBatchForComplete, onClose = () => model.setSelectedBatchForComplete(null), onSave = model.handleCompleteBatch }) {
    const { selectedBatchForComplete, completeForm, setCompleteForm, isSubmitting, productConfig } = model;
    if (!open) return null;
    return (<>{selectedBatchForComplete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-6 text-slate-900">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">Balance de Masas y Cierre de Lote</h3>
                            <p className="text-xs text-slate-500 mt-1">Lote: <b>{selectedBatchForComplete.batch_uuid}</b></p>
                        </div>
                        <div className="h-px bg-slate-100" />

                        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Entrada</span>
                                <span className="text-xs font-bold text-slate-900">{parseFloat(selectedBatchForComplete.input_weight_lbs || 0).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Esperado ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).yield_pct || 87}%)</span>
                                <span className="text-xs font-bold text-indigo-600">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * (() => { const cfg = productConfig.find(c => c.product_type === selectedBatchForComplete.product_type) || {}; return parseFloat(cfg.yield_pct || 87) / 100; })()).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Cáscara/Merma ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_shell_pct || 13}%+{(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_loss_pct || 0}%)</span>
                                <span className="text-xs font-bold text-slate-600">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * (() => { const cfg = productConfig.find(c => c.product_type === selectedBatchForComplete.product_type) || {}; return (parseFloat(cfg.waste_shell_pct || 13) + parseFloat(cfg.waste_loss_pct || 0)) / 100; })()).toLocaleString()} Lbs</span>
                            </div>
                        </div>

                        <form onSubmit={onSave} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Rendimiento Líquido ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).yield_pct || 87}%)</label>
                                <input
                                    type="number"
                                    value={completeForm.yield_liquid_lbs}
                                    onChange={(e) => setCompleteForm({ ...completeForm, yield_liquid_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 10320"
                                    step="0.01"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Cáscara ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_shell_pct || 13}%)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_shell_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_shell_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 1440"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Merma ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_loss_pct || 0}%)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_loss_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_loss_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 240"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            {/* Métricas en tiempo real de Balance: Rendimiento por caja y Líquido + Envasado */}
                            {(() => {
                                const inpLbs = parseFloat(selectedBatchForComplete?.input_weight_lbs || 0);
                                const bxs = selectedBatchForComplete?.total_boxes || Math.round(inpLbs / 30) || 1;
                                const curLiquid = parseFloat(completeForm.yield_liquid_lbs || 0);
                                const curPkg = parseFloat(selectedBatchForComplete?.packaged_weight_lbs || 0);
                                const yieldPerBox = bxs > 0 ? (curLiquid / bxs).toFixed(1) : '0.0';
                                const liquidPlusPackaged = curLiquid + curPkg;
                                const totalYieldPct = inpLbs > 0 ? ((liquidPlusPackaged / inpLbs) * 100).toFixed(1) : '0.0';

                                return (
                                    <div className="grid grid-cols-3 gap-2 bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">Rend. / Caja</span>
                                            <span className="text-xs font-black text-blue-900">{yieldPerBox} Lbs/Cja</span>
                                            <span className="text-[9px] text-blue-500 block">({bxs} cajas)</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">Líq. + Envasado</span>
                                            <span className="text-xs font-black text-blue-900">{liquidPlusPackaged.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                            <span className="text-[9px] text-blue-500 block">{curPkg > 0 ? `(${curPkg.toLocaleString()} env.)` : 'sin envasar'}</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">% Rend. Total</span>
                                            <span className="text-xs font-black text-blue-900">{totalYieldPct}%</span>
                                            <span className="text-[9px] text-blue-500 block">sobre entrada</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    Guardar & Cerrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
