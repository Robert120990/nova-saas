import { CreditCard, BarChart3, X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import Money, { MoneyInput } from '../ui/Money';

const GasTarjetasModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    tarjetas = [],
    posTypesList = [],
    despachadoresOptions = [],
    handleTarjetaChange,
    handleRemoveTarjeta,
    handleAddTarjetaRow,
    tarjetasTotal = 0,
    handleSaveSection,
    isSaving = false,
    tarjetasResumenPorTipo = []
}) => {
    if (!isOpen) return null;

    return (

                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <CreditCard size={16} className="text-indigo-600" />
                                    Tarjetas del Turno
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
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">No. Tarjeta</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">No. Autorización</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-32">Tipo POS</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Tipo Operación</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24 text-right">Monto</th>
                                            {estado !== 'cerrado' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {tarjetas.length === 0 && (
                                            <tr>
                                                <td colSpan={estado !== 'cerrado' ? 7 : 6} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de tarjetas
                                                </td>
                                            </tr>
                                        )}
                                        {tarjetas.map(t => {
                                            return (
                                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-1.5 py-1" data-label="No. Tarjeta">
                                                        <input
                                                            type="text"
                                                            value={t.num_tarjeta}
                                                            placeholder="-0000"
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                                                                handleTarjetaChange(t.id, 'num_tarjeta', raw);
                                                            }}
                                                            onBlur={(e) => {
                                                                const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                                                                const formatted = raw ? '-' + raw.padStart(4, '0') : '';
                                                                handleTarjetaChange(t.id, 'num_tarjeta', formatted);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="No. Autorización">
                                                        <input
                                                            type="text"
                                                            value={t.num_autorizacion}
                                                            placeholder="Autorización"
                                                            onChange={(e) => handleTarjetaChange(t.id, 'num_autorizacion', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo POS">
                                                        <select
                                                            value={t.pos_type_id || ''}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'pos_type_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {posTypesList.map(p => (
                                                                <option key={p.id} value={p.id}>{p.nombre}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={t.despachador_id || ''}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                                            {despachadoresOptions.map(d => (
                                                                <option key={d.id} value={d.id}>{d.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo Operación">
                                                        <select
                                                            value={t.tipo_operacion || 'venta_combustible'}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'tipo_operacion', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="venta_combustible">Venta de Combustible</option>
                                                            <option value="recuperacion_credito">Recuperación de Crédito</option>
                                                            <option value="pago_anticipado">Pago Anticipado</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={t.monto}
                                                        onChange={(e) => handleTarjetaChange(t.id, 'monto', parseFloat(e.target.value) || 0)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                    />
                                                    </td>
{estado !== 'cerrado' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveTarjeta(t.id)}
                                                                className="p-0.5 text-slate-600 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado !== 'cerrado' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={7} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddTarjetaRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Tarjeta
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Tarjetas: <strong className="text-red-600 font-mono text-sm"><Money value={tarjetasTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => handleSaveSection('tarjetas')}
                                                                disabled={isSaving}
                                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                                                    isDirty
                                                                        ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                                                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                                }`}
                                                            >
                                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Tarjetas (Pendiente)' : 'Guardar Tarjetas')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                                {tarjetasResumenPorTipo.length > 0 && (
                                    <div className="mt-3 border border-indigo-100 bg-indigo-50/40 rounded-xl overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-600">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                                                <BarChart3 size={12} />
                                                Resumen por Tipo de POS
                                            </span>
                                        </div>
                                        <div className="divide-y divide-indigo-100/70">
                                            {tarjetasResumenPorTipo.map(g => (
                                                <div key={g.key} className="flex items-center justify-between px-3 py-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{g.nombre}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                                                            {g.cantidad} {g.cantidad === 1 ? 'tarjeta' : 'tarjetas'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] font-mono font-bold text-red-600 whitespace-nowrap">
                                                        <Money value={g.total} />
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between px-3 py-1.5 bg-white/70">
                                                <span className="text-[11px] font-black text-slate-700">Total General</span>
                                                <span className="text-xs font-mono font-black text-red-600"><Money value={tarjetasTotal} /></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
    );
};

export default GasTarjetasModal;
