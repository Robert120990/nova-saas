import Modal from '../../ui/Modal';
import {
    RefreshCw,
    CalendarCheck
} from 'lucide-react';




export default function ProductionCalendarAlterDateItemModal({ model, open = model.alterDateItem, onClose = () => model.setAlterDateItem(null), onSave = model.handleSaveAlteredDate }) {
    const { alterDateItem, setAlterDateItem, newAlteredDate, setNewAlteredDate, isAlteringDate } = model;
    if (!open) return null;
    return (<>{alterDateItem && (
                <Modal
                    isOpen={!!alterDateItem}
                    onClose={() => setAlterDateItem(null)}
                    title="Alterar / Reprogramar Fecha en Calendario"
                    maxWidth="max-w-md"
                    zIndex="z-[1200]"
                >
                    <form onSubmit={onSave} className="space-y-4">
                        <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase block mb-1">
                                {alterDateItem.type === 'production' ? 'Producción Programada' : 'Pedido de Cliente'}:
                            </span>
                            <p className="font-black text-slate-900 leading-tight">
                                {alterDateItem.title}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-2">
                                Fecha actual: <strong className="text-slate-700">{alterDateItem.currentDate || 'Sin fecha'}</strong>
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                Nueva Fecha Asignada *
                            </label>
                            <input
                                type="date"
                                required
                                value={newAlteredDate}
                                onChange={(e) => setNewAlteredDate(e.target.value)}
                                className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 bg-white"
                            />
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isAlteringDate}
                                className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                            >
                                {isAlteringDate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CalendarCheck className="w-3.5 h-3.5" />}
                                <span>Guardar Nueva Fecha</span>
                            </button>
                        </div>
                    </form>
                </Modal>
            )}</>);
}
