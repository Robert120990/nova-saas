import {
    FileText,
    Save,
    AlertCircle,
    Barcode,
    Search,
    Check,
    Package,
    Trash2
} from 'lucide-react';
import Money from '../../ui/Money';

const inputCls = 'w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[13px] font-medium';
const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1';

const NewAdjustmentTab = ({
    branchId,
    setBranchId,
    branches = [],
    tipo,
    setTipo,
    fecha,
    setFecha,
    numero,
    setNumero,
    motivoId,
    setMotivoId,
    motivos = [],
    observaciones,
    setObservaciones,
    selectedItems = [],
    totalAjuste = 0,
    isSubmitting = false,
    onSubmit,
    onCancel,
    barcodeInputRef,
    qtyInputRef,
    costInputRef,
    quickBarcode,
    setQuickBarcode,
    handleBarcodeSubmit,
    onOpenProductSearch,
    quickProd,
    quickCant,
    setQuickCant,
    quickCosto,
    setQuickCosto,
    handleAddQuick,
    updateItem,
    removeItem
}) => {
    const isHeaderLocked = !branchId || !motivoId;
    const branchList = Array.isArray(branches) ? branches : [];
    const motivoList = (Array.isArray(motivos) ? motivos : []).filter((m) => m.tipo === tipo);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <FileText size={18} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configuración del Movimiento</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelCls}>Sucursal</label>
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className={inputCls}
                            >
                                <option value="">Seleccionar Sucursal...</option>
                                {branchList.map((b) => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Tipo</label>
                            <select
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value)}
                                className={inputCls}
                            >
                                <option value="ENTRADA">ENTRADA</option>
                                <option value="SALIDA">SALIDA</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Fecha</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className={labelCls}>Número (Opcional)</label>
                            <input
                                type="text"
                                value={numero}
                                onChange={(e) => setNumero(e.target.value)}
                                placeholder="Doc #"
                                className={inputCls}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelCls}>Motivo</label>
                            <select
                                value={motivoId}
                                onChange={(e) => setMotivoId(e.target.value)}
                                className={inputCls}
                            >
                                <option value="">Seleccionar Motivo...</option>
                                {motivoList.map((m) => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Observaciones</label>
                        <input
                            type="text"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Ingrese observaciones del movimiento..."
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="lg:col-span-1 h-full">
                    <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-4 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center text-[10px] opacity-60 uppercase font-black mb-2">
                                <span>Items: {selectedItems.length}</span>
                                <span>Subtotal: <Money value={totalAjuste} /></span>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/10 pt-4">
                                <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Total Ajuste</span>
                                <span className="text-2xl font-black"><Money value={totalAjuste} /></span>
                            </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <button
                                onClick={onSubmit}
                                disabled={isSubmitting || selectedItems.length === 0}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-bold transition-all text-center"
                            >
                                Cancelar y Volver
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 relative ${isHeaderLocked ? 'opacity-40 grayscale pointer-events-none select-none' : ''}`}>
                    {isHeaderLocked && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-100 shadow-2xl max-w-sm animate-in zoom-in-95 duration-300">
                                <AlertCircle size={32} className="mx-auto mb-3 text-amber-500" />
                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-relaxed">
                                    Seleccione la sucursal y el motivo del movimiento para comenzar a agregar productos.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/30 rounded-xl">
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-[190px_1fr_100px_120px_100px_50px] gap-2 items-end">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Producto (F3)</label>
                                    <div className="relative flex items-center gap-1">
                                        <div className="relative flex-1">
                                            <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                ref={barcodeInputRef}
                                                type="text"
                                                value={quickBarcode}
                                                onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())}
                                                onKeyDown={handleBarcodeSubmit}
                                                placeholder="CÓDIGO + ENTER"
                                                className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-mono text-xs font-bold h-[34px]"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={onOpenProductSearch}
                                            title="Buscar producto (F3)"
                                            className="h-[34px] px-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-xl flex items-center justify-center transition-colors"
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Descripción</label>
                                    <div className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 truncate h-[34px] flex items-center">
                                        {quickProd?.nombre || '---'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cant.</label>
                                    <input
                                        ref={qtyInputRef}
                                        type="number"
                                        value={quickCant}
                                        onChange={(e) => setQuickCant(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && costInputRef.current?.focus()}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 text-xs font-black text-center h-[34px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Costo Unit.</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">$</span>
                                        <input
                                            ref={costInputRef}
                                            type="number"
                                            value={quickCosto}
                                            onChange={(e) => setQuickCosto(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 text-xs font-black text-right h-[34px]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right pr-1 italic">Total</label>
                                    <div className="w-full px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-600 text-right h-[34px] flex items-center justify-end">
                                        <Money value={parseFloat(quickCant || 0) * parseFloat(quickCosto || 0)} />
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddQuick}
                                    disabled={!quickProd}
                                    className="h-[34px] w-full bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                >
                                    <Check size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto min-h-[380px]">
                            <table className="w-full text-left border-collapse table-cards">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 font-bold text-[10px] text-slate-500 uppercase tracking-widest">
                                        <th className="px-6 py-2">Código</th>
                                        <th className="px-6 py-2">Producto</th>
                                        <th className="px-6 py-2 text-center w-24">Cant.</th>
                                        <th className="px-6 py-2 text-right w-32">Costo U.</th>
                                        <th className="px-6 py-2 text-right w-32">Total</th>
                                        <th className="px-6 py-2 text-right w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-24 text-center">
                                                <div className="flex flex-col items-center gap-3 text-slate-300">
                                                    <Package size={48} className="opacity-20" />
                                                    <p className="text-sm font-bold uppercase tracking-widest">Lista Vacía</p>
                                                    <p className="text-xs font-medium text-slate-400">Escanea o selecciona productos manualmente (F3)</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedItems.map((item) => (
                                            <tr key={item.product_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 grow">
                                                <td className="px-6 py-1.5" data-label="Código">
                                                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded">{item.codigo}</span>
                                                </td>
                                                <td className="px-6 py-1.5" data-label="Producto">
                                                    <div className="text-xs font-bold text-slate-700">{item.nombre}</div>
                                                </td>
                                                <td className="px-6 py-1.5" data-label="Cant.">
                                                    <input
                                                        type="number"
                                                        value={item.cantidad}
                                                        onChange={(e) => updateItem(item.product_id, 'cantidad', parseFloat(e.target.value))}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full bg-transparent border-none rounded-lg text-center font-black py-0.5 text-xs focus:ring-2 focus:ring-indigo-500/10"
                                                    />
                                                </td>
                                                <td className="px-6 py-1.5" data-label="Costo U.">
                                                    <div className="relative">
                                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[10px]">$</span>
                                                        <input
                                                            type="number"
                                                            value={item.costo}
                                                            onChange={(e) => updateItem(item.product_id, 'costo', parseFloat(e.target.value))}
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full bg-transparent border-none rounded-lg pl-4 text-right font-bold py-0.5 text-xs focus:ring-2 focus:ring-indigo-500/10"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1.5 text-right" data-label="Total">
                                                    <span className="text-xs font-black text-slate-900"><Money value={item.total} /></span>
                                                </td>
                                                <td className="px-6 py-1.5 text-right" data-label="">
                                                    <button
                                                        onClick={() => removeItem(item.product_id)}
                                                        className="p-1 text-slate-600 hover:text-rose-500 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewAdjustmentTab;
