import { Clock, Flame, ShieldCheck } from 'lucide-react';

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

    // Manejo de actualización armonizando con campos HACCP requeridos
    const handleFieldChange = (field, value) => {
        onChange(field, value);

        // Si se actualiza temperatura del huevo, sincronizar temperature_c automáticamente
        if (field === 'temp_huevo_fin' || field === 'temp_huevo_inicio') {
            const valNum = parseFloat(value);
            if (!isNaN(valNum) && valNum > 0) {
                if (valNum > 90) {
                    // Viene en °F (ej. 146.8°F de la hoja oficial PRO:006) -> convertir a °C
                    const c = Math.round(((valNum - 32) * 5 / 9) * 10) / 10;
                    onChange('temperature_c', String(c));
                } else {
                    onChange('temperature_c', String(valNum));
                }
            }
        }

        // Si se actualiza tiempo V.B., sincronizar holding_time_seconds
        if (field === 'vb_tiempo_fin' || field === 'vb_tiempo_inicio') {
            const valNum = parseFloat(value);
            if (!isNaN(valNum) && valNum > 0) {
                onChange('holding_time_seconds', String(Math.round(valNum)));
            }
        }

        // Si se actualiza Booster, sincronizar pressure_psi
        if (field === 'vb_booster_fin' || field === 'vb_booster_inicio') {
            const valNum = parseFloat(value);
            if (!isNaN(valNum) && valNum > 0) {
                onChange('pressure_psi', String(valNum));
            }
        }

        // Si se actualiza Flujo, sincronizar flow_rate_gpm
        if (field === 'flujo_fin' || field === 'flujo_inicio') {
            const valNum = parseFloat(value);
            if (!isNaN(valNum) && valNum > 0) {
                onChange('flow_rate_gpm', String(valNum));
            }
        }
    };

    return (
        <div className={`${bgCls} border-2 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xs`}>
            {/* Cabecera del Lote */}
            <div className={`border-b ${borderCls} pb-2`}>
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase ${textCls} flex items-center gap-1.5`}>
                        <Flame size={14} className={isTeal ? 'text-teal-600' : 'text-indigo-600'} />
                        {title}
                    </span>
                    <span className={`text-[10px] font-bold ${badgeBg} px-2 py-0.5 rounded-full capitalize`}>
                        {batch?.product_type || 'Huevo Entero'}
                    </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className={`${guideText} font-semibold flex items-center gap-1`}>
                        <ShieldCheck size={12} />
                        HACCP Mínimo: {haccpGuide?.minTemp || '≥ 64.0°C'} ({haccpGuide?.time || '210 seg'})
                    </span>
                    {form.temperature_c && (
                        <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                            Temp Efectiva: <strong>{form.temperature_c}°C</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Tabla Oficial PRO:006 (Parámetros Inicio / Finalizo) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                <div className="min-w-[280px]">
                    <div className="grid grid-cols-12 bg-slate-100/90 text-[10px] font-black text-slate-700 uppercase tracking-wider p-2 border-b border-slate-200 text-center">
                        <span className="col-span-5 text-left pl-1">Parámetro (PRO:006)</span>
                        <span className="col-span-3 text-indigo-700">Inicio</span>
                        <span className="col-span-4 text-emerald-700">Finalizó</span>
                    </div>

                <div className="divide-y divide-slate-100 text-xs">
                    {/* Horario */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 hover:bg-slate-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            Horario
                        </span>
                        <div className="col-span-3">
                            <input
                                type="time"
                                value={form.start_time || ''}
                                onChange={(e) => handleFieldChange('start_time', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="time"
                                value={form.end_time || ''}
                                onChange={(e) => handleFieldChange('end_time', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* T° Agua */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 hover:bg-slate-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-slate-700">
                            T° Agua (°F)
                        </span>
                        <div className="col-span-3">
                            <input
                                type="number"
                                step="any"
                                placeholder="149"
                                value={form.temp_agua_inicio ?? ''}
                                onChange={(e) => handleFieldChange('temp_agua_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                step="any"
                                placeholder="156"
                                value={form.temp_agua_fin ?? ''}
                                onChange={(e) => handleFieldChange('temp_agua_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* T° Huevo */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 bg-amber-50/40 hover:bg-amber-50/70">
                        <span className="col-span-5 text-[11px] font-black text-amber-900 flex items-center gap-1">
                            <Flame size={12} className="text-amber-600" />
                            T° Huevo (°F) *
                        </span>
                        <div className="col-span-3">
                            <input
                                type="number"
                                step="any"
                                placeholder="146.8"
                                value={form.temp_huevo_inicio ?? ''}
                                onChange={(e) => handleFieldChange('temp_huevo_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                step="any"
                                placeholder="147.8"
                                value={form.temp_huevo_fin ?? ''}
                                onChange={(e) => handleFieldChange('temp_huevo_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* V.B. Tiempo */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 hover:bg-slate-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-slate-700">
                            V.B. Tiempo (seg)
                        </span>
                        <div className="col-span-3">
                            <input
                                type="number"
                                step="any"
                                placeholder="67.5"
                                value={form.vb_tiempo_inicio ?? ''}
                                onChange={(e) => handleFieldChange('vb_tiempo_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                step="any"
                                placeholder="67.5"
                                value={form.vb_tiempo_fin ?? ''}
                                onChange={(e) => handleFieldChange('vb_tiempo_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* V.B. Booster */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 hover:bg-slate-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-slate-700">
                            V.B. Booster (psi)
                        </span>
                        <div className="col-span-3">
                            <input
                                type="number"
                                step="any"
                                placeholder="65.5"
                                value={form.vb_booster_inicio ?? ''}
                                onChange={(e) => handleFieldChange('vb_booster_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                step="any"
                                placeholder="68.5"
                                value={form.vb_booster_fin ?? ''}
                                onChange={(e) => handleFieldChange('vb_booster_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Flujo */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 hover:bg-slate-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-slate-700">
                            Flujo (gpm)
                        </span>
                        <div className="col-span-3">
                            <input
                                type="number"
                                step="any"
                                placeholder="24.86"
                                value={form.flujo_inicio ?? ''}
                                onChange={(e) => handleFieldChange('flujo_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                step="any"
                                placeholder="24.86"
                                value={form.flujo_fin ?? ''}
                                onChange={(e) => handleFieldChange('flujo_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Empaque # 1 */}
                    <div className="grid grid-cols-12 items-center p-2 gap-1.5 bg-purple-50/40 hover:bg-purple-50/70">
                        <span className="col-span-5 text-[11px] font-bold text-purple-900">
                            Empaque # 1
                        </span>
                        <div className="col-span-3">
                            <input
                                type="time"
                                value={form.empaque_inicio || ''}
                                onChange={(e) => handleFieldChange('empaque_inicio', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-800 focus:border-purple-500"
                            />
                        </div>
                        <div className="col-span-4">
                            <input
                                type="time"
                                value={form.empaque_fin || ''}
                                onChange={(e) => handleFieldChange('empaque_fin', e.target.value)}
                                className="w-full px-1.5 py-1 text-center bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-800 focus:border-purple-500"
                            />
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            {/* Código Lote de Pasteurización */}
            <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Código Lote de Pasteurización
                </label>
                <input
                    type="text"
                    value={form.pasteurization_lot || ''}
                    onChange={(e) => handleFieldChange('pasteurization_lot', e.target.value)}
                    className={`w-full px-3 py-1.5 bg-white border ${borderCls} rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                    placeholder="Ej: PAST-01-274"
                />
            </div>
        </div>
    );
}
