import { AlertOctagon, XCircle, Trash2, Pencil } from 'lucide-react';

const EggBatchWastesModal = ({
    isOpen,
    onClose,
    wastesModal,
    setWastesModal,
    handleCreateWaste,
    handleDeleteWaste
}) => {
    if (!isOpen || !wastesModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-slate-900 overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/70">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                            <AlertOctagon size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                                Mermas y Pérdidas del Lote
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Lote: <b>{wastesModal.batch?.batch_code_display || wastesModal.batch?.batch_uuid}</b> ({wastesModal.batch?.product_type})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Formulario de Nueva / Edición de Merma */}
                    <form onSubmit={handleCreateWaste} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                {wastesModal.editingWasteId ? 'Editar Registro de Merma' : 'Registrar Nueva Merma'}
                            </h4>
                            {wastesModal.editingWasteId && (
                                <button
                                    type="button"
                                    onClick={() => setWastesModal(prev => ({
                                        ...prev,
                                        editingWasteId: null,
                                        stage: 'quebraje',
                                        waste_type: 'cascaron',
                                        weight_lbs: '',
                                        notes: ''
                                    }))}
                                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                >
                                    Cancelar Edición
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Etapa *</label>
                                <select
                                    value={wastesModal.stage}
                                    onChange={(e) => setWastesModal(prev => ({ ...prev, stage: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-rose-500"
                                >
                                    <option value="quebraje">Quebraje</option>
                                    <option value="pasteurizacion">Pasteurización</option>
                                    <option value="envasado">Envasado / Tuberías</option>
                                    <option value="almacen">Almacén de Frío</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Merma *</label>
                                <select
                                    value={wastesModal.waste_type}
                                    onChange={(e) => setWastesModal(prev => ({ ...prev, waste_type: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-rose-500"
                                >
                                    <option value="cascaron">Cáscara de Huevo</option>
                                    <option value="merma_liquida">Merma Líquida Residual</option>
                                    <option value="tuberias_desperdicio">Pérdida en Tuberías / Desperdicio</option>
                                    <option value="no_conforme">Líquido No Conforme</option>
                                    <option value="derrame">Derrame Accidental</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Peso (Lbs) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={wastesModal.weight_lbs}
                                    onChange={(e) => setWastesModal(prev => ({ ...prev, weight_lbs: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-rose-500"
                                    placeholder="Ej: 35.00"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notas / Causa</label>
                            <input
                                type="text"
                                value={wastesModal.notes}
                                onChange={(e) => setWastesModal(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-rose-500"
                                placeholder="Detalle causa de la merma o remanente en tuberías..."
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            {wastesModal.editingWasteId && (
                                <button
                                    type="button"
                                    onClick={() => setWastesModal(prev => ({
                                        ...prev,
                                        editingWasteId: null,
                                        stage: 'quebraje',
                                        waste_type: 'cascaron',
                                        weight_lbs: '',
                                        notes: ''
                                    }))}
                                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={wastesModal.isSubmitting}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                            >
                                {wastesModal.isSubmitting ? 'Guardando...' : (wastesModal.editingWasteId ? 'Actualizar Merma' : '+ Guardar Merma')}
                            </button>
                        </div>
                    </form>

                    {/* Historial de Mermas */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Mermas Registradas ({wastesModal.wastes.length})
                        </h4>
                        {wastesModal.wastes.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No hay registros de mermas para este lote.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="p-2.5">Etapa</th>
                                            <th className="p-2.5">Tipo</th>
                                            <th className="p-2.5 text-right">Peso (Lbs)</th>
                                            <th className="p-2.5">Operador</th>
                                            <th className="p-2.5">Notas</th>
                                            <th className="p-2.5 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {wastesModal.wastes.map(w => (
                                            <tr key={w.id} className="hover:bg-slate-50">
                                                <td className="p-2.5 font-bold capitalize text-slate-900">{w.stage}</td>
                                                <td className="p-2.5 text-rose-700 font-semibold capitalize">{w.waste_type?.replace('_', ' ')}</td>
                                                <td className="p-2.5 text-right font-black text-slate-900">{parseFloat(w.weight_lbs).toFixed(1)} Lbs</td>
                                                <td className="p-2.5 text-slate-600">{w.operator_name || '-'}</td>
                                                <td className="p-2.5 text-slate-500 italic text-[11px]">{w.notes || '-'}</td>
                                                <td className="p-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setWastesModal(prev => ({
                                                                ...prev,
                                                                editingWasteId: w.id,
                                                                stage: w.stage || 'quebraje',
                                                                waste_type: w.waste_type || 'cascaron',
                                                                weight_lbs: String(w.weight_lbs || w.quantity_lbs || ''),
                                                                notes: w.notes || w.reason || ''
                                                            }))}
                                                            className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                                                            title="Editar registro de merma"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteWaste(w.id)}
                                                            className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                                                            title="Eliminar registro de merma"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EggBatchWastesModal;
