import {
    FileCheck,
    XCircle,
    Mail,
    Send
} from 'lucide-react';


export default function TraceabilityIsEmailModalOpenModal({ model, open = model.isEmailModalOpen, onClose = () => model.setIsEmailModalOpen(false), onSave = model.handleSendUnifiedEmail }) {
    const { customers, labLogs, selectedLogIds, isEmailModalOpen, setIsEmailModalOpen, sendingEmail, emailForm, setEmailForm } = model;
    if (!open) return null;
    return (<>{isEmailModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Mail size={16} className="text-indigo-600" />
                                Enviar Certificados de Calidad (COA) Unificados por Correo
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 space-y-1">
                            <p className="font-bold">Despacho Unificado al Cliente:</p>
                            <p>
                                Se enviará <strong>un solo correo electrónico</strong> al cliente amparando los <strong>{selectedLogIds.length} lotes seleccionados</strong>. Cada lote tendrá adjunto su respectivo Certificado de Calidad (COA) individual en PDF.
                            </p>
                        </div>

                        {/* Listado de Lotes a Amparar */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Lotes Incluidos en este Despacho:</span>
                            <div className="flex flex-wrap gap-2">
                                {(Array.isArray(labLogs.filter(l => selectedLogIds.includes(l.id))) ? labLogs.filter(l => selectedLogIds.includes(l.id)) : []).map(log => (
                                    <div key={log.id} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex items-center gap-2">
                                        <FileCheck size={14} className="text-teal-600" />
                                        <span className="font-bold text-slate-900">{log.batch_code_display || log.batch_uuid}</span>
                                        <span className="text-[10px] text-slate-500 capitalize">({log.product_type})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={onSave} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Seleccionar Cliente del Catálogo</label>
                                    <select
                                        value={emailForm.customer_id}
                                        onChange={(e) => {
                                            const cid = e.target.value;
                                            const cObj = customers.find(c => String(c.id) === String(cid));
                                            setEmailForm({
                                                ...emailForm,
                                                customer_id: cid,
                                                customer_name: cObj ? (cObj.nombre_comercial || cObj.nombre) : emailForm.customer_name,
                                                customer_email: cObj ? (cObj.correo || emailForm.customer_email) : emailForm.customer_email
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    >
                                        <option value="">(Seleccionar cliente...)</option>
                                        {(Array.isArray(customers) ? customers : []).map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre_comercial || c.nombre} {c.correo ? `(${c.correo})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Nombre Receptor / Contacto</label>
                                    <input
                                        type="text"
                                        value={emailForm.customer_name}
                                        onChange={(e) => setEmailForm({ ...emailForm, customer_name: e.target.value })}
                                        placeholder="Ej: PriceSmart El Salvador"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Correo Electrónico de Destino *</label>
                                <input
                                    type="email"
                                    value={emailForm.customer_email}
                                    onChange={(e) => setEmailForm({ ...emailForm, customer_email: e.target.value })}
                                    placeholder="cliente@empresa.com"
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Asunto del Correo</label>
                                <input
                                    type="text"
                                    value={emailForm.subject}
                                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Mensaje / Cuerpo del Correo</label>
                                <textarea
                                    value={emailForm.message}
                                    onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    disabled={sendingEmail}
                                    onClick={() => setIsEmailModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingEmail}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    {sendingEmail ? (
                                        <>Enviando {selectedLogIds.length} Certificados...</>
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            Enviar Correo con Certificados
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
