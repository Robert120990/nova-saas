import { SlidersHorizontal } from 'lucide-react';

const BiometricOvertimeRulesSection = ({ form, setForm }) => {
    return (
        <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/70 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    Reglas de Cálculo de Horas Extra y Compensación Semanal
                </h4>
                <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                    Aplicado en Cortes Quincenales y Exportación
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Modo de Jornada Diaria
                    </label>
                    <select
                        value={form.modo_calculo_jornada || 'neto_sin_almuerzo'}
                        onChange={(e) => setForm(prev => ({ ...prev, modo_calculo_jornada: e.target.value }))}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5 bg-white"
                    >
                        <option value="neto_sin_almuerzo">Neto (descuenta almuerzo vs 8h)</option>
                        <option value="bruto_con_almuerzo">Bruto Planta (Salida - Entrada vs 9h)</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Redondeo de Horas Extra
                    </label>
                    <select
                        value={Number(form.redondeo_horas_extra_minutos || 0)}
                        onChange={(e) => setForm(prev => ({ ...prev, redondeo_horas_extra_minutos: parseInt(e.target.value, 10) || 0 }))}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5 bg-white"
                    >
                        <option value={0}>Exacto (decimal sin redondeo)</option>
                        <option value={30}>Bloques de 30 min (0.5 h)</option>
                        <option value={15}>Bloques de 15 min (0.25 h)</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Umbral Redondeo (min)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="60"
                        disabled={!Number(form.redondeo_horas_extra_minutos || 0)}
                        value={form.umbral_redondeo_minutos ?? 15}
                        onChange={(e) => setForm(prev => ({ ...prev, umbral_redondeo_minutos: parseInt(e.target.value, 10) || 15 }))}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={!!form.compensar_sabado}
                            onChange={(e) => setForm(prev => ({ ...prev, compensar_sabado: e.target.checked ? 1 : 0 }))}
                            className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300"
                        />
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">Compensación semanal 44h (Sábados)</span>
                            <span className="text-[10px] text-slate-500">
                                Sábado sin marca = -4h (salvo asueto/incapacidad); sábado trabajado = horas - 4h; domingo = 100% extra.
                            </span>
                        </div>
                    </label>
                    {!!form.compensar_sabado && (
                        <div className="flex items-center gap-2 pl-6">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Jornada Sábado (h):</span>
                            <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="8"
                                value={form.horas_jornada_sabado ?? 4}
                                onChange={(e) => setForm(prev => ({ ...prev, horas_jornada_sabado: e.target.value }))}
                                className="w-20 text-xs font-bold border border-slate-300 rounded-lg px-2 py-1 bg-white"
                            />
                        </div>
                    )}
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={!!form.permitir_saldo_negativo}
                            onChange={(e) => setForm(prev => ({ ...prev, permitir_saldo_negativo: e.target.checked ? 1 : 0 }))}
                            className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300"
                        />
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">Arrastre automático de Horas Pendientes</span>
                            <span className="text-[10px] text-slate-500">
                                Permite ajustes negativos y traslada automáticamente cualquier saldo negativo al cierre como HORAS PENDIENTES del próximo corte.
                            </span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default BiometricOvertimeRulesSection;
