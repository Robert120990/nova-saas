import { Banknote, X, Trash2, Plus, Loader2, Save } from 'lucide-react';
import Money, { MoneyInput } from '../ui/Money';

const GasAdelantosModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    adelantos = [],
    despachadoresOptions = [],
    handleAdelantoChange,
    handleRemoveAdelanto,
    handleAddAdelantoRow,
    adelantosTotal = 0,
    handleSaveSection,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl min-h-[40vh] max-h-[95vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Banknote size={16} className="text-indigo-600" />
                        Adelantos del Turno
                        {isDirty && estado !== 'cerrado' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                ● Cambios sin guardar
                            </span>
                        )}
                        {estado === 'cerrado' && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>
                <div className="overflow-auto px-4 pb-4 flex-1">
                    <table className="w-full text-left border-separate border-spacing-0 table-cards">
                        <thead className="sticky top-0 z-20">
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100">Empleado</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Monto</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {adelantos.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-400">
                                        No hay adelantos registrados. Agregue un adelanto para comenzar.
                                    </td>
                                </tr>
                            )}
                            {adelantos.map(a => (
                                <tr key={a.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                    <td className="px-1.5 py-1" data-label="Empleado">
                                        <input
                                            type="text"
                                            value={a.empleado || ''}
                                            onChange={(e) => handleAdelantoChange(a.id, 'empleado', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            placeholder="Nombre del empleado"
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Despachador">
                                        <select
                                            value={a.despachador_id || ''}
                                            onChange={(e) => handleAdelantoChange(a.id, 'despachador_id', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                            {despachadoresOptions.map(disp => (
                                                <option key={disp.id} value={disp.id}>{disp.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1 text-right" data-label="Monto">
                                        <MoneyInput
                                            step="0.01"
                                            value={a.monto ?? ''}
                                            onChange={(e) => handleAdelantoChange(a.id, 'monto', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            disabled={estado === 'cerrado'}
                                            placeholder="0.00"
                                            className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1 text-center" data-label="">
                                        {estado !== 'cerrado' && (
                                            <button
                                                onClick={() => handleRemoveAdelanto(a.id)}
                                                className="p-0.5 text-slate-600 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {estado !== 'cerrado' && (
                        <div className="flex items-center justify-between mt-3">
                            <button
                                onClick={handleAddAdelantoRow}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                            >
                                <Plus size={14} />
                                Agregar Adelanto
                            </button>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">
                                    Total Adelantos: <strong className="text-red-600 font-mono text-sm"><Money value={adelantosTotal} /></strong>
                                </span>
                                <button
                                    onClick={() => handleSaveSection('adelantos')}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                        isDirty
                                            ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Adelantos (Pendiente)' : 'Guardar Adelantos')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GasAdelantosModal;
