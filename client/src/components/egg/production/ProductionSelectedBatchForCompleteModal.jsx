import { ShieldCheck, Lock } from 'lucide-react';

export default function ProductionSelectedBatchForCompleteModal({
    model,
    open = model.selectedBatchForComplete,
    onClose = () => model.setSelectedBatchForComplete(null),
    onSave = model.handleCompleteBatch
}) {
    const {
        selectedBatchForComplete,
        completeForm,
        setCompleteForm,
        isSubmitting,
        productConfig,
        isAdmin,
        canManageLots
    } = model;

    if (!open) return null;

    const isFinalized = !!selectedBatchForComplete?.completed_at;
    const canSupervise = isAdmin || canManageLots;

    const configs = Array.isArray(productConfig) ? productConfig : [];
    const pType = (selectedBatchForComplete?.product_type || '').toLowerCase();
    const isCoproduct = Boolean(selectedBatchForComplete?.is_coproduct || selectedBatchForComplete?.parent_batch_id);
    const isClara = pType.includes('clara');
    const isYema = pType.includes('yema');

    const matchedConfig = configs.find(c => (c.product_type || '').toLowerCase() === pType) || {};
    const defaultYieldPct = isClara ? 56 : isYema ? 32 : 87;
    const defaultShellPct = isCoproduct ? 0 : (isClara || isYema ? 13 : 13);
    const defaultLossPct = isClara || isYema ? 1.5 : 0;

    const cfgYieldPct = parseFloat(matchedConfig.yield_pct ?? defaultYieldPct);
    const cfgShellPct = parseFloat(matchedConfig.waste_shell_pct ?? defaultShellPct);
    const cfgLossPct = parseFloat(matchedConfig.waste_loss_pct ?? defaultLossPct);

    const inputWeight = parseFloat(selectedBatchForComplete?.input_weight_lbs || 0);
    const expectedYieldLbs = (inputWeight * (cfgYieldPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const expectedWasteLbs = (inputWeight * ((cfgShellPct + cfgLossPct) / 100)).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return (
        <>
            {selectedBatchForComplete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto space-y-4 sm:space-y-6 text-slate-900">
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                                    Balance de Masas y Cierre de Lote
                                </h3>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {isCoproduct && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                            🔗 Co-Producto (Separación)
                                        </span>
                                    )}
                                    {isFinalized && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            Finalizado
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Lote: <b>{selectedBatchForComplete.batch_uuid}</b> ({selectedBatchForComplete.product_type})</p>
                        </div>
                        <div className="h-px bg-slate-100" />

                        {isFinalized && (
                            <div className={`p-3.5 rounded-xl border text-xs ${canSupervise ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-rose-50/80 border-rose-200 text-rose-900'}`}>
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    {canSupervise ? <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <Lock className="w-4 h-4 text-rose-600 shrink-0" />}
                                    <span>{canSupervise ? 'Modo de Corrección Supervisada (Lote Finalizado)' : 'Lote Finalizado - Requiere Autorización Supervisada'}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                    {canSupervise 
                                        ? 'Usted está autenticado como Administrador/Supervisor. Puede modificar el balance de masas; la corrección se registrará con su usuario en la bitácora de auditoría.' 
                                        : 'Este lote ya fue completado. Para modificar el balance de masas, un Supervisor o Administrador debe autorizar la operación introduciendo su contraseña a continuación.'}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Entrada</span>
                                <span className="text-xs font-bold text-slate-900">{inputWeight.toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Esperado ({cfgYieldPct}%)</span>
                                <span className="text-xs font-bold text-indigo-600">~{expectedYieldLbs} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Cáscara/Merma ({cfgShellPct}%+{cfgLossPct}%)</span>
                                <span className="text-xs font-bold text-slate-600">~{expectedWasteLbs} Lbs</span>
                            </div>
                        </div>

                        <form onSubmit={onSave} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Rendimiento Líquido ({cfgYieldPct}%)</label>
                                <input
                                    type="number"
                                    value={completeForm.yield_liquid_lbs}
                                    onChange={(e) => setCompleteForm({ ...completeForm, yield_liquid_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 10320"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Cáscara ({cfgShellPct}%)</label>
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
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Merma ({cfgLossPct}%)</label>
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

                            {/* Métricas en tiempo real de Balance */}
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

                            {/* Contraseña de supervisor si no tiene permisos directos */}
                            {isFinalized && !canSupervise && (
                                <div className="space-y-1.5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                                    <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                                        <Lock size={12} className="text-amber-600" />
                                        Contraseña de Supervisor para Autorizar
                                    </label>
                                    <input
                                        type="password"
                                        value={completeForm.supervisor_password || ''}
                                        onChange={(e) => setCompleteForm({ ...completeForm, supervisor_password: e.target.value })}
                                        placeholder="Ingrese contraseña de Administrador o Supervisor"
                                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        required
                                    />
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 text-center justify-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full sm:w-auto justify-center px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm ${
                                        isFinalized ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'
                                    }`}
                                >
                                    {isSubmitting ? 'Guardando...' : (isFinalized ? 'Guardar Corrección Supervisada' : 'Guardar & Cerrar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
