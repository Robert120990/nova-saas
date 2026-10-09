import { Sparkles, Trash2, RotateCcw, Percent } from 'lucide-react';
import { formatDateTime } from '../../../utils/dateUtils';

/**
 * ProductionRemanentesSelector
 * Componente modular para selección y dosificación parcial/porcentual de remanentes
 * en la formulación de una nueva producción de huevo industrial.
 */
export default function ProductionRemanentesSelector({
    availableRemanentes = [],
    showAllRemanentes = false,
    setShowAllRemanentes,
    selectedRemanenteIds = [],
    remanenteUsages = {},
    onToggleSelect,
    onUpdateUsage,
    onMarkUsed,
    onReactivate,
    onDelete
}) {
    // Manejo de cambio de porcentaje mediante preset buttons
    const handleSetPct = (remId, pctVal, totalLbs) => {
        const clampedPct = Math.min(100, Math.max(1, pctVal));
        const calculatedLbs = clampedPct === 100
            ? totalLbs
            : Math.round(((totalLbs * clampedPct) / 100) * 100) / 100;
        if (onUpdateUsage) {
            onUpdateUsage(remId, {
                used_lbs: calculatedLbs,
                percentage: clampedPct,
                pct: clampedPct
            });
        }
    };

    // Manejo de cambio manual de libras
    const handleUsedLbsChange = (remId, valStr, totalLbs) => {
        if (valStr === '') {
            if (onUpdateUsage) {
                onUpdateUsage(remId, {
                    used_lbs: '',
                    percentage: '',
                    pct: ''
                });
            }
            return;
        }
        let val = parseFloat(valStr);
        if (isNaN(val) || val < 0) val = 0;
        if (val > totalLbs) val = totalLbs;
        const calculatedPct = totalLbs > 0 ? Math.round(((val / totalLbs) * 100) * 100) / 100 : 0;
        if (onUpdateUsage) {
            onUpdateUsage(remId, {
                used_lbs: val,
                percentage: calculatedPct,
                pct: calculatedPct
            });
        }
    };

    // Manejo de cambio manual de porcentaje
    const handlePctInputChange = (remId, valStr, totalLbs) => {
        if (valStr === '') {
            if (onUpdateUsage) {
                onUpdateUsage(remId, {
                    used_lbs: '',
                    percentage: '',
                    pct: ''
                });
            }
            return;
        }
        let pct = parseFloat(valStr);
        if (isNaN(pct) || pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        const calculatedLbs = pct === 100 ? totalLbs : Math.round(((totalLbs * pct) / 100) * 100) / 100;
        if (onUpdateUsage) {
            onUpdateUsage(remId, {
                used_lbs: calculatedLbs,
                percentage: pct,
                pct: pct
            });
        }
    };

    const availableCount = availableRemanentes.filter(r => r.status === 'disponible').length;

    // Calcular el total de libras dosificadas de remanentes
    const totalDosificadoLbs = selectedRemanenteIds.reduce((sum, remId) => {
        const rem = availableRemanentes.find(r => r.id === remId);
        if (!rem) return sum;
        const totalAvail = parseFloat(rem.quantity_lbs || rem.weight_lbs || 0);
        const usage = remanenteUsages[remId];
        if (usage && usage.used_lbs !== undefined) {
            return sum + Math.min(totalAvail, parseFloat(usage.used_lbs) || 0);
        }
        return sum + totalAvail;
    }, 0);

    return (
        <div className="space-y-3 bg-teal-50/50 p-4 rounded-xl border border-teal-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-2">
                <div>
                    <label className="text-xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        <span>Materia prima en proceso (Producciones Previas)</span>
                    </label>
                    <p className="text-[11px] text-teal-700">
                        Remanentes o sobrantes listos para integrarse. Puedes dosificar un porcentaje o cantidad específica.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={async () => {
                            if (setShowAllRemanentes) setShowAllRemanentes(!showAllRemanentes);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${showAllRemanentes
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-white text-teal-800 border-teal-300 hover:bg-teal-100'
                            }`}
                    >
                        {showAllRemanentes ? 'Ver Solo Disponibles' : 'Ver Todos / Historial'}
                    </button>
                    <span className="text-xs bg-white px-2.5 py-1 rounded-lg border border-teal-200 text-teal-800 font-bold self-start sm:self-auto">
                        {availableCount} disponibles
                    </span>
                </div>
            </div>

            {availableRemanentes.length === 0 ? (
                <p className="text-xs text-teal-700/80 italic py-1">
                    No hay remanentes o sobrantes con saldo disponible en este momento.
                </p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {(Array.isArray(availableRemanentes) ? availableRemanentes : []).map(rem => {
                        const isSelected = selectedRemanenteIds.includes(rem.id);
                        const isAssigned = rem.status === 'asignado_a_lote';
                        const totalLbs = parseFloat(rem.quantity_lbs || rem.weight_lbs || 0);

                        // Obtener o inicializar uso
                        const usage = remanenteUsages[rem.id] || {};
                        const currentUsedLbs = usage.used_lbs !== undefined ? parseFloat(usage.used_lbs) : totalLbs;
                        const currentPct = usage.percentage !== undefined ? parseFloat(usage.percentage) : (totalLbs > 0 ? Math.round(((currentUsedLbs / totalLbs) * 100)) : 100);
                        const remainingLbs = Math.max(0, Math.round((totalLbs - currentUsedLbs) * 100) / 100);

                        return (
                            <div
                                key={rem.id}
                                onClick={() => {
                                    if (isAssigned && !isSelected) return;
                                    if (onToggleSelect) onToggleSelect(rem);
                                }}
                                className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${isSelected
                                    ? 'bg-white border-teal-500 shadow-sm ring-2 ring-teal-500/20 cursor-pointer'
                                    : isAssigned
                                        ? 'bg-slate-100/80 border-slate-200 text-slate-500 cursor-default opacity-85'
                                        : 'bg-white/70 border-teal-200/70 hover:bg-white hover:border-teal-300 cursor-pointer'
                                    }`}
                            >
                                <div className="space-y-1.5 w-full">
                                    {/* Cabecera del ítem */}
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={isAssigned && !isSelected}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    if (isAssigned && !isSelected) return;
                                                    if (onToggleSelect) onToggleSelect(rem);
                                                }}
                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-teal-100 text-teal-900 border border-teal-200">
                                                REM-#{rem.id}
                                            </span>
                                            <span className="text-xs font-bold text-slate-900">
                                                {rem.batch_code_display || `Lote #${rem.batch_id}`}
                                            </span>
                                            {rem.is_coproduct && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                                                    Co-producto
                                                </span>
                                            )}
                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                                                {rem.remanente_type || 'pasteurizado'}
                                            </span>
                                            {isAssigned && (
                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">
                                                    Asignado
                                                </span>
                                            )}
                                        </div>

                                        {/* Botones de acción manual */}
                                        <div className="flex items-center gap-1">
                                            {!isAssigned ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        title="Marcar como ya utilizado en corrida previa"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onMarkUsed) onMarkUsed(e, rem);
                                                        }}
                                                        className="text-[10px] font-semibold text-slate-600 hover:text-amber-800 bg-slate-100 hover:bg-amber-100 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                                                    >
                                                        Marcar Usado
                                                    </button>
                                                    {onDelete && (
                                                        <button
                                                            type="button"
                                                            title="Eliminar remanente"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDelete(e, rem);
                                                            }}
                                                            className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    title="Reactivar como disponible"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onReactivate) onReactivate(e, rem);
                                                    }}
                                                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors flex items-center gap-1"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Reactivar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metadatos: tipo de huevo, peso disponible, fecha */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                                        <span className="capitalize font-medium">{rem.product_type}</span>
                                        <span className="text-teal-800 font-bold">{Number(totalLbs.toFixed(2))} Lbs disponibles</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>📍 {rem.storage_location || 'Cámara Fría'}</span>
                                        <span>{formatDateTime(rem.created_at)}</span>
                                    </div>

                                    {rem.notes && (
                                        <p className="text-[10px] text-slate-500 italic line-clamp-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                            {rem.notes}
                                        </p>
                                    )}

                                    {/* Panel interactivo de dosificación si está seleccionado */}
                                    {isSelected && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-2 pt-2 border-t border-teal-200 space-y-2 bg-teal-50/70 p-2.5 rounded-lg border border-teal-200/60"
                                        >
                                            <div className="flex items-center justify-between gap-1 flex-wrap">
                                                <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1">
                                                    <Percent className="w-3 h-3 text-teal-600" />
                                                    <span>Dosificación a utilizar</span>
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {[25, 50, 75, 100].map(pctVal => {
                                                        const active = Math.abs(currentPct - pctVal) < 1;
                                                        return (
                                                            <button
                                                                key={pctVal}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSetPct(rem.id, pctVal, totalLbs);
                                                                }}
                                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${active
                                                                    ? 'bg-teal-700 text-white shadow-xs'
                                                                    : 'bg-white text-teal-800 hover:bg-teal-100 border border-teal-200'
                                                                    }`}
                                                            >
                                                                {pctVal}%
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                                                        Lbs a incorporar
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0.01"
                                                            max={totalLbs}
                                                            value={currentUsedLbs !== undefined ? currentUsedLbs : ''}
                                                            onChange={(e) => handleUsedLbsChange(rem.id, e.target.value, totalLbs)}
                                                            className="w-full px-2 py-1 bg-white border border-teal-300 rounded text-xs font-bold text-teal-900 focus:ring-1 focus:ring-teal-500"
                                                        />
                                                        <span className="absolute right-2 top-1 text-[10px] font-semibold text-slate-400">
                                                            Lbs
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                                                        Porcentaje (%)
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0.1"
                                                            max="100"
                                                            value={currentPct !== undefined ? currentPct : ''}
                                                            onChange={(e) => handlePctInputChange(rem.id, e.target.value, totalLbs)}
                                                            className="w-full px-2 py-1 bg-white border border-teal-300 rounded text-xs font-bold text-teal-900 focus:ring-1 focus:ring-teal-500"
                                                        />
                                                        <span className="absolute right-2 top-1 text-[10px] font-semibold text-slate-400">
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-[10px] text-teal-900 flex items-center justify-between bg-white/90 px-2 py-1 rounded border border-teal-200">
                                                <span>✓ Incorpora: <strong>{typeof currentUsedLbs === 'number' ? Number(currentUsedLbs.toFixed(2)) : 0} Lbs</strong></span>
                                                <span className="text-slate-600">
                                                    Quedarán: <strong className="text-teal-800">{Number(remainingLbs.toFixed(2))} Lbs</strong> en stock
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedRemanenteIds.length > 0 && (
                <div className="text-xs font-bold text-teal-800 bg-white px-3 py-2 rounded-lg border border-teal-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-xs">
                    <span>Remanentes Seleccionados: {selectedRemanenteIds.length}</span>
                    <span className="text-teal-700">
                        + {totalDosificadoLbs.toFixed(1)} Lbs incorporadas a la mezcla
                    </span>
                </div>
            )}
        </div>
    );
}
