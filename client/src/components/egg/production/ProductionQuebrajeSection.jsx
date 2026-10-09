import { Clock, ShieldCheck } from 'lucide-react';

const EGG_CONDITIONS = [
    'Buenas',
    'Excelentes',
    'Regulares',
    'Cáscara Frágil',
    'Quebrado Leve',
    'Huevo Pequeño',
    'Huevo Sucio / Lavado Requerido'
];

export default function ProductionQuebrajeSection({
    batchForm,
    setBatchForm
}) {
    return (
        <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-amber-50/70 border border-amber-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-amber-200/70 pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs">
                        <Clock size={16} />
                    </div>
                    <div>
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                            Control de Horarios y Calidad de Quebraje (PRO:006)
                        </span>
                        <p className="text-[11px] text-amber-800">
                            Registro de jornada de quebraje y evaluación inicial de cáscara / contenido.
                        </p>
                    </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100/90 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                    <ShieldCheck size={12} className="text-amber-700" />
                    Hoja PRO:006
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                        Inicio de Quebraje
                    </label>
                    <input
                        type="time"
                        value={batchForm.quebraje_inicio || ''}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, quebraje_inicio: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Ej: 07:00 am</span>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                        Final de Quebraje
                    </label>
                    <input
                        type="time"
                        value={batchForm.quebraje_fin || ''}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, quebraje_fin: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Ej: 12:00 pm</span>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                        Condiciones del Huevo
                    </label>
                    <input
                        type="text"
                        list="egg-condition-options"
                        value={batchForm.egg_condition || 'Buenas'}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, egg_condition: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                        placeholder="Ej: Buenas"
                    />
                    <datalist id="egg-condition-options">
                        {EGG_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond} />
                        ))}
                    </datalist>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Condición del cascarón recibido</span>
                </div>
            </div>
        </div>
    );
}
