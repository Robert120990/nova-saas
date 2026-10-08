import { useState } from 'react';
import { Plus, Lock, X } from 'lucide-react';
import PackagingColdChainSection from './PackagingColdChainSection';
import PackagingBatchBalanceCard from './PackagingBatchBalanceCard';
import PackagingItemsSection from './PackagingItemsSection';

const EggNewPackagingModal = ({
    isOpen,
    onClose,
    packagingForm,
    setPackagingForm,
    batches = [],
    isSubmitting,
    onSubmit,
    onOpenCloseBatch,
    onReopenPackaging,
    canClosePackaging
}) => {
    const [showClosedBatches, setShowClosedBatches] = useState(false);

    if (!isOpen) return null;

    const currentBatch = batches.find(b => b.id === parseInt(packagingForm.batch_id));
    const allRunBatches = currentBatch ? batches.filter(b => {
        const rootId = currentBatch.parent_batch_id || currentBatch.id;
        return b.id === rootId || b.parent_batch_id === rootId;
    }) : [];

    const selectBatch = (batch) => {
        if (!batch) return;
        const pType = (batch.product_type || 'huevo entero').toLowerCase();
        let defaultPres = 'cubeta 30LB';
        let defaultW = '30.00';

        if (batch.presentation) {
            const firstPres = batch.presentation.split(',')[0].trim();
            if (firstPres.includes('32')) { defaultPres = 'cubeta 32LB'; defaultW = '32.00'; }
            else if (firstPres.toLowerCase().includes('galón') || firstPres.includes('8LB')) { defaultPres = 'galón 8LB'; defaultW = '8.00'; }
            else if (firstPres.includes('4LB') || firstPres.toLowerCase().includes('medio')) { defaultPres = 'medio galón 4LB'; defaultW = '4.00'; }
            else if (firstPres.includes('2LB') || firstPres.toLowerCase().includes('litro')) { defaultPres = 'litro 2LB'; defaultW = '2.00'; }
            else if (firstPres.includes('5LB') || firstPres.toLowerCase().includes('bolsa')) { defaultPres = 'bolsa 5LB'; defaultW = '5.00'; }
        }

        setPackagingForm({
            ...packagingForm,
            batch_id: String(batch.id),
            product_type: pType,
            items: [
                { presentation: defaultPres, units_packaged: '', weight_per_unit_lbs: defaultW }
            ]
        });
    };

    const eligibleBatches = (Array.isArray(batches) ? batches : []).filter(
        b => ['pasteurizado', 'aprobado_calidad', 'empaquetado', 'bloqueado_haccp'].includes(b.status)
    );
    const openBatches = eligibleBatches.filter(b => {
        const packaged = parseFloat(b.packaged_weight_lbs || 0);
        const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - packaged);
        return b.packaging_status !== 'cerrado' && disp > 0.01;
    });
    const closedBatches = eligibleBatches.filter(b => {
        const packaged = parseFloat(b.packaged_weight_lbs || 0);
        const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - packaged);
        return b.packaging_status === 'cerrado' || disp <= 0.01;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Plus className="h-5 w-5 text-purple-600" />
                            Registrar Empaque y Envasado de Producto
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Genere la numeración de lote comercial e imprima la etiqueta QR de trazabilidad por cada lote.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Selector de Lote Pasteurizado */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                Lote Pasteurizado Aprobado a Envasar *
                            </label>
                            {closedBatches.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowClosedBatches(prev => !prev)}
                                    className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    {showClosedBatches ? 'Ocultar cerrados (saldo 0)' : `Mostrar cerrados (${closedBatches.length})`}
                                </button>
                            )}
                        </div>
                        <select
                            value={packagingForm.batch_id}
                            onChange={(e) => {
                                const selected = batches.find(b => b.id === parseInt(e.target.value));
                                selectBatch(selected);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            <option value="">Seleccione Lote Disponible...</option>
                            {openBatches.length > 0 && (
                                <optgroup label="✨ Lotes Disponibles para Envasar">
                                    {openBatches.map(b => {
                                        const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                        const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - packaged);
                                        const tagPrefix = (packaged > 0 && disp > 0)
                                            ? `⚠️ [PARCIAL: Faltan ${disp.toFixed(0)} Lbs]`
                                            : `🟢 [DISP: ${disp.toFixed(0)} Lbs]`;
                                        const coprodTag = b.is_coproduct ? ' 🔗 [CO-PRODUCTO]' : '';
                                        return (
                                            <option key={b.id} value={b.id} disabled={b.status === 'bloqueado_haccp'}>
                                                {tagPrefix}{coprodTag} [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation}) - Env: {packaged.toFixed(0)} Lbs / Disp: {disp.toFixed(0)} Lbs{b.status === 'bloqueado_haccp' ? ' [BLOQUEADO HACCP]' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                            {showClosedBatches && closedBatches.length > 0 && (
                                <optgroup label="🔒 Lotes Cerrados / Saldo Cero">
                                    {closedBatches.map(b => {
                                        const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                        const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - packaged);
                                        const isClosed = b.packaging_status === 'cerrado';
                                        const coprodTag = b.is_coproduct ? ' 🔗 [CO-PRODUCTO]' : '';
                                        return (
                                            <option key={b.id} value={b.id} disabled={b.status === 'bloqueado_haccp'}>
                                                {isClosed ? '🔒 [CERRADO]' : '⚪ [SALDO 0]'}{coprodTag} [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation}) - Env: {packaged.toFixed(0)} Lbs / Disp: {disp.toFixed(0)} Lbs
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                            {!showClosedBatches && currentBatch && closedBatches.some(b => b.id === currentBatch.id) && (
                                <optgroup label="🔒 Lote Seleccionado (Cerrado)">
                                    <option value={currentBatch.id}>
                                        🔒 [CERRADO] [{currentBatch.batch_code_display || currentBatch.batch_uuid}] {currentBatch.product_type} - Disp: 0 Lbs
                                    </option>
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Sibling Switcher si pertenece a una corrida multi-lote */}
                    {allRunBatches.length > 1 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <span>⚡ Lotes de esta corrida de quebrado ({allRunBatches.length} Lotes):</span>
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {allRunBatches.map((b, idx) => {
                                    const isSelected = parseInt(packagingForm.batch_id) === b.id;
                                    const isPrimary = !b.is_coproduct;
                                    return (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => selectBatch(b)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                isSelected
                                                    ? (isPrimary ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-teal-600 text-white border-teal-700 shadow-xs')
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                            }`}
                                        >
                                            {isPrimary ? '🥚 Lote 1' : `🔗 Lote ${idx + 1}`}: {b.batch_code_display || b.batch_uuid} ({b.product_type})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentBatch && currentBatch.status === 'bloqueado_haccp' && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 flex gap-2 font-bold text-xs">
                            <Lock size={16} className="shrink-0 text-rose-600" />
                            <span>Este lote tiene bloqueo de inocuidad activo. El envasado está inhabilitado hasta su evaluación de calidad.</span>
                        </div>
                    )}

                    <PackagingBatchBalanceCard
                        currentBatch={currentBatch}
                        packagingItems={packagingForm.items}
                        onReopenPackaging={onReopenPackaging}
                        onOpenCloseBatch={onOpenCloseBatch}
                        canClosePackaging={canClosePackaging}
                    />

                    {/* Selección de Producto */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Producto a Envasar *
                        </label>
                        <select
                            value={packagingForm.product_type}
                            onChange={(e) => setPackagingForm({ ...packagingForm, product_type: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            <option value="huevo entero">Huevo Entero Pasteurizado</option>
                            <option value="huevo rapido">Huevo Entero Rápido</option>
                            <option value="clara">Clara de Huevo Pasteurizada</option>
                            <option value="clara ppg">Clara PPG Pasteurizada</option>
                            <option value="yema">Yema Líquida Pasteurizada</option>
                            <option value="yema azucarada">Yema Pasteurizada Azucarada</option>
                            <option value="yema salada">Yema Pasteurizada Salada</option>
                            <option value="fórmula especial">Fórmula Especial / Otros</option>
                        </select>
                    </div>

                    {/* Partidas a Envasar */}
                    <PackagingItemsSection
                        packagingForm={packagingForm}
                        setPackagingForm={setPackagingForm}
                    />

                    <PackagingColdChainSection
                        packagingForm={packagingForm}
                        setPackagingForm={setPackagingForm}
                    />

                    {/* Resumen Total */}
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-teal-800 uppercase">Total Producción a Envasar:</span>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-600 font-medium">
                                Unidades: <strong className="text-slate-900 font-bold">{(packagingForm.items || []).reduce((acc, it) => acc + (parseInt(it.units_packaged) || 0), 0)} Uds</strong>
                            </span>
                            <span className="text-teal-900 font-black text-sm">
                                {(packagingForm.items || []).reduce((acc, it) => acc + ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lbs
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (currentBatch && (
                                currentBatch.status === 'bloqueado_haccp' ||
                                currentBatch.packaging_status === 'cerrado'
                            ))}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                        >
                            {isSubmitting ? 'Guardando...' : 'Confirmar & Generar Lote'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggNewPackagingModal;
