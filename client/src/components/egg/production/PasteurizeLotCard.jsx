export default function PasteurizeLotCard({
    title,
    batch,
    haccpGuide,
    form,
    onChange,
    colorScheme = 'indigo'
}) {
    const isTeal = colorScheme === 'teal';
    const borderCls = isTeal ? 'border-teal-200' : 'border-indigo-200';
    const bgCls = isTeal ? 'bg-teal-50/50 border-teal-300' : 'bg-indigo-50/50 border-indigo-300';
    const textCls = isTeal ? 'text-teal-900' : 'text-indigo-900';
    const badgeBg = isTeal ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800';
    const guideText = isTeal ? 'text-teal-700' : 'text-indigo-700';

    return (
        <div className={`${bgCls} border-2 rounded-2xl p-4 space-y-3`}>
            <div className={`border-b ${borderCls} pb-2`}>
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase ${textCls}`}>
                        {title}
                    </span>
                    <span className={`text-[10px] font-bold ${badgeBg} px-2 py-0.5 rounded-full capitalize`}>
                        {batch?.product_type || 'huevo'}
                    </span>
                </div>
                <div className={`text-[11px] ${guideText} font-semibold mt-1`}>
                    HACCP Requerido: {haccpGuide.minTemp} ({haccpGuide.time})
                </div>
            </div>

            <div className="space-y-2.5">
                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Temperatura Pasteurización (°C) *
                    </label>
                    <input
                        type="number"
                        value={form.temperature_c}
                        onChange={(e) => onChange('temperature_c', e.target.value)}
                        className={`w-full px-3 py-1.5 bg-white border ${borderCls} rounded-xl text-xs font-bold`}
                        step="0.01"
                        placeholder="Ej: 64.5"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Tiempo Retención (Seg) *
                    </label>
                    <input
                        type="number"
                        value={form.holding_time_seconds}
                        onChange={(e) => onChange('holding_time_seconds', e.target.value)}
                        className={`w-full px-3 py-1.5 bg-white border ${borderCls} rounded-xl text-xs font-bold`}
                        placeholder="210"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Presión (PSI)</label>
                        <input
                            type="number"
                            value={form.pressure_psi}
                            onChange={(e) => onChange('pressure_psi', e.target.value)}
                            className={`w-full px-2 py-1.5 bg-white border ${borderCls} rounded-xl text-xs`}
                            step="0.01"
                            placeholder="48.0"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Caudal (GPM)</label>
                        <input
                            type="number"
                            value={form.flow_rate_gpm}
                            onChange={(e) => onChange('flow_rate_gpm', e.target.value)}
                            className={`w-full px-2 py-1.5 bg-white border ${borderCls} rounded-xl text-xs`}
                            step="0.01"
                            placeholder="12.5"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Código Lote Pasteurización</label>
                    <input
                        type="text"
                        value={form.pasteurization_lot}
                        onChange={(e) => onChange('pasteurization_lot', e.target.value)}
                        className={`w-full px-3 py-1.5 bg-white border ${borderCls} rounded-xl text-xs font-mono font-bold`}
                        placeholder="Ej: PAST-01-274"
                    />
                </div>
            </div>
        </div>
    );
}
