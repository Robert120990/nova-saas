import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const BiometricPayrollTab = ({
    vincularConPlanilla,
    onTogglePayrollLink
}) => {
    const isEnabled = !!vincularConPlanilla;

    return (
        <div className="space-y-4">
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                isEnabled ? 'bg-emerald-50 border-emerald-200/80' : 'bg-amber-50 border-amber-200/80'
            }`}>
                {isEnabled ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className={`text-xs space-y-1 ${isEnabled ? 'text-emerald-900' : 'text-amber-900'}`}>
                    <p className="font-bold">
                        {isEnabled ? 'Integración Activa con Planilla Quincenal' : 'Modo de Pruebas Activo (Desvinculado)'}
                    </p>
                    {isEnabled ? (
                        <p>
                            Al generar una nueva planilla quincenal, el sistema tomará automáticamente las <strong>horas extra aprobadas</strong> (separadas en diurnas 2.0x y nocturnas 2.5x) registradas en Cortes y descontará los días de <strong>ausencias sin goce / injustificadas</strong>.
                        </p>
                    ) : (
                        <>
                            <p>
                                La integración automática con planillas se encuentra <strong>desactivada</strong>. Las marcaciones y cortes operan en modo informativo y exportable sin alterar el cálculo de planilla.
                            </p>
                            <p className="text-amber-800">
                                Cuando completen las validaciones de turnos y huellas, activen este interruptor para alimentar automáticamente horas extra aprobadas y ausencias sin goce en la planilla quincenal.
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                    <span className="font-bold text-slate-800 text-xs block">Vincular con Generación de Planilla</span>
                    <span className="text-[11px] text-slate-500">
                        Transfiere horas extra aprobadas (diurnas/nocturnas) y días de ausencia sin goce al generar planilla
                    </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={e => onTogglePayrollLink(e.target.checked ? 1 : 0)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </div>
        </div>
    );
};

export default BiometricPayrollTab;
