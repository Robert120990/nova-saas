import {
    Calculator,
    FileCheck
} from 'lucide-react';


export default function TraceabilitySolidsTab({ model }) {
    const { activeTab, solidsCalc, setSolidsCalc, calcResult, runLocalSolidsCalc } = model;

    return (<>{activeTab === 'solids' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 h-fit text-slate-900">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Calculator size={18} className="text-teal-600" />
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Parámetros de Dilución HE+</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Sólidos Base Medidos (Refractómetro %)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={solidsCalc.base_egg_solids}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, base_egg_solids: v });
                                        runLocalSolidsCalc(v, solidsCalc.target_solids, solidsCalc.batch_weight_lbs);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 24.2"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Sólidos Objetivo Deseados (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={solidsCalc.target_solids}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, target_solids: v });
                                        runLocalSolidsCalc(solidsCalc.base_egg_solids, v, solidsCalc.batch_weight_lbs);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 21.5"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Estándar recomendado: ≥ 21.0%</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso Total del Lote Objetivo (Libras)</label>
                                <input
                                    type="number"
                                    step="100"
                                    value={solidsCalc.batch_weight_lbs}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, batch_weight_lbs: v });
                                        runLocalSolidsCalc(solidsCalc.base_egg_solids, solidsCalc.target_solids, v);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 10000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileCheck size={16} className="text-indigo-600" />
                                Formulación & Balance Hídrico
                            </h3>
                            {calcResult && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${calcResult.is_compliant ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                    {calcResult.is_compliant ? 'Norma Cumplida' : 'Objetivo Fuera de Rango'}
                                </span>
                            )}
                        </div>

                        {calcResult && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">% liquido A</span>
                                        <span className="text-lg font-bold text-indigo-700">{calcResult.water_percentage.toFixed(2)}%</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">liquido requerido</span>
                                        <span className="text-lg font-bold text-teal-700">{calcResult.water_lbs.toFixed(0)} Lbs</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Garrafones</span>
                                        <span className="text-lg font-bold text-slate-900">{calcResult.water_garrafones.toFixed(1)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Ácido Cítrico 0.1%</span>
                                        <span className="text-lg font-bold text-amber-700">{calcResult.citric_acid_lbs.toFixed(2)} Lbs</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Detalle de la Mezcla:</h4>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                                        <span className="text-slate-600">Huevo Líquido Base Puro:</span>
                                        <strong className="text-slate-900">{calcResult.egg_base_lbs.toFixed(0)} Lbs</strong>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                                        <span className="text-slate-600">liquido A:</span>
                                        <strong className="text-teal-700">+{calcResult.water_lbs.toFixed(0)} Lbs ({calcResult.water_garrafones.toFixed(1)} garrafones)</strong>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-600">Estabilizador pH (Ácido Cítrico 0.1%):</span>
                                        <strong className="text-amber-700">{calcResult.citric_acid_lbs.toFixed(2)} Lbs</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}</>);
}
