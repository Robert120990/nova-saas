import { AlertTriangle } from 'lucide-react';

const BiometricPayrollTab = ({
    vincularConPlanilla,
    onTogglePayrollLink
}) => {
    return (
        <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-bold">Modo de Pruebas Activo</p>
                    <p>
                        Por seguridad operativa y como solicitó, la integración de asistencia biométrica con planillas se encuentra <strong>desactivada</strong>.
                    </p>
                    <p className="text-amber-800">
                        Cuando completen las validaciones de turnos y huellas, podrán activar esta casilla para alimentar automáticamente horas trabajadas, retrasos y horas extras en la planilla quincenal.
                    </p>
                </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                    <span className="font-bold text-slate-800 text-xs block">Vincular con Generación de Planilla</span>
                    <span className="text-[11px] text-slate-400">Transferencia automática de horas y deducciones de tardanza</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!vincularConPlanilla}
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
