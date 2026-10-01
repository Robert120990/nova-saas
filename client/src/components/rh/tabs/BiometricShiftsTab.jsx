import { useState } from 'react';
import { Clock, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';

const BiometricShiftsTab = ({
    form,
    setForm,
    shifts = [],
    onSaveShift,
    onDeleteShift,
    onSave,
    isSaving,
    onReclassify,
    isReclassifying
}) => {
    const [isCreatingShift, setIsCreatingShift] = useState(false);
    const [newShift, setNewShift] = useState({
        nombre: '',
        hora_entrada: '06:00',
        hora_salida: '14:00',
        hora_inicio_almuerzo: '11:00',
        hora_fin_almuerzo: '12:00',
        tolerancia_entrada_minutos: 15,
        horas_jornada_diaria: 8.00
    });

    const handleCreateShift = (e) => {
        e.preventDefault();
        if (!newShift.nombre.trim()) return;
        onSaveShift(newShift);
        setNewShift({
            nombre: '',
            hora_entrada: '06:00',
            hora_salida: '14:00',
            hora_inicio_almuerzo: '11:00',
            hora_fin_almuerzo: '12:00',
            tolerancia_entrada_minutos: 15,
            horas_jornada_diaria: 8.00
        });
        setIsCreatingShift(false);
    };

    return (
        <div className="space-y-6">
            {/* General Default Schedule */}
            <form onSubmit={onSave} className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        Turno Predeterminado (General de la Empresa)
                    </h3>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Predeterminado</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hora Entrada</label>
                                <input
                                    type="time"
                                    value={form.hora_entrada}
                                    onChange={e => setForm(prev => ({ ...prev, hora_entrada: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hora Salida</label>
                                <input
                                    type="time"
                                    value={form.hora_salida}
                                    onChange={e => setForm(prev => ({ ...prev, hora_salida: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tolerancia (min)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={form.tolerancia_entrada_minutos}
                                    onChange={e => setForm(prev => ({ ...prev, tolerancia_entrada_minutos: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jornada (Horas)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="12"
                                    value={form.horas_jornada_diaria}
                                    onChange={e => setForm(prev => ({ ...prev, horas_jornada_diaria: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Salida a Almuerzo</label>
                                <input
                                    type="time"
                                    value={form.hora_inicio_almuerzo}
                                    onChange={e => setForm(prev => ({ ...prev, hora_inicio_almuerzo: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Regreso de Almuerzo</label>
                                <input
                                    type="time"
                                    value={form.hora_fin_almuerzo}
                                    onChange={e => setForm(prev => ({ ...prev, hora_fin_almuerzo: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Marcaciones en este intervalo se clasifican como salida/regreso de almuerzo.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <button
                        type="button"
                        onClick={onReclassify}
                        disabled={isReclassifying}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isReclassifying ? 'animate-spin' : ''}`} />
                        <span>Recalcular Marcaciones Existentes</span>
                    </button>
                </div>
            </form>

            {/* List of Shifts */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Catálogo de Turnos Configurables
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            Cree turnos para asignar a empleados con horarios distintos (ej. Planta, Vigilancia, etc.)
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsCreatingShift(!isCreatingShift)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isCreatingShift ? 'Cancelar' : 'Nuevo Turno'}</span>
                    </button>
                </div>

                {isCreatingShift && (
                    <form onSubmit={handleCreateShift} className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nombre del Turno</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Turno Nocturno (22:00 a 06:00)"
                                    value={newShift.nombre}
                                    onChange={e => setNewShift(prev => ({ ...prev, nombre: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-2 bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hora Entrada</label>
                                <input
                                    type="time"
                                    value={newShift.hora_entrada}
                                    onChange={e => setNewShift(prev => ({ ...prev, hora_entrada: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hora Salida</label>
                                <input
                                    type="time"
                                    value={newShift.hora_salida}
                                    onChange={e => setNewShift(prev => ({ ...prev, hora_salida: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tolerancia (min)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={newShift.tolerancia_entrada_minutos}
                                    onChange={e => setNewShift(prev => ({ ...prev, tolerancia_entrada_minutos: e.target.value }))}
                                    className="w-full text-xs font-semibold border rounded-lg p-1.5 bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                            >
                                Crear Turno
                            </button>
                        </div>
                    </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {shifts.map(s => (
                        <div key={s.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 text-xs">{s.nombre}</span>
                                    {s.es_predeterminado ? (
                                        <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                            Default
                                        </span>
                                    ) : null}
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                    {String(s.hora_entrada).slice(0, 5)} - {String(s.hora_salida).slice(0, 5)} (Tol: {s.tolerancia_entrada_minutos}m)
                                </span>
                            </div>
                            {!s.es_predeterminado && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteShift(s.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                    title="Eliminar turno"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BiometricShiftsTab;
