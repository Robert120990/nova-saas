import {
    XCircle,
    SlidersHorizontal
} from 'lucide-react';


export default function TraceabilityIsParamModalOpenModal({ model, open = model.isParamModalOpen, onClose = () => model.setIsParamModalOpen(false), onSave = model.handleSaveParam }) {
    const { isParamModalOpen, setIsParamModalOpen, editingParam, paramForm, setParamForm } = model;
    if (!open) return null;
    return (<>{isParamModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-indigo-600" />
                                {editingParam ? 'Editar Parámetro de Calidad' : 'Nuevo Parámetro / Norma de Calidad'}
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={onSave} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Categoría de Ensayo *</label>
                                    <select
                                        value={paramForm.category}
                                        onChange={(e) => setParamForm({ ...paramForm, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    >
                                        <option value="microbiologico">Microbiológico (Inocuidad)</option>
                                        <option value="fisicoquimico">Físico-Químico</option>
                                        <option value="organoleptico">Organoléptico / Sensorial</option>
                                        <option value="otro">Otro Criterio Especial</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Forma / Producto Aplicable *</label>
                                    <input
                                        type="text"
                                        value={paramForm.applicable_product}
                                        onChange={(e) => setParamForm({ ...paramForm, applicable_product: e.target.value })}
                                        placeholder="todos, huevo entero, clara, yema..."
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Nombre del Parámetro *</label>
                                <input
                                    type="text"
                                    value={paramForm.parameter_name}
                                    onChange={(e) => setParamForm({ ...paramForm, parameter_name: e.target.value })}
                                    placeholder="Ej: Recuento Mesófilos Aerobios, Viscosidad, etc."
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Especificación / Límite Normativo *</label>
                                <input
                                    type="text"
                                    value={paramForm.specification}
                                    onChange={(e) => setParamForm({ ...paramForm, specification: e.target.value })}
                                    placeholder="Ej: Máx 10,000 UFC/g, 7.20 - 7.80 pH, Ausencia en 25g"
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Lectura Sugerida / Defecto</label>
                                    <input
                                        type="text"
                                        value={paramForm.default_value}
                                        onChange={(e) => setParamForm({ ...paramForm, default_value: e.target.value })}
                                        placeholder="Ej: < 1,000 UFC/g, 24.2%"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Unidad de Medida</label>
                                    <input
                                        type="text"
                                        value={paramForm.unit}
                                        onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
                                        placeholder="Ej: UFC/g, %, pH, cP, N/A"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Criterio Esperado</label>
                                    <input
                                        type="text"
                                        value={paramForm.expected_criterion}
                                        onChange={(e) => setParamForm({ ...paramForm, expected_criterion: e.target.value })}
                                        placeholder="Ej: CONFORME, DENTRO DE NORMA"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Orden de Presentación</label>
                                    <input
                                        type="number"
                                        value={paramForm.sort_order}
                                        onChange={(e) => setParamForm({ ...paramForm, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="param_active"
                                    checked={paramForm.is_active}
                                    onChange={(e) => setParamForm({ ...paramForm, is_active: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <label htmlFor="param_active" className="text-xs font-semibold text-slate-700">
                                    Parámetro activo y visible en los análisis de calidad
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsParamModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {editingParam ? 'Guardar Cambios' : 'Crear Parámetro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
