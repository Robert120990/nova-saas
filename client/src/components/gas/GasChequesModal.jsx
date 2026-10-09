import { Landmark, X, Plus, Trash2, Save, Loader2, PieChart } from 'lucide-react';
import Money, { MoneyInput } from '../ui/Money';

const COMMON_BANKS = [
    'Banco Agrícola',
    'Banco Cuscatlán',
    'Banco Davivienda',
    'Banco de América Central (BAC)',
    'Banco Promerica',
    'Banco Hipotecario',
    'Banco Azul',
    'Banco Atlántida',
    'Banco G&T Continental',
    'Banco Industrial'
];

const GasChequesModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    cheques = [],
    despachadoresOptions = [],
    handleChequeChange,
    handleRemoveCheque,
    handleAddChequeRow,
    chequesTotal = 0,
    handleSaveSection,
    isSaving = false,
    chequesResumenPorTipo = []
}) => {
    if (!isOpen) return null;

    const handleRowEnter = (index) => {
        if (estado === 'cerrado') return;
        if (index === cheques.length - 1) {
            handleAddChequeRow();
            setTimeout(() => {
                const inputs = document.querySelectorAll('[data-cheque-first="true"]');
                const target = inputs[inputs.length - 1];
                if (target) {
                    target.focus();
                    target.select?.();
                    target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
                }
            }, 60);
        } else {
            const inputs = document.querySelectorAll('[data-cheque-first="true"]');
            const target = inputs[index + 1];
            if (target) {
                target.focus();
                target.select?.();
                target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[95vh] flex flex-col">
                <datalist id="bancos-sugeridos">
                    {COMMON_BANKS.map((bank) => (
                        <option key={bank} value={bank} />
                    ))}
                </datalist>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Landmark size={16} className="text-indigo-600" />
                        Cheques del Turno
                        {isDirty && estado !== 'cerrado' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                ● Cambios sin guardar
                            </span>
                        )}
                        {estado === 'cerrado' && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                Solo lectura
                            </span>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Cerrar modal"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>

                {/* Body / Table */}
                <div className="overflow-auto px-4 pb-4 flex-1">
                    <table className="w-full text-left border-collapse table-cards">
                        <thead>
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-32">No. Cheque</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Banco</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-48">Despachador</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Tipo Operación</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28 text-right">Monto</th>
                                {estado !== 'cerrado' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-8"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[11px]">
                            {cheques.length === 0 && (
                                <tr>
                                    <td colSpan={estado !== 'cerrado' ? 6 : 5} className="px-2 py-4 text-center text-[11px] text-slate-400">
                                        Sin cheques registrados en este turno
                                    </td>
                                </tr>
                            )}
                            {cheques.map((c, index) => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-1.5 py-1" data-label="No. Cheque">
                                        <input
                                            type="text"
                                            data-cheque-first="true"
                                            value={c.numero_cheque || ''}
                                            placeholder="No. de cheque"
                                            disabled={estado === 'cerrado'}
                                            onChange={(e) => handleChequeChange(c.id, 'numero_cheque', e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRowEnter(index);
                                            }}
                                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-indigo-400 font-mono"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Banco">
                                        <input
                                            type="text"
                                            list="bancos-sugeridos"
                                            value={c.banco || ''}
                                            placeholder="Nombre del banco"
                                            disabled={estado === 'cerrado'}
                                            onChange={(e) => handleChequeChange(c.id, 'banco', e.target.value)}
                                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-indigo-400"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Despachador">
                                        <select
                                            value={c.despachador_id || ''}
                                            disabled={estado === 'cerrado'}
                                            onChange={(e) => handleChequeChange(c.id, 'despachador_id', e.target.value ? parseInt(e.target.value) : '')}
                                            className={`w-full px-2 py-1 bg-white border rounded text-[11px] outline-none ${
                                                !c.despachador_id && estado !== 'cerrado'
                                                    ? 'border-amber-400 bg-amber-50/50'
                                                    : 'border-slate-200 focus:border-indigo-400'
                                            }`}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {despachadoresOptions.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.descripcion || d.codigo}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Tipo Operación">
                                        <select
                                            value={c.tipo_operacion || 'venta_combustible'}
                                            disabled={estado === 'cerrado'}
                                            onChange={(e) => handleChequeChange(c.id, 'tipo_operacion', e.target.value)}
                                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-indigo-400 font-medium"
                                        >
                                            <option value="venta_combustible">Venta de Combustible</option>
                                            <option value="recuperacion_credito">Recuperación de Crédito</option>
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1 text-right" data-label="Monto">
                                        <MoneyInput
                                            value={c.monto}
                                            disabled={estado === 'cerrado'}
                                            onChange={(val) => handleChequeChange(c.id, 'monto', val)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRowEnter(index);
                                            }}
                                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-right font-mono outline-none focus:border-indigo-400 font-semibold text-emerald-700"
                                        />
                                    </td>
                                    {estado !== 'cerrado' && (
                                        <td className="px-1.5 py-1 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCheque(c.id)}
                                                className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                                                title="Eliminar cheque"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer with summary and actions */}
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 rounded-b-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {chequesResumenPorTipo.length > 0 && (
                            <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                                <PieChart size={13} className="text-slate-400" />
                                {chequesResumenPorTipo.map((item) => (
                                    <span key={item.tipo} className="text-slate-600">
                                        <strong className="text-slate-800">{item.label}:</strong>{' '}
                                        <Money value={item.total} />
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Total Cheques:</span>
                            <span className="text-sm font-bold text-slate-900 font-mono">
                                <Money value={chequesTotal} />
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        {estado !== 'cerrado' && (
                            <button
                                type="button"
                                onClick={handleAddChequeRow}
                                className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={14} />
                                Agregar Cheque
                            </button>
                        )}
                        {estado !== 'cerrado' && (
                            <button
                                type="button"
                                onClick={() => handleSaveSection('cheques')}
                                disabled={!isDirty || isSaving}
                                className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                                    isDirty && !isSaving
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-100'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Guardar Cheques
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GasChequesModal;
