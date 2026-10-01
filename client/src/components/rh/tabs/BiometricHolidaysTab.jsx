const BiometricHolidaysTab = ({
    holidays,
    selectedCountry,
    onCountryChange,
    onToggleHoliday
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Días Festivos Oficiales ({selectedCountry})</span>
                <select
                    value={selectedCountry}
                    onChange={e => onCountryChange(e.target.value)}
                    className="text-xs font-bold border rounded-lg px-2 py-1 bg-white"
                >
                    <option value="SV">El Salvador (SV)</option>
                    <option value="GT">Guatemala (GT)</option>
                    <option value="HN">Honduras (HN)</option>
                </select>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y">
                {holidays.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                        <div>
                            <span className="font-bold text-slate-800 text-xs block">{h.nombre}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                                {String(h.dia).padStart(2, '0')}/{String(h.mes).padStart(2, '0')} {h.anio ? `(${h.anio})` : '(Anual)'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleHoliday(h.id, !h.is_active)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                                h.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}
                        >
                            {h.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BiometricHolidaysTab;
