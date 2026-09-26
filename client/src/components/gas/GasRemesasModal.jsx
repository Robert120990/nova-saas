import { Banknote, X, Printer, Trash2, Plus, Loader2, Save } from 'lucide-react';
import Money, { MoneyInput } from '../ui/Money';

const GasRemesasModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    remesas = [],
    despachadoresOptions = [],
    onRemesaChange,
    onPrintLabel,
    onRemoveRemesa,
    onAddRemesa,
    remesasTotal = 0,
    onSave,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl min-h-[50vh] max-h-[95vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Banknote size={16} className="text-indigo-600" />
                        Remesas del Turno
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
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Código</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Documento</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Tipo de Operación</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Monto</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {remesas.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                                        No hay remesas registradas. Agregue una remesa para comenzar.
                                    </td>
                                </tr>
                            )}
                            {remesas.map(r => (
                                <tr key={r.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                    <td className="px-1.5 py-1" data-label="Código">
                                        <span className="text-[11px] font-mono text-slate-600">{r.codigo || '—'}</span>
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Documento">
                                        <input
                                            type="text"
                                            value={r.documento || ''}
                                            onChange={(e) => onRemesaChange(r.id, 'documento', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            placeholder="N° documento"
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Despachador">
                                        <select
                                            value={r.despachador_id || ''}
                                            onChange={(e) => onRemesaChange(r.id, 'despachador_id', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                            {despachadoresOptions.map(disp => (
                                                <option key={disp.id} value={disp.id}>{disp.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Tipo de Operación">
                                        <select
                                            value={r.tipo_operacion || 'venta_combustible'}
                                            onChange={(e) => onRemesaChange(r.id, 'tipo_operacion', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="venta_combustible">Venta de Combustible</option>
                                            <option value="recuperacion_credito">Recuperación de Crédito</option>
                                            <option value="pago_anticipado">Pago Anticipado</option>
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1 text-right" data-label="Monto">
                                        <MoneyInput
                                            step="0.01"
                                            value={r.monto || ''}
                                            onChange={(e) => onRemesaChange(r.id, 'monto', parseFloat(e.target.value) || 0)}
                                            onFocus={(e) => e.target.select()}
                                            disabled={estado === 'cerrado'}
                                            placeholder="0.00"
                                            className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1 text-center" data-label="">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => onPrintLabel && onPrintLabel(r)}
                                                className="p-0.5 text-slate-600 hover:text-indigo-500 transition-colors"
                                                title="Imprimir etiqueta"
                                            >
                                                <Printer size={14} />
                                            </button>
                                            {estado !== 'cerrado' && (
                                                <button
                                                    onClick={() => onRemoveRemesa(r.id)}
                                                    className="p-0.5 text-slate-600 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {estado !== 'cerrado' && (
                        <div className="flex items-center justify-between mt-3">
                            <button
                                onClick={onAddRemesa}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                            >
                                <Plus size={14} />
                                Agregar Remesa
                            </button>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">
                                    Total Remesas: <strong className="text-red-600 font-mono text-sm"><Money value={remesasTotal} /></strong>
                                </span>
                                <button
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                        isDirty
                                            ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Remesas (Pendiente)' : 'Guardar Remesas')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GasRemesasModal;
