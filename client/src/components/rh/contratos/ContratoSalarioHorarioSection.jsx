import { useState } from 'react';
import { DollarSign, Clock, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { MoneyInput } from '../../ui/Money';
import {
    DIAS_SEMANA_OPCIONES,
    FORMAS_PAGO_OPCIONES,
    SEXOS_OPCIONES,
    ESTADOS_CONTRATO
} from './contratoConstants';

const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium uppercase";

const ContratoSalarioHorarioSection = ({ form, onChange }) => {
    const [showPatrono, setShowPatrono] = useState(false);

    const handleField = (key, val) => {
        onChange({ ...form, [key]: val });
    };

    return (
        <div className="space-y-4">
            {/* Block 1: Salario y Forma de Pago */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                        <DollarSign size={15} className="text-indigo-600" />
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                            Salario y Condiciones de Pago
                        </h4>
                    </div>
                    <select
                        value={form.estado}
                        onChange={(e) => handleField('estado', e.target.value)}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none"
                    >
                        {ESTADOS_CONTRATO.map((est) => (
                            <option key={est.key} value={est.key}>{est.label}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Salario Mensual ($ USD) *</label>
                        <MoneyInput
                            value={form.salario_mensual}
                            onChange={(e) => handleField('salario_mensual', e.target.value)}
                            placeholder="409.00"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-bold font-mono text-right"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Lugar de Pago</label>
                        <input
                            type="text"
                            value={form.lugar_pago}
                            onChange={(e) => handleField('lugar_pago', e.target.value)}
                            placeholder="EJ. BANCO PROMERICA"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Forma de Pago</label>
                    <input
                        type="text"
                        list="contrato-formas-pago"
                        value={form.forma_pago}
                        onChange={(e) => handleField('forma_pago', e.target.value)}
                        placeholder="EJ. TRANFERENCIA BANCARIA"
                        className={inputCls}
                    />
                    <datalist id="contrato-formas-pago">
                        {FORMAS_PAGO_OPCIONES.map((fp) => (
                            <option key={fp} value={fp} />
                        ))}
                    </datalist>
                </div>
            </div>

            {/* Block 2: Horario de Trabajo */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                    <Clock size={15} className="text-indigo-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                        Horario de Trabajo (Cláusula D)
                    </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Del Día</label>
                        <select
                            value={form.horario_dia_inicio}
                            onChange={(e) => handleField('horario_dia_inicio', e.target.value)}
                            className={inputCls}
                        >
                            {DIAS_SEMANA_OPCIONES.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Al Día</label>
                        <select
                            value={form.horario_dia_fin}
                            onChange={(e) => handleField('horario_dia_fin', e.target.value)}
                            className={inputCls}
                        >
                            {DIAS_SEMANA_OPCIONES.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Desde las (Mañana)</label>
                        <input
                            type="text"
                            value={form.horario_manana_desde}
                            onChange={(e) => handleField('horario_manana_desde', e.target.value)}
                            placeholder="8:00 A.M."
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Hasta las (Mañana)</label>
                        <input
                            type="text"
                            value={form.horario_manana_hasta}
                            onChange={(e) => handleField('horario_manana_hasta', e.target.value)}
                            placeholder="12:00 P.M."
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Y de (Tarde)</label>
                        <input
                            type="text"
                            value={form.horario_tarde_desde}
                            onChange={(e) => handleField('horario_tarde_desde', e.target.value)}
                            placeholder="1:00 P.M."
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Hasta las (Tarde)</label>
                        <input
                            type="text"
                            value={form.horario_tarde_hasta}
                            onChange={(e) => handleField('horario_tarde_hasta', e.target.value)}
                            placeholder="5:00 P.M."
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/70">
                    <div>
                        <label className={labelCls}>Y el Día</label>
                        <select
                            value={form.horario_dia_extra}
                            onChange={(e) => handleField('horario_dia_extra', e.target.value)}
                            className={inputCls}
                        >
                            <option value="">— NINGUNO —</option>
                            {DIAS_SEMANA_OPCIONES.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Desde las</label>
                        <input
                            type="text"
                            value={form.horario_extra_desde}
                            onChange={(e) => handleField('horario_extra_desde', e.target.value)}
                            placeholder="8:00 A.M."
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Hasta las</label>
                        <input
                            type="text"
                            value={form.horario_extra_hasta}
                            onChange={(e) => handleField('horario_extra_hasta', e.target.value)}
                            placeholder="12:00 P.M."
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                        Total de Horas a la Semana :
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="80"
                        value={form.total_horas_semana}
                        onChange={(e) => handleField('total_horas_semana', e.target.value)}
                        className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-[13px] font-extrabold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            {/* Block 3: Datos del Patrono y Cláusulas (Collapsible) */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowPatrono(!showPatrono)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-indigo-600" />
                        <div>
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                                Datos del Patrono y Cláusulas (Impresión PDF)
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[260px] sm:max-w-xs">
                                {form.patrono_nombre || 'Sin configurar'} • DUI: {form.patrono_dui || '—'}
                            </p>
                        </div>
                    </div>
                    {showPatrono ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>

                {showPatrono && (
                    <div className="p-4 pt-2 border-t border-slate-200/80 space-y-3">
                        <div>
                            <label className={labelCls}>Nombre del Patrono / Representante</label>
                            <input
                                type="text"
                                value={form.patrono_nombre}
                                onChange={(e) => handleField('patrono_nombre', e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className={labelCls}>Edad</label>
                                <input
                                    type="number"
                                    value={form.patrono_edad}
                                    onChange={(e) => handleField('patrono_edad', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Sexo</label>
                                <select
                                    value={form.patrono_sexo}
                                    onChange={(e) => handleField('patrono_sexo', e.target.value)}
                                    className={inputCls}
                                >
                                    {SEXOS_OPCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Estado Civil</label>
                                <input
                                    type="text"
                                    list="contrato-estados-civiles"
                                    value={form.patrono_estado_civil}
                                    onChange={(e) => handleField('patrono_estado_civil', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className={labelCls}>Profesión u Oficio</label>
                                <input
                                    type="text"
                                    value={form.patrono_profesion}
                                    onChange={(e) => handleField('patrono_profesion', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Nacionalidad</label>
                                <input
                                    type="text"
                                    value={form.patrono_nacionalidad}
                                    onChange={(e) => handleField('patrono_nacionalidad', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Dirección Patrono</label>
                            <input
                                type="text"
                                value={form.patrono_direccion}
                                onChange={(e) => handleField('patrono_direccion', e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                                <label className={labelCls}>DUI Patrono</label>
                                <input
                                    type="text"
                                    value={form.patrono_dui}
                                    onChange={(e) => handleField('patrono_dui', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Extendido en</label>
                                <input
                                    type="text"
                                    value={form.patrono_dui_extendido}
                                    onChange={(e) => handleField('patrono_dui_extendido', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>NIT Patrono</label>
                                <input
                                    type="text"
                                    value={form.patrono_nit}
                                    onChange={(e) => handleField('patrono_nit', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>H) Otras Estipulaciones</label>
                            <textarea
                                rows={2}
                                value={form.otras_estipulaciones}
                                onChange={(e) => handleField('otras_estipulaciones', e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContratoSalarioHorarioSection;

