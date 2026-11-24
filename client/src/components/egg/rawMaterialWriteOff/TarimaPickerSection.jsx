import { CheckSquare, Square, Search } from 'lucide-react';
import { formatLbs } from './constants';

export default function TarimaPickerSection({
    availTarimas = [],
    selectedTarimas = {},
    tarimaFilter,
    setTarimaFilter,
    onToggleTarima,
    onSelectAllVisible,
    onClearSelection,
    onUpdateTarimaField
}) {
    const selectedCount = Object.keys(selectedTarimas).length;

    return (
        <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    3. Seleccione Tarimas a Dar de Baja ({selectedCount} seleccionadas)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={tarimaFilter}
                            onChange={(e) => setTarimaFilter(e.target.value)}
                            placeholder="Filtrar # o código..."
                            className="pl-7 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium w-40 outline-none focus:border-indigo-400"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onSelectAllVisible}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-colors"
                    >
                        Seleccionar Todas ({availTarimas.length})
                    </button>
                    {selectedCount > 0 && (
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {availTarimas.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl border border-slate-200">
                    No hay tarimas disponibles que coincidan con el filtro.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                    {availTarimas.map((t) => {
                        const sel = selectedTarimas[t.tarima_number];
                        const isChecked = Boolean(sel);
                        return (
                            <div
                                key={t.tarima_number}
                                className={`rounded-xl border p-3 transition-all ${
                                    isChecked
                                        ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400/30'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => onToggleTarima(t)}
                                    className="w-full text-left flex items-start justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isChecked ? (
                                            <CheckSquare size={17} className="text-indigo-600 shrink-0" />
                                        ) : (
                                            <Square size={17} className="text-slate-300 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-900">
                                                Tarima #{String(t.tarima_number).padStart(2, '0')}
                                            </p>
                                            <p className="text-[10px] font-mono text-slate-500 truncate">
                                                {t.barcode}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase shrink-0">
                                        {t.storage_location || 'abajo'}
                                    </span>
                                </button>

                                <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                                    <span>Disp: <strong className="text-slate-900">{t.available_boxes}</strong> cjs</span>
                                    <span><strong className="text-slate-900">{formatLbs(t.available_lbs)}</strong> lbs</span>
                                </div>

                                {isChecked && (
                                    <div className="mt-2.5 pt-2 border-t border-indigo-200/70 grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-bold text-indigo-700 uppercase">
                                                Cajas Baja
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={t.available_boxes}
                                                value={sel.boxes_count}
                                                onChange={(e) => onUpdateTarimaField(t, 'boxes_count', e.target.value)}
                                                className="w-full mt-0.5 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-indigo-700 uppercase">
                                                Lbs Baja
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={t.available_lbs}
                                                value={sel.quantity_lbs}
                                                onChange={(e) => onUpdateTarimaField(t, 'quantity_lbs', e.target.value)}
                                                className="w-full mt-0.5 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
