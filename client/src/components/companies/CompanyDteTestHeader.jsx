import { Zap, Building2, X, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CompanyDteTestHeader({ comp, mandatory, total, isRunning, onClose }) {
    return (
        <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Zap className="text-amber-500 fill-amber-500" size={20} />
                            <span>Pruebas de Acreditación DTE — Hacienda</span>
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            comp?.ambiente === '2' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                            {comp?.ambiente === '2' ? 'Ambiente: Producción' : 'Ambiente: Pruebas (Sandbox)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                        <span className="flex items-center gap-1 text-slate-700 font-bold">
                            <Building2 size={13} className="text-indigo-600" />
                            {comp?.razon_social}
                        </span>
                        <span>•</span>
                        <span>NIT: <strong className="font-mono text-slate-700">{comp?.nit}</strong></span>
                        <span>•</span>
                        <span>NRC: <strong className="font-mono text-slate-700">{comp?.nrc}</strong></span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    disabled={isRunning}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Production Environment Warning Banner */}
            {comp?.ambiente === '2' && (
                <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200/70 flex items-center gap-2 text-amber-900 text-xs">
                    <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
                    <span>
                        <strong>Atención:</strong> Esta empresa está configurada en <strong>Producción</strong>. Las pruebas de acreditación deben enviarse al ambiente de Pruebas (código 00 / cat_001 = 1) para que Hacienda incremente su contador oficial.
                    </span>
                </div>
            )}

            {/* Summary KPIs Banner */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Mandatory Progress */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            Pruebas Obligatorias (*)
                        </span>
                        <span className="text-xs font-black text-indigo-600">
                            {mandatory.completed} / {mandatory.required} ({mandatory.percentage}%)
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${mandatory.percentage}%` }}
                        />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Factura (90), Crédito Fiscal (75), Nota de Crédito (50)
                    </div>
                </div>

                {/* Total Progress */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            Total del Catálogo (15 Pruebas)
                        </span>
                        <span className="text-xs font-black text-emerald-600">
                            {total.completed} / {total.required} ({total.percentage}%)
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                            style={{ width: `${total.percentage}%` }}
                        />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Incluye 11 tipos DTE + 4 eventos especiales
                    </div>
                </div>
            </div>
        </>
    );
}
