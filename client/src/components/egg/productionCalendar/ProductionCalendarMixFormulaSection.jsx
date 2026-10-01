import { Split } from 'lucide-react';

export default function ProductionCalendarMixFormulaSection({ formData }) {
    const mix = formData.mix_formula_json || {};

    return (
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Desglose de Mezcla / Formulación BOM
                    </span>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    Sólidos Esperados: {formData.target_solids_pct}%
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Huevo Cáscara Estimado:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                        {mix.raw_egg_boxes || 0} cajas
                    </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Huevo Líquido Base:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                        {mix.raw_liquid_lbs?.toLocaleString() || 0} Lbs
                    </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">MP liquida A:</span>
                    <span className="font-extrabold text-emerald-600 text-sm">
                        {mix.water_h2o_lbs?.toLocaleString() || 0} Lbs
                    </span>
                    {mix.water_bottles > 0 && (
                        <span className="text-[10px] text-slate-400 block">
                            (~{mix.water_bottles} garrafas)
                        </span>
                    )}
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Ácido Cítrico Estabilizador:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                        {mix.citric_acid_lbs || '0.00'} Lbs
                    </span>
                </div>
            </div>

            {mix.notes && (
                <p className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100/80 leading-relaxed">
                    <strong>Instrucciones Operativas de Mezcla:</strong> {mix.notes}
                </p>
            )}
        </div>
    );
}
