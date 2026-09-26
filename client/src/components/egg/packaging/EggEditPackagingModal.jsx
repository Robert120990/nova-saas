import { Pencil, ShieldCheck, Lock, X } from 'lucide-react';

const PRODUCT_OPTIONS = [
    { value: 'huevo entero', label: 'Huevo Entero Pasteurizado' },
    { value: 'huevo rapido', label: 'Huevo Entero Rápido' },
    { value: 'clara', label: 'Clara de Huevo Pasteurizada' },
    { value: 'clara ppg', label: 'Clara PPG Pasteurizada' },
    { value: 'yema', label: 'Yema Líquida Pasteurizada' },
    { value: 'yema azucarada', label: 'Yema Pasteurizada Azucarada' },
    { value: 'yema salada', label: 'Yema Pasteurizada Salada' },
    { value: 'fórmula especial', label: 'Fórmula Especial / Otros' }
];

const PRESENTATION_OPTIONS = [
    'cubeta 30LB',
    'cubeta 32LB',
    'galón 8LB',
    'medio galón 4LB',
    'litro 2LB',
    'bolsa 5LB',
    'tambor 400LB'
];

const EggEditPackagingModal = ({
    isOpen,
    onClose,
    packaging,
    packagingForm,
    setPackagingForm,
    onSubmit,
    isSubmitting,
    canEditLots = false,
    batches = [],
    onReopenPackaging
}) => {
    if (!isOpen || !packaging) return null;

    const relatedBatch = batches.find(b => b.id === (packagingForm.batch_id ? parseInt(packagingForm.batch_id, 10) : packaging?.batch_id));
    const isBatchClosed = relatedBatch?.packaging_status === 'cerrado';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-600" />
                        Editar Empaque
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="h-px bg-slate-100" />

                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Alerta de Lote Cerrado y opción de volver a abrir */}
                    {isBatchClosed && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-amber-700 shrink-0" />
                                <div>
                                    <span className="font-bold block text-amber-800">Lote de Envasado Cerrado</span>
                                    <span className="text-[11px] text-amber-700">
                                        El lote {relatedBatch.batch_code_display || relatedBatch.id} está cerrado técnicamente.
                                    </span>
                                </div>
                            </div>
                            {canEditLots && onReopenPackaging && (
                                <button
                                    type="button"
                                    onClick={() => onReopenPackaging(relatedBatch)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                                    title="Volver a abrir el envasado para este lote"
                                >
                                    <Lock size={12} />
                                    Reabrir Envasado
                                </button>
                            )}
                        </div>
                    )}

                    {canEditLots && isBatchClosed && (
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={!!packagingForm.reopen_packaging}
                                onChange={(e) => setPackagingForm({ ...packagingForm, reopen_packaging: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Volver a abrir el envasado de este lote al guardar cambios</span>
                        </label>
                    )}

                    {/* Sección de Lote y Producto según permiso */}
                    {canEditLots ? (
                        <div className="space-y-3 p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100/70">
                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                    <ShieldCheck size={13} className="text-indigo-600" />
                                    Permiso Especial: Edición de Lote & Producto
                                </span>
                                <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md uppercase">Habilitado</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Número / Código de Lote *
                                    </label>
                                    <input
                                        type="text"
                                        value={packagingForm.lot_code || ''}
                                        onChange={(e) => setPackagingForm({ ...packagingForm, lot_code: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej. LOT-02-267-26"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Lote de Producción Base
                                    </label>
                                    <select
                                        value={packagingForm.batch_id || ''}
                                        onChange={(e) => {
                                            const bid = e.target.value;
                                            const bObj = batches.find(b => b.id === parseInt(bid, 10));
                                            setPackagingForm({
                                                ...packagingForm,
                                                batch_id: bid,
                                                product_type: bObj ? (bObj.product_type || 'huevo entero').toLowerCase() : packagingForm.product_type
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                [{b.batch_code_display || b.batch_uuid}] {b.product_type} {b.packaging_status === 'cerrado' ? '(Cerrado)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Producto a Envasar *
                                    </label>
                                    <select
                                        value={packagingForm.product_type || 'huevo entero'}
                                        onChange={(e) => setPackagingForm({ ...packagingForm, product_type: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                                    >
                                        {PRODUCT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Presentación Comercial
                                    </label>
                                    <input
                                        type="text"
                                        list="edit-presentation-options"
                                        value={packagingForm.presentation || ''}
                                        onChange={(e) => setPackagingForm({ ...packagingForm, presentation: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej. cubeta 30LB, cubeta 32LB..."
                                    />
                                    <datalist id="edit-presentation-options">
                                        {PRESENTATION_OPTIONS.map(pres => (
                                            <option key={pres} value={pres} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote</label>
                                <input
                                    type="text"
                                    value={packaging.lot_code}
                                    disabled
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold"
                                />
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500 font-bold uppercase">Producto:</span>
                                <span className="font-bold text-slate-800 capitalize">
                                    {packaging.product_type || 'Huevo Entero'} ({packaging.presentation || 'cubeta'})
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Unidades</label>
                            <input
                                type="number"
                                value={packagingForm.units_packaged}
                                onChange={(e) => setPackagingForm({ ...packagingForm, units_packaged: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso/Unidad (Lbs)</label>
                            <input
                                type="number"
                                value={packagingForm.weight_per_unit_lbs}
                                onChange={(e) => setPackagingForm({ ...packagingForm, weight_per_unit_lbs: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                step="0.01"
                                required
                            />
                        </div>
                    </div>

                    {packagingForm.units_packaged && packagingForm.weight_per_unit_lbs && (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] font-bold text-teal-700 uppercase block">Total</span>
                            <span className="text-sm font-bold text-teal-800">
                                {(parseFloat(packagingForm.units_packaged || 0) * parseFloat(packagingForm.weight_per_unit_lbs || 0)).toFixed(2)} Lbs
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggEditPackagingModal;
