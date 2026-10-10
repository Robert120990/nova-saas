import {
    XCircle
} from 'lucide-react';


export default function CostsMaintenanceNewCustomerModalModal({ model, open = model.newCustomerModal, onClose = () => model.setNewCustomerModal(false), onSave = model.handleNewCustomerSubmit }) {
    const { newCustomerModal, setNewCustomerModal, customerCatalog, newCustomerForm, setNewCustomerForm } = model;
    if (!open) return null;
    return (<>{newCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 border border-slate-200 shadow-2xl space-y-4 text-xs max-h-[92dvh] overflow-y-auto my-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase leading-snug">Registrar Cliente Envases</h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={onSave} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Seleccionar Cliente del Catálogo</label>
                                <select
                                    value={newCustomerForm.customer_id}
                                    onChange={(e) => {
                                        const cId = e.target.value;
                                        const selected = customerCatalog.find(c => String(c.id) === String(cId));
                                        setNewCustomerForm({
                                            ...newCustomerForm,
                                            customer_id: cId,
                                            customer_name: selected ? selected.nombre : newCustomerForm.customer_name
                                        });
                                    }}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm mb-2"
                                >
                                    <option value="">-- Seleccionar de clientes existentes (opcional) --</option>
                                    {(Array.isArray(customerCatalog) ? customerCatalog : []).map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre} {c.codigo ? `(${c.codigo})` : ''}
                                        </option>
                                    ))}
                                </select>

                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Nombre del Cliente / Empresa</label>
                                <input
                                    type="text"
                                    value={newCustomerForm.customer_name}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customer_name: e.target.value })}
                                    placeholder="Ej: PriceSmart El Salvador / Panadería La Francesa"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tipo de Empaque</label>
                                <select
                                    value={newCustomerForm.packaging_type}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, packaging_type: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="cubeta_30lb">Cubeta 30 Lbs con tapadera hermética</option>
                                    <option value="cubeta_32lb">Cubeta 32 Lbs con tapadera hermética</option>
                                    <option value="cubeta_15lb">Cubeta 15 Lbs con tapadera</option>
                                    <option value="tarima_plastica">Tarima Plástica Sanitaria</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Saldo Inicial Cubetas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newCustomerForm.initial_balance}
                                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, initial_balance: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Saldo Inicial Tapaderas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newCustomerForm.initial_tapaderas}
                                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, initial_tapaderas: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Notas y Condiciones</label>
                                <textarea
                                    value={newCustomerForm.notes}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                                    placeholder="Contacto de bodega, frecuencia de retorno, sucursal..."
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm h-16"
                                />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setNewCustomerModal(false)}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all text-center"
                                >
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
