import { useState } from 'react';
import { Droplets, ShieldCheck, Loader2, RefreshCw, X, Plus, Trash2, Save } from 'lucide-react';
import Money from '../ui/Money';
import GasAddLubricantModal from './GasAddLubricantModal';

const defaultInputCls = "w-28 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
const defaultInputDisabledCls = "w-28 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500 cursor-not-allowed";

const GasLubricantesModal = ({
    isOpen,
    onClose,
    estado,
    editAnterior,
    setEditAnterior,
    handleRecargarLubricantes,
    lubricantLoading = false,
    lubricantReadings = [],
    setLubricantReadings,
    handleLubricantChange,
    handleLubricantBlur,
    handleSaveLubricantes,
    isSaving = false,
    handleLubricantKeyDown,
    lubricantInputRefs,
    lubricantTotal = 0,
    inputCls = defaultInputCls,
    inputDisabledCls = defaultInputDisabledCls,
    onAddProduct,
    onRemoveProduct,
    branchId,
    closeoutId
}) => {
    const [showAddModal, setShowAddModal] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={isSaving ? undefined : onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Droplets size={16} className="text-indigo-600" />
                        Lecturas de Lubricantes
                        {estado === 'cerrado' && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                        )}
                        {estado !== 'cerrado' && (
                            <button
                                type="button"
                                onClick={() => setEditAnterior(prev => !prev)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                                    editAnterior
                                    ? 'text-amber-700 bg-amber-100 border-amber-300'
                                    : 'text-slate-500 bg-slate-50 border-slate-200'
                                }`}
                            >
                                <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                                {editAnterior ? 'Lect. inicial editable' : 'Editar lect. inicial'}
                            </button>
                        )}
                    </h3>
                    <div className="flex items-center gap-2">
                        {estado !== 'cerrado' && (
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-sm"
                            >
                                <Plus size={13} />
                                Agregar Lubricante
                            </button>
                        )}
                        <button
                            onClick={handleRecargarLubricantes}
                            disabled={lubricantLoading}
                            title="Reinicializar desde el último turno"
                            className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {lubricantLoading ? (
                                <Loader2 size={16} className="text-indigo-500 animate-spin" />
                            ) : (
                                <RefreshCw size={16} className="text-slate-400" />
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <X size={16} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto px-4 pb-4 flex-1 relative">
                    <table className="w-full text-left border-separate border-spacing-0 table-cards">
                        <thead className="sticky top-0 z-20">
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100">Código</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 max-w-[140px]">Descripción</th>
                                <th className={`px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28 ${editAnterior ? 'text-amber-600' : ''}`}>
                                    Inicial{editAnterior && '*'}
                                </th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Recarga</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Final</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Ventas</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Precio</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Total</th>
                                {estado !== 'cerrado' && (
                                    <th className="px-1 py-1 bg-slate-50 border-b border-slate-100 text-center w-8"></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {lubricantReadings.length === 0 && (
                                <tr>
                                    <td colSpan={estado !== 'cerrado' ? 9 : 8} className="px-3 py-8 text-center text-xs text-slate-400">
                                        No hay productos de lubricantes con existencia en este turno.
                                    </td>
                                </tr>
                            )}
                            {lubricantReadings.map((r, idx) => {
                                const ventas = parseFloat(r.lectura_inicial || 0) + parseFloat(r.recarga || 0) - parseFloat(r.lectura_final || 0);
                                const total = ventas * parseFloat(r.precio || 0);
                                return (
                                    <tr key={r.producto_id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                        <td className="px-1.5 py-0.5 font-bold text-slate-900" data-label="Código">{r.producto_codigo}</td>
                                        <td className="px-1.5 py-0.5 max-w-[140px] truncate" data-label="Descripción">
                                            <span className="font-medium text-slate-800">{r.producto_descripcion}</span>
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Inicial">
                                            {editAnterior ? (
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    ref={(el) => {
                                                        if (lubricantInputRefs?.current) {
                                                            lubricantInputRefs.current[`lub-anterior-${r.producto_id}`] = el;
                                                        }
                                                    }}
                                                    value={r.lectura_inicial ?? ''}
                                                    onChange={(e) => {
                                                        if (handleLubricantChange) {
                                                            handleLubricantChange(r.producto_id, 'lectura_inicial', e.target.value);
                                                        } else {
                                                            setLubricantReadings(prev => prev.map(x =>
                                                                x.producto_id === r.producto_id
                                                                    ? { ...x, lectura_inicial: e.target.value }
                                                                    : x
                                                            ));
                                                        }
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={handleLubricantBlur}
                                                    onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'lectura_inicial')}
                                                    disabled={estado === 'cerrado'}
                                                    className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                />
                                            ) : (
                                                <span className="font-mono text-slate-600 whitespace-nowrap">{parseFloat(r.lectura_inicial || 0).toFixed(5)}</span>
                                            )}
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Recarga">
                                            <input
                                                type="number"
                                                step="0.00001"
                                                ref={(el) => {
                                                    if (lubricantInputRefs?.current) {
                                                        lubricantInputRefs.current[`lub-recarga-${r.producto_id}`] = el;
                                                    }
                                                }}
                                                value={r.recarga ?? ''}
                                                onChange={(e) => {
                                                    if (handleLubricantChange) {
                                                        handleLubricantChange(r.producto_id, 'recarga', e.target.value);
                                                    } else {
                                                        setLubricantReadings(prev => prev.map(x =>
                                                            x.producto_id === r.producto_id
                                                                ? { ...x, recarga: e.target.value }
                                                                : x
                                                        ));
                                                    }
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                onBlur={handleLubricantBlur}
                                                onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'recarga')}
                                                disabled={estado === 'cerrado'}
                                                className={estado === 'cerrado' ? inputDisabledCls : inputCls}
                                            />
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Final">
                                            <input
                                                type="number"
                                                step="0.00001"
                                                ref={(el) => {
                                                    if (lubricantInputRefs?.current) {
                                                        lubricantInputRefs.current[`lub-final-${r.producto_id}`] = el;
                                                    }
                                                }}
                                                value={r.lectura_final ?? ''}
                                                onChange={(e) => {
                                                    if (handleLubricantChange) {
                                                        handleLubricantChange(r.producto_id, 'lectura_final', e.target.value);
                                                    } else {
                                                        setLubricantReadings(prev => prev.map(x =>
                                                            x.producto_id === r.producto_id
                                                                ? { ...x, lectura_final: e.target.value }
                                                                : x
                                                        ));
                                                    }
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                onBlur={handleLubricantBlur}
                                                onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'lectura_final')}
                                                disabled={estado === 'cerrado'}
                                                className={estado === 'cerrado' ? inputDisabledCls : inputCls}
                                            />
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-800" data-label="Ventas">{ventas.toFixed(5)}</td>
                                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-700" data-label="Precio"><Money value={parseFloat(r.precio || 0)} /></td>
                                        <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900" data-label="Total">
                                            <Money value={total} />
                                        </td>
                                        {estado !== 'cerrado' && (
                                            <td className="px-1 py-0.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveProduct && onRemoveProduct(r.producto_id)}
                                                    title="Quitar producto de este turno"
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                            <tr>
                                <td colSpan={estado !== 'cerrado' ? 8 : 7} className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Lubricantes</td>
                                <td className="px-3 py-1.5 text-right font-mono text-indigo-600">
                                    <Money value={lubricantTotal} />
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {estado !== 'cerrado' && (
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                            >
                                <Plus size={14} />
                                Agregar Lubricante sin Existencia Anterior
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl shrink-0">
                    <div className="text-xs text-slate-500 font-medium">
                        Total: <span className="font-bold text-slate-800"><Money value={lubricantTotal} /></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cerrar
                        </button>
                        {estado !== 'cerrado' && (
                            <button
                                type="button"
                                disabled={isSaving}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    if (handleSaveLubricantes) {
                                        handleSaveLubricantes({ closeAfter: true });
                                    } else {
                                        handleLubricantBlur();
                                        onClose();
                                    }
                                }}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Save size={13} />
                                )}
                                {isSaving ? 'Guardando...' : 'Guardar y Salir'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <GasAddLubricantModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelect={(product) => onAddProduct && onAddProduct(product)}
                existingProductIds={lubricantReadings.map(r => r.producto_id)}
                branchId={branchId}
                closeoutId={closeoutId}
            />
        </div>
    );
};

export default GasLubricantesModal;
