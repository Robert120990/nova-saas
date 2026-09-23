import { Percent, X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import Money, { MoneyInput } from '../ui/Money';

const GasDescuentosModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    descuentos = [],
    loadCustomers,
    fuelProducts = [],
    despachadoresOptions = [],
    handleDescuentoChange,
    handleRemoveDescuento,
    handleAddDescuentoRow,
    descuentosTotal = 0,
    handleSaveSection,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (

                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Percent size={16} className="text-indigo-600" />
                                    Descuentos del Turno
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
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-16">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-16">Valor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Total</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {descuentos.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay descuentos registrados. Agregue un descuento para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {descuentos.map(d => (
                                            <tr key={d.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Documento">
                                                    <input
                                                        type="text"
                                                        value={d.documento}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'documento', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° documento"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Cliente">
                                                    <SearchableSelect
                                                        loadOptions={loadCustomers()}
                                                        value={d.cliente_id}
                                                        onChange={(e, opt) => {
                                                            handleDescuentoChange(d.id, 'cliente_id', e.target.value);
                                                            handleDescuentoChange(d.id, 'cliente_nombre', opt ? opt.nombre : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="Buscar cliente..."
                                                        valueKey="id"
                                                        labelKey="nombre"
                                                        displayKey="nombre"
                                                        codeKey="nit"
                                                        codeLabel="NIT/DOC"
                                                        selectedLabel={d.cliente_nombre}
                                                        dropdownWidth={420}
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Producto">
                                                    <select
                                                        value={d.producto_codigo}
                                                        onChange={(e) => {
                                                            const cod = e.target.value;
                                                            const prod = fuelProducts.find(p => p.codigo === cod);
                                                            handleDescuentoChange(d.id, 'producto_codigo', cod);
                                                            handleDescuentoChange(d.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {fuelProducts.map(p => (
                                                            <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={d.despachador_id || ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                                        {despachadoresOptions.map(disp => (
                                                            <option key={disp.id} value={disp.id}>{disp.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Cantidad">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={d.cantidad || ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'cantidad', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Valor">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={d.valor ?? ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'valor', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Total">
                                                    <span className="font-mono font-bold text-slate-900"><Money value={(parseFloat(d.cantidad) || 0) * (parseFloat(d.valor) || 0)} /></span>
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveDescuento(d.id)}
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
                                            onClick={handleAddDescuentoRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Descuento
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Descuentos: <strong className="text-red-600 font-mono text-sm"><Money value={descuentosTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => handleSaveSection('descuentos')}
                                                disabled={isSaving}
                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                                    isDirty
                                                        ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                }`}
                                            >
                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Descuentos (Pendiente)' : 'Guardar Descuentos')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
    );
};

export default GasDescuentosModal;
