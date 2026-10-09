import { useMemo } from 'react';
import { Sparkles, XCircle } from 'lucide-react';

const CANONICAL_REMANENTE_PRODUCTS = [
    { value: 'huevo entero', label: 'Huevo Entero' },
    { value: 'huevo rapido', label: 'Huevo Rápido' },
    { value: 'clara', label: 'Clara de Huevo' },
    { value: 'clara ppg', label: 'Clara PPG' },
    { value: 'yema', label: 'Yema Líquida' },
    { value: 'huevo en leche', label: 'Huevo en Leche / Formulado' },
    { value: 'yema azucarada', label: 'Yema Azucarada' },
    { value: 'yema salada', label: 'Yema Salada' },
    { value: 'fórmula especial', label: 'Fórmula Especial / HE Plus' },
    { value: 'reproceso', label: 'Lote a Reproceso' }
];

const EggRemanenteModal = ({
    isOpen,
    onClose,
    remanenteModal,
    setRemanenteModal,
    onSubmit,
    productConfig = []
}) => {
    // Generar opciones dinámicas y deduplicadas combinando catálogo base, configuración de empresa y lote activo
    const productOptions = useMemo(() => {
        const seen = new Set();
        const list = [];

        const addOpt = (val, lbl) => {
            if (!val || typeof val !== 'string') return;
            const key = val.trim().toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            list.push({ value: key, label: lbl || val });
        };

        // 1. Productos estándar canónicos
        CANONICAL_REMANENTE_PRODUCTS.forEach(p => addOpt(p.value, p.label));

        // 2. Productos configurados en la empresa (egg_product_config)
        if (Array.isArray(productConfig)) {
            productConfig.forEach(cfg => {
                if (cfg && cfg.product_type) {
                    addOpt(cfg.product_type, cfg.label || cfg.product_name || cfg.product_type);
                }
            });
        }

        // 3. Valor actual del remanente o del lote padre si fuera un tipo personalizado
        if (remanenteModal?.product_type) {
            addOpt(remanenteModal.product_type, remanenteModal.product_type);
        }
        if (remanenteModal?.batch?.product_type) {
            addOpt(remanenteModal.batch.product_type, remanenteModal.batch.product_type);
        }

        return list;
    }, [productConfig, remanenteModal?.product_type, remanenteModal?.batch?.product_type]);

    if (!isOpen || !remanenteModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <Sparkles className="text-teal-600" size={16} />
                        {remanenteModal.id ? 'Editar Remanente / Sobrante' : 'Registrar Remanente / Sobrante'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700"
                    >
                        <XCircle size={18} />
                    </button>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                    Sobrante de producto (ej: huevo rápido, huevo en leche, huevo entero pasteurizado o sin pasteurizar) guardado para próximo empaque, otra producción o reproceso.
                </p>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Tipo de Producto Sobrante *
                        </label>
                        <select
                            value={remanenteModal.product_type?.toLowerCase() || 'huevo entero'}
                            onChange={(e) => setRemanenteModal(prev => ({ ...prev, product_type: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        >
                            {productOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                Peso Remanente (Lbs) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={remanenteModal.weight_lbs}
                                onChange={(e) => setRemanenteModal(prev => ({ ...prev, weight_lbs: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                placeholder="Ej: 120.00"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                Condición Térmica
                            </label>
                            <select
                                value={remanenteModal.is_pasteurized ? 'true' : 'false'}
                                onChange={(e) => setRemanenteModal(prev => ({ ...prev, is_pasteurized: e.target.value === 'true' }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                            >
                                <option value="true">Pasteurizado</option>
                                <option value="false">Sin Pasteurizar (Crudo)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Destino Programado
                        </label>
                        <select
                            value={remanenteModal.destination}
                            onChange={(e) => setRemanenteModal(prev => ({ ...prev, destination: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                        >
                            <option value="proximo_empaque">Próximo Empaque (Empacado directo)</option>
                            <option value="otra_produccion">Otra Producción (Mezcla futura)</option>
                            <option value="reproceso">Reproceso / Reutilizables</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Notas y Ubicación
                        </label>
                        <textarea
                            rows={2}
                            value={remanenteModal.notes || ''}
                            onChange={(e) => setRemanenteModal(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                            placeholder="Ej: Tanque buffer #2 a 4°C, remanente de fórmula especial..."
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={remanenteModal.isSubmitting}
                            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                        >
                            {remanenteModal.isSubmitting ? 'Guardando...' : (remanenteModal.id ? 'Actualizar Remanente' : 'Guardar Remanente')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggRemanenteModal;
