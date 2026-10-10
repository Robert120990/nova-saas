import Money from '../../ui/Money';


import {
    RefreshCw,
    XCircle,
    CheckCircle2,
    Users,
    Receipt
} from 'lucide-react';


export default function ConfigIsSyncModalOpenModal({ model, open = model.isSyncModalOpen, onClose = () => model.setIsSyncModalOpen(false), onSave = model.handleConfirmSync }) {
    const { MONTH_NAMES, isSyncModalOpen, setIsSyncModalOpen, syncParams, setSyncParams, syncData, isSyncing, syncPreviewLoading, fetchSyncPreview } = model;
    if (!open) return null;
    return (<>{isSyncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-3xl w-full max-h-[92dvh] overflow-y-auto text-slate-900 space-y-4 sm:space-y-6 my-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sm:pb-4">
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                                <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                                    <RefreshCw size={20} className="sm:w-[22px] sm:h-[22px]" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-xs sm:text-base font-bold text-slate-900 uppercase tracking-wide truncate">
                                        Cargar Costos de Nómina y Gastos
                                    </h2>
                                    <p className="text-[11px] sm:text-xs text-slate-500 truncate">Módulo Contable & Nómina RRHH - ANDELSA</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg shrink-0"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Parámetros de Consulta */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Año de Período</label>
                                <input
                                    type="number"
                                    value={syncParams.year}
                                    onChange={(e) => {
                                        const y = parseInt(e.target.value) || 2026;
                                        setSyncParams({ ...syncParams, year: y });
                                        fetchSyncPreview(syncParams.month, y, syncParams.projected_batches);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Mes de Operación</label>
                                <select
                                    value={syncParams.month}
                                    onChange={(e) => {
                                        const m = parseInt(e.target.value) || 1;
                                        setSyncParams({ ...syncParams, month: m });
                                        fetchSyncPreview(m, syncParams.year, syncParams.projected_batches);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold"
                                >
                                    {(Array.isArray(MONTH_NAMES) ? MONTH_NAMES : []).map((name, idx) => (
                                        <option key={idx + 1} value={idx + 1}>
                                            {name} ({idx + 1})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Lotes Proyectados en el Mes</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={syncParams.projected_batches}
                                    onChange={(e) => {
                                        const p = parseInt(e.target.value) || 1;
                                        setSyncParams({ ...syncParams, projected_batches: p });
                                        fetchSyncPreview(syncParams.month, syncParams.year, p);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-center"
                                />
                            </div>
                        </div>

                        {/* Vista Previa de Datos Extraídos */}
                        {syncPreviewLoading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Consultando planillas de nómina y gastos contables del sistema...
                            </div>
                        ) : syncData ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Planillas RRHH */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-indigo-600" />
                                                <span className="font-bold text-xs uppercase tracking-wide text-slate-800">Planillas de Nómina RRHH</span>
                                            </div>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                {syncData.payroll?.employee_count || 0} empleados
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between text-slate-600">
                                                <span>Total Sueldos Base:</span>
                                                <Money value={syncData.payroll?.total_base_salary || 0} className="font-semibold" />
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Bonificaciones / Percepciones:</span>
                                                <Money value={syncData.payroll?.total_bonuses || 0} className="font-semibold" />
                                            </div>
                                            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                                                <span>Total Nómina Mensual:</span>
                                                <Money value={syncData.payroll?.total_payroll || 0} className="text-indigo-700 font-black" />
                                            </div>
                                            <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-[11px]">
                                                <span>Mano de Obra por Lote:</span>
                                                <Money value={syncData.payroll?.cost_per_batch || 0} className="font-black" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gastos Operativos Contables */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={16} className="text-teal-600" />
                                                <span className="font-bold text-xs uppercase tracking-wide text-slate-800">Gastos Operativos Reales</span>
                                            </div>
                                            <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                                                {syncData.expenses?.category_breakdown?.length || 0} categorías
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                                            {syncData.expenses?.category_breakdown?.length > 0 ? (
                                                (Array.isArray(syncData.expenses.category_breakdown) ? syncData.expenses.category_breakdown : []).map((cat, i) => (
                                                    <div key={i} className="flex justify-between text-slate-600 text-[11px]">
                                                        <span className="truncate max-w-[180px]">{cat.categoria}:</span>
                                                        <Money value={cat.total} className="font-medium" />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic py-2">No se detectaron gastos registrados en este mes.</p>
                                            )}
                                        </div>
                                        <div className="border-t border-slate-100 pt-1.5">
                                            <div className="flex justify-between font-bold text-slate-900 text-xs mb-1">
                                                <span>Total Gastos Mensuales:</span>
                                                <Money value={syncData.expenses?.total_expenses || 0} className="text-teal-700 font-black" />
                                            </div>
                                            <div className="flex justify-between font-bold text-teal-700 bg-teal-50/70 p-2 rounded-lg border border-teal-100 text-[11px]">
                                                <span>Gastos CIF por Lote:</span>
                                                <Money value={syncData.expenses?.cost_per_batch || 0} className="font-black" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen Global de Sincronización */}
                                <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-indigo-300 block">Resumen de Costeo Indirecto (GIF)</span>
                                        <div className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                                            <span>Total Mensual: <Money value={syncData.summary?.total_monthly_costs || 0} className="text-emerald-400" /></span>
                                            <span className="text-xs text-slate-400 font-normal">/ {syncData.summary?.projected_batches || 20} lotes</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-emerald-300 block">Costo Fijo / Operativo por Lote</span>
                                        <div className="text-xl font-black text-emerald-400">
                                            <Money value={syncData.summary?.cost_per_batch || 0} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsSyncModalOpen(false)}
                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={isSyncing || syncPreviewLoading}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 text-center"
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Sincronizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Sincronizar Costeo</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
