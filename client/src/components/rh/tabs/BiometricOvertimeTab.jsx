const BiometricOvertimeTab = ({
    employees,
    empSearch,
    setEmpSearch,
    onToggleExempt
}) => {
    const filteredEmployees = employees.filter(e =>
        !empSearch ||
        e.nombre_completo?.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.codigo?.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.cargo_nombre?.toLowerCase().includes(empSearch.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <strong>Personal Exento de Horas Extras:</strong> Marque la casilla para los colaboradores que por su cargo (dirección, confianza o jefatura) no devengan horas extraordinarias.
            </div>
            <input
                type="text"
                placeholder="Filtrar empleados por nombre, código o cargo..."
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y">
                {filteredEmployees.map(emp => (
                    <label key={emp.id} className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer">
                        <div>
                            <span className="font-bold text-slate-800 text-xs block">{emp.nombre_completo}</span>
                            <span className="text-[11px] text-slate-400">[{emp.codigo}] {emp.cargo_nombre || 'Sin cargo'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">
                                {emp.exento_horas_extras ? 'Exento de H.E.' : 'Paga H.E.'}
                            </span>
                            <input
                                type="checkbox"
                                checked={!!emp.exento_horas_extras}
                                onChange={e => onToggleExempt(emp.id, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default BiometricOvertimeTab;
