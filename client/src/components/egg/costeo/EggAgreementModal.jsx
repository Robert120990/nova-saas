import { X } from 'lucide-react';

export default function EggAgreementModal({
    open,
    data,
    onClose,
    onSave,
    setAgreementModal
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <form onSubmit={onSave} className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-base font-bold text-slate-900 uppercase">
                        {data?.id ? 'Editar Acuerdo de Precios con Cliente' : 'Nuevo Acuerdo de Precios con Cliente'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3.5">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                            Nombre del Cliente o Empresa
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: PriceSmart El Salvador / Pastelería Lorena"
                            value={data?.customer_name || ''}
                            onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, customer_name: e.target.value } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Producto
                            </label>
                            <select
                                value={data?.product_type || 'Huevo Entero Pasteurizado'}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, product_type: e.target.value } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            >
                                <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado</option>
                                <option value="Huevo Entero Plus">Huevo Entero Plus</option>
                                <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada</option>
                                <option value="Yema Azucarada">Yema Azucarada</option>
                                <option value="Yema Salada">Yema Salada</option>
                                <option value="Huevo con Leche">Huevo Entero con Leche</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Presentación
                            </label>
                            <select
                                value={data?.presentation || 'cubeta 30LB'}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, presentation: e.target.value } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            >
                                <option value="cubeta 30LB">Cubeta 30 LBS</option>
                                <option value="cubeta 32LB">Cubeta 32 LBS</option>
                                <option value="galón 8LB">Galón 8 LBS</option>
                                <option value="medio galón 4LB">Medio Galón 4 LBS</option>
                                <option value="litro 2LB">Litro 2 LBS</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Precio Pactado ($/Lb)
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                required
                                placeholder="1.20"
                                value={data?.agreed_price_per_lb || ''}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, agreed_price_per_lb: parseFloat(e.target.value) || 0 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Volumen Mes (Lbs)
                            </label>
                            <input
                                type="number"
                                placeholder="10000"
                                value={data?.monthly_volume_lbs || ''}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, monthly_volume_lbs: parseFloat(e.target.value) || 0 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Margen Obj (%)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                placeholder="20"
                                value={data?.target_margin_pct || ''}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, target_margin_pct: parseFloat(e.target.value) || 20 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* RANGO DE VIGENCIA DE LA TARIFA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Vigente Desde (Inicio)
                            </label>
                            <input
                                type="date"
                                value={data?.valid_from ? data.valid_from.split('T')[0] : ''}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, valid_from: e.target.value } }))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Vigente Hasta (Vencimiento)
                            </label>
                            <input
                                type="date"
                                value={data?.valid_to ? data.valid_to.split('T')[0] : ''}
                                onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, valid_to: e.target.value } }))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                            />
                        </div>
                        <span className="sm:col-span-2 text-[10px] text-slate-400 font-medium">
                            Opcional: Si se deja en blanco, la tarifa se considera permanente sin expiración automática.
                        </span>
                    </div>

                    {/* MOTIVO DEL CAMBIO / AJUSTE (AUDITORÍA) */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                            Motivo de Ajuste / Revisión de Tarifa
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Negociación semestral, incremento por alza en costo de huevo..."
                            value={data?.change_reason || ''}
                            onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, change_reason: e.target.value } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                            Notas y Condiciones Especiales
                        </label>
                        <textarea
                            rows="2"
                            placeholder="Condición de pago, frecuencia de entrega, flete incluido..."
                            value={data?.notes || ''}
                            onChange={(e) => setAgreementModal(prev => ({ ...prev, data: { ...prev.data, notes: e.target.value } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                    >
                        Guardar Acuerdo
                    </button>
                </div>
            </form>
        </div>
    );
}
