import { useState } from 'react';
import { Play, CheckCircle2, FileText, Activity, ShieldCheck, Sparkles } from 'lucide-react';

export default function CompanyDteTestTable({
    tests = [],
    onRunSingle,
    isRunning,
    runningTestKey
}) {
    const [quantities, setQuantities] = useState({});
    const [filter, setFilter] = useState('all');

    const handleQtyChange = (key, val, maxPending) => {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 1) {
            setQuantities(prev => ({ ...prev, [key]: 1 }));
        } else {
            setQuantities(prev => ({ ...prev, [key]: Math.min(parsed, maxPending || 999) }));
        }
    };

    const getQty = (test) => {
        if (quantities[test.key] !== undefined) return quantities[test.key];
        return test.pending > 0 ? Math.min(test.pending, 10) : 1;
    };

    const filteredTests = tests.filter(t => {
        if (filter === 'mandatory') return t.isMandatory;
        if (filter === 'pending') return t.pending > 0;
        if (filter === 'completed') return t.isFinished;
        return true;
    });

    return (
        <div className="space-y-3">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filter === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Todos ({tests.length})
                    </button>
                    <button
                        onClick={() => setFilter('mandatory')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            filter === 'mandatory' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Sparkles size={12} />
                        <span>Obligatorios * (3)</span>
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filter === 'pending' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Pendientes ({tests.filter(t => t.pending > 0).length})
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filter === 'completed' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Completados ({tests.filter(t => t.isFinished).length})
                    </button>
                </div>

                <div className="text-[11px] text-slate-500 hidden sm:block">
                    Total: <span className="font-bold text-slate-700">{filteredTests.length}</span> documentos / eventos
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2.5">Documento Tributario / Evento</th>
                                <th className="px-4 py-2.5 text-center w-28">Pruebas</th>
                                <th className="px-4 py-2.5 min-w-[180px]">Progreso en Hacienda</th>
                                <th className="px-4 py-2.5 text-right w-44">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTests.map((test) => {
                                const isCurrentRunning = isRunning && runningTestKey === test.key;
                                const qty = getQty(test);

                                return (
                                    <tr 
                                        key={test.key} 
                                        className={`transition-colors hover:bg-slate-50/80 ${
                                            isCurrentRunning ? 'bg-indigo-50/50' : test.isFinished ? 'bg-emerald-50/20' : ''
                                        }`}
                                    >
                                        {/* Name & Badge */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    test.isFinished ? 'bg-emerald-100 text-emerald-700' :
                                                    test.isMandatory ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {test.category === 'evento' ? <Activity size={14} /> : <FileText size={14} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                                        <span>{test.name}</span>
                                                        {test.isMandatory && (
                                                            <span className="text-amber-500 font-black text-sm leading-none" title="Obligatorio">*</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                                            {test.code}
                                                        </span>
                                                        {test.isMandatory && (
                                                            <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                                Obligatorio
                                                            </span>
                                                        )}
                                                        {test.category === 'evento' && (
                                                            <span className="text-[9px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded">
                                                                Evento MH
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Counter numbers */}
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`text-xs font-bold ${
                                                test.isFinished ? 'text-emerald-600' : test.completed > 0 ? 'text-indigo-600' : 'text-slate-600'
                                            }`}>
                                                {test.completed}
                                            </span>
                                            <span className="text-slate-400 text-xs font-medium"> / {test.required}</span>
                                        </td>

                                        {/* Progress Bar */}
                                        <td className="px-4 py-3">
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-500 font-medium">
                                                        {test.isFinished ? '100% Completado' : `${test.pending} faltantes`}
                                                    </span>
                                                    <span className={`font-bold ${test.isFinished ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                        {test.percentage}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                    <div 
                                                        className={`h-full transition-all duration-500 rounded-full ${
                                                            test.isFinished ? 'bg-emerald-500' :
                                                            test.isMandatory ? 'bg-gradient-to-r from-amber-500 to-indigo-500' :
                                                            'bg-indigo-500'
                                                        }`}
                                                        style={{ width: `${test.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {!test.isFinished && (
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={test.pending || 1}
                                                        value={qty}
                                                        onChange={(e) => handleQtyChange(test.key, e.target.value, test.pending)}
                                                        disabled={isRunning}
                                                        className="w-12 px-1.5 py-1 text-xs text-center border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                                                        title="Cantidad a emitir"
                                                    />
                                                )}
                                                <button
                                                    onClick={() => onRunSingle(test, qty)}
                                                    disabled={isRunning}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs disabled:opacity-50 disabled:pointer-events-none ${
                                                        test.isFinished 
                                                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' 
                                                            : test.isMandatory
                                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                    }`}
                                                >
                                                    {isCurrentRunning ? (
                                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : test.isFinished ? (
                                                        <CheckCircle2 size={13} className="text-emerald-600" />
                                                    ) : (
                                                        <Play size={13} className="fill-current" />
                                                    )}
                                                    <span>{test.isFinished ? 'Re-emitir' : `Generar ${qty}`}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Note matching user's image */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-amber-900 text-xs font-medium">
                <ShieldCheck size={16} className="text-amber-600 flex-shrink-0" />
                <span>
                    <strong>(*)</strong> Las pruebas para los documentos marcados con &apos;*&apos; (Factura, Crédito Fiscal y Nota de Crédito), son de <strong>obligatorio cumplimiento</strong>, previo a la solicitud de autorización ante el Ministerio de Hacienda.
                </span>
            </div>
        </div>
    );
}
