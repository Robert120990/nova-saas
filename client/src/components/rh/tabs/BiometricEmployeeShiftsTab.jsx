import { Search, Clock } from 'lucide-react';

const BiometricEmployeeShiftsTab = ({
    employees = [],
    shifts = [],
    empSearch = '',
    setEmpSearch,
    selectedShiftFilter = 'todos',
    setSelectedShiftFilter,
    onAssignShift
}) => {
    const filteredEmployees = employees.filter(e => {
        const matchesSearch = !empSearch ||
            e.nombre_completo?.toLowerCase().includes(empSearch.toLowerCase()) ||
            e.codigo?.toLowerCase().includes(empSearch.toLowerCase()) ||
            e.cargo_nombre?.toLowerCase().includes(empSearch.toLowerCase()) ||
            e.departamento_nombre?.toLowerCase().includes(empSearch.toLowerCase());

        const matchesShift = selectedShiftFilter === 'todos' ||
            (selectedShiftFilter === 'default' && !e.turno_id) ||
            String(e.turno_id) === String(selectedShiftFilter);

        return matchesSearch && matchesShift;
    });

    return (
        <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                    <strong className="block font-bold">Horarios Diferenciados por Empleado:</strong>
                    <span>
                        Asigne a cada colaborador el turno que le corresponde (ej. Matutino, Vespertino, Nocturno o Personalizado). Los colaboradores sin turno específico tomarán el Turno Predeterminado.
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative sm:col-span-2">
                    <input
                        type="text"
                        placeholder="Buscar por colaborador, código o cargo..."
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                <div>
                    <select
                        value={selectedShiftFilter}
                        onChange={e => setSelectedShiftFilter(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todos los Turnos</option>
                        <option value="default">Turno Predeterminado</option>
                        {shifts.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y bg-white">
                {filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                        No se encontraron colaboradores con los criterios seleccionados.
                    </div>
                ) : (
                    filteredEmployees.map(emp => (
                        <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-slate-50 gap-2">
                            <div>
                                <span className="font-bold text-slate-800 text-xs block">{emp.nombre_completo}</span>
                                <span className="text-[11px] text-slate-400">
                                    [{emp.codigo}] {emp.cargo_nombre || 'Sin cargo'} &bull; {emp.departamento_nombre || 'Sin depto'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={emp.turno_id || ''}
                                    onChange={e => onAssignShift(emp.id, e.target.value || null)}
                                    className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">Predeterminado (General)</option>
                                    {shifts.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.nombre} ({String(s.hora_entrada).slice(0, 5)} - {String(s.hora_salida).slice(0, 5)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BiometricEmployeeShiftsTab;
