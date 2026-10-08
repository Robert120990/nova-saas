import { useState, useEffect } from 'react';
import {
    Flame,
    AlertOctagon
} from 'lucide-react';
import PasteurizeLotCard from './PasteurizeLotCard';

export default function ProductionIsPasteurizeModalOpenModal({
    model,
    open = model.isPasteurizeModalOpen,
    onClose = () => {
        model.setHaccpViolationAlert(null);
        model.setIsPasteurizeModalOpen(false);
    },
    onSave = model.handlePasteurize
}) {
    const {
        batches = [],
        selectedBatchForPasteurize,
        setSelectedBatchForPasteurize,
        pasteurizeForm,
        setPasteurizeForm,
        secondPasteurizeForm,
        setSecondPasteurizeForm,
        handlePasteurizeDual,
        isSubmitting,
        haccpViolationAlert
    } = model;

    const [pasteurizeMode, setPasteurizeMode] = useState('dual'); // 'dual' | 'single'

    const safeBatches = Array.isArray(batches) ? batches : [];
    const currentBatch = safeBatches.find(b => String(b.id) === String(selectedBatchForPasteurize));
    const companionBatch = safeBatches.find(b =>
        currentBatch && (
            (currentBatch.parent_batch_id && b.id === currentBatch.parent_batch_id) ||
            (b.parent_batch_id && b.parent_batch_id === currentBatch.id) ||
            (currentBatch.parent_batch_id && b.parent_batch_id === currentBatch.parent_batch_id && b.id !== currentBatch.id)
        )
    );

    const primaryBatch = currentBatch?.is_coproduct ? companionBatch : currentBatch;
    const secondaryBatch = currentBatch?.is_coproduct ? currentBatch : companionBatch;
    const hasDualLots = Boolean(primaryBatch && secondaryBatch && primaryBatch.id !== secondaryBatch.id);

    const getSafeTemp = (productType) => {
        const p = (productType || '').toLowerCase();
        if (p.includes('clara')) return '57.0';
        if (p.includes('yema')) return '66.5';
        return '64.5';
    };

    const getHaccpGuide = (productType) => {
        const p = (productType || '').toLowerCase();
        if (p.includes('clara')) return { minTemp: '56.0°C', time: '210 seg', label: 'Clara Líquida' };
        if (p.includes('yema')) return { minTemp: '66.5°C', time: '210 seg', label: 'Yema / Salada' };
        return { minTemp: '64.0°C', time: '210 seg', label: 'Huevo Entero' };
    };

    useEffect(() => {
        if (primaryBatch) {
            setPasteurizeForm(prev => ({
                ...prev,
                temperature_c: prev.temperature_c || getSafeTemp(primaryBatch.product_type),
                pasteurization_lot: prev.pasteurization_lot || primaryBatch.pasteurization_lot || `PAST-${primaryBatch.batch_code_display?.replace(/\s+/g, '') || primaryBatch.id}`
            }));
        }
        if (secondaryBatch) {
            setSecondPasteurizeForm(prev => ({
                ...prev,
                temperature_c: prev.temperature_c || getSafeTemp(secondaryBatch.product_type),
                pasteurization_lot: prev.pasteurization_lot || secondaryBatch.pasteurization_lot || `PAST-${secondaryBatch.batch_code_display?.replace(/\s+/g, '') || secondaryBatch.id}`
            }));
        }
    }, [selectedBatchForPasteurize]);

    if (!open) return null;

    const isDualActive = hasDualLots && pasteurizeMode === 'dual';
    const selectedBatchObj = currentBatch;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto space-y-5 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-600" />
                            Registro de Parámetros de Pasteurización Térmica
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Verifique termómetros y manómetros antes de validar el tratamiento térmico HACCP por cada lote.
                        </p>
                    </div>
                </div>

                {/* Guía Rápida de Límites de Pasteurización ANDELSA */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block font-bold uppercase text-[10px]">Huevo Entero</span>
                        <span className="text-slate-900 font-bold text-xs">≥ 64.0°C</span>
                        <span className="text-slate-400 block text-[9px]">210 seg</span>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block font-bold uppercase text-[10px]">Clara Líquida</span>
                        <span className="text-slate-900 font-bold text-xs">≥ 56.0°C</span>
                        <span className="text-slate-400 block text-[9px]">210 seg</span>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block font-bold uppercase text-[10px]">Yema / Salada</span>
                        <span className="text-slate-900 font-bold text-xs">≥ 66.5°C</span>
                        <span className="text-slate-400 block text-[9px]">210 seg</span>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                        <span className="text-amber-700 block font-bold uppercase text-[10px]">Fórmulas / Otras</span>
                        <span className="text-amber-950 font-bold text-xs">≥ 64.0°C</span>
                        <span className="text-amber-600 block text-[9px]">210 seg</span>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-3 py-2 text-[11px] flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[9px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded">Control Operativo</span>
                    <span>El registro pasteuriza el lote operativamente. El dictamen y alta comercial final la realiza Control de Calidad (LAB-004).</span>
                </div>

                {/* Selector de Lote en Proceso */}
                <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                        Lote en Proceso a Pasteurizar
                    </label>
                    <select
                        value={selectedBatchForPasteurize}
                        onChange={(e) => setSelectedBatchForPasteurize(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                        <option value="">Seleccione Lote...</option>
                        {(Array.isArray(batches.filter(b => b.status === 'en_proceso' || String(b.id) === String(selectedBatchForPasteurize))) ? batches.filter(b => b.status === 'en_proceso' || String(b.id) === String(selectedBatchForPasteurize)) : []).map(b => (
                            <option key={b.id} value={b.id}>
                                [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation}) {b.is_coproduct ? '🔗 [CO-PRODUCTO]' : ''}
                            </option>
                        ))}
                    </select>
                    {selectedBatchObj && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                            <span>Producto: <b className="text-slate-800 capitalize">{selectedBatchObj.product_type}</b> ({selectedBatchObj.presentation})</span>
                            <span>•</span>
                            <span>Perfil térmico sugerido: <b className="text-indigo-600 font-bold">
                                {selectedBatchObj.product_type?.toLowerCase()?.includes('clara') ? '≥ 56.0°C' : selectedBatchObj.product_type?.toLowerCase()?.includes('yema') ? '≥ 66.5°C' : '≥ 64.0°C'}
                            </b> (210 seg)</span>
                        </div>
                    )}
                </div>

                {/* Selector de Modalidad si se detecta Corrida Dual */}
                {hasDualLots && (
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-2 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setPasteurizeMode('dual')}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                pasteurizeMode === 'dual'
                                    ? 'bg-teal-600 text-white shadow-sm border border-teal-700'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>⚡ Pasteurizar Ambos Lotes ({primaryBatch.batch_code_display || 'Lote 1'} & {secondaryBatch.batch_code_display || 'Lote 2'})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPasteurizeMode('single')}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                pasteurizeMode === 'single'
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>🥚 Pasteurizar Solo Este Lote</span>
                        </button>
                    </div>
                )}

                {/* Alerta de Observación HACCP */}
                {haccpViolationAlert && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-amber-900 space-y-2 shadow-xs">
                        <div className="flex gap-2 items-center font-bold text-xs uppercase tracking-wide text-amber-800">
                            <AlertOctagon size={18} className="text-amber-600" />
                            OBSERVACIÓN DE PARÁMETROS TÉRMICOS
                        </div>
                        <p className="text-xs font-medium leading-relaxed">{haccpViolationAlert}</p>
                        <p className="text-[11px] text-amber-700">
                            El lote avanza a pasteurizado; la liberación final se dictamina en Control de Calidad (LAB-004).
                        </p>
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (isDualActive && handlePasteurizeDual) {
                            handlePasteurizeDual(primaryBatch.id, secondaryBatch.id);
                        } else {
                            onSave(e);
                        }
                    }}
                    className="space-y-4"
                >
                    {isDualActive ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PasteurizeLotCard
                                title={`🥚 Lote 1: ${primaryBatch.batch_code_display || primaryBatch.batch_uuid}`}
                                batch={primaryBatch}
                                haccpGuide={getHaccpGuide(primaryBatch.product_type)}
                                form={pasteurizeForm}
                                onChange={(field, val) => setPasteurizeForm(prev => ({ ...prev, [field]: val }))}
                                colorScheme="indigo"
                            />
                            <PasteurizeLotCard
                                title={`🔗 Lote 2: ${secondaryBatch.batch_code_display || secondaryBatch.batch_uuid}`}
                                batch={secondaryBatch}
                                haccpGuide={getHaccpGuide(secondaryBatch.product_type)}
                                form={secondPasteurizeForm}
                                onChange={(field, val) => setSecondPasteurizeForm(prev => ({ ...prev, [field]: val }))}
                                colorScheme="teal"
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 border border-slate-200 rounded-2xl p-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                                    Temperatura Pasteurización (°C) *
                                </label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.temperature_c}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, temperature_c: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    step="0.01"
                                    placeholder="Ej: 64.5"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                                    Tiempo de Retención (Segundos) *
                                </label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.holding_time_seconds}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, holding_time_seconds: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 210"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Presión Hidráulica (PSI)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.pressure_psi}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, pressure_psi: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    step="0.01"
                                    placeholder="Ej: 48.0"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Flujo de Bomba (GPM)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.flow_rate_gpm}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, flow_rate_gpm: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    step="0.01"
                                    placeholder="Ej: 12.5"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                                    Código Lote de Pasteurización
                                </label>
                                <input
                                    type="text"
                                    value={pasteurizeForm.pasteurization_lot || ''}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, pasteurization_lot: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: PAST-01-274"
                                />
                            </div>
                        </div>
                    )}

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
                            disabled={isSubmitting || !selectedBatchForPasteurize}
                            className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm ${
                                isDualActive ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-600 hover:bg-orange-700'
                            }`}
                        >
                            {isSubmitting
                                ? 'Validando...'
                                : isDualActive
                                    ? 'Validar & Guardar Ambos Lotes'
                                    : 'Validar & Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
