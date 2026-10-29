import { ShieldCheck, AlertCircle } from 'lucide-react';

const labelCls = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1';
const inputCls = 'w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all';

const BiometricAbsenceAuthFields = ({
    categoria,
    pidioPermiso,
    onPidioPermisoChange,
    estadoAutorizacion,
    onEstadoAutorizacionChange,
    goceSueldo,
    onGoceSueldoChange,
    afectaSeptimoDia,
    onAfectaSeptimoChange
}) => {
    const goceDisabled = categoria === 'injustificada' || estadoAutorizacion === 'rechazado' || estadoAutorizacion === 'sin_solicitud';

    return (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>¿Solicitó Permiso / Avisó?</label>
                    <select
                        value={pidioPermiso ? 'si' : 'no'}
                        onChange={(e) => onPidioPermisoChange(e.target.value === 'si')}
                        className={inputCls}
                    >
                        <option value="si">Sí pidió permiso / notificó</option>
                        <option value="no">No pidió permiso / sin aviso</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Estado de Autorización *</label>
                    <select
                        value={estadoAutorizacion}
                        onChange={(e) => onEstadoAutorizacionChange(e.target.value)}
                        className={inputCls}
                    >
                        <option value="pendiente">Pendiente de Autorizar (Se va a autorizar)</option>
                        <option value="autorizado">Autorizado</option>
                        <option value="rechazado">No Autorizado / Rechazado</option>
                        <option value="sin_solicitud">Sin Solicitud (Falta directa)</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/70">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={goceSueldo && !goceDisabled}
                        disabled={goceDisabled}
                        onChange={(e) => onGoceSueldoChange(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Con Goce de Sueldo (Remunerado / Subsidio)</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={afectaSeptimoDia}
                        onChange={(e) => onAfectaSeptimoChange(e.target.checked)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span>Afecta Séptimo Día (Art. 171 C.T.)</span>
                </label>
            </div>
        </div>
    );
};

export default BiometricAbsenceAuthFields;
