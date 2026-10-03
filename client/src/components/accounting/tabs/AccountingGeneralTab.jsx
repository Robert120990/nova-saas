import { Save } from 'lucide-react';
import AccountSelect from '../AccountSelect';
const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
const labelCls = "text-[10px] font-black uppercase text-slate-400 block mb-2";


const AccountingGeneralTab = ({ form, setForm, patrimAccounts, saveMutation, onSave }) => (
                        <fieldset disabled={saveMutation.isPending} className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                            <div>
                                <label className={labelCls}>
                                    Cuenta "Resultado del Ejercicio"
                                </label>
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Usada por el Cierre Anual para saldar ingresos y gastos. Debe ser tipo <b>Patrimonio</b>.
                                </p>
                                <AccountSelect
                                    value={form.resultado_ejercicio_id}
                                    onChange={v => setForm({ ...form, resultado_ejercicio_id: v })}
                                    accounts={patrimAccounts}
                                    placeholder="Buscar cuenta de patrimonio..."
                                />
                                {form.resultado_ejercicio_id && (
                                    <p className="text-[10px] text-emerald-600 mt-1 font-bold">
                                        ✓ {patrimAccounts.find(a => a.id == form.resultado_ejercicio_id)?.name || 'Cuenta seleccionada'}
                                    </p>
                                )}
                            </div>

                            <div className="border-t pt-4">
                                <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Firmantes de Reportes</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Contador</label>
                                        <input value={form.contador_nombre} onChange={e => setForm({...form, contador_nombre: e.target.value})} placeholder="Nombre del contador" className={inputCls} />
                                        <input value={form.contador_dui} onChange={e => setForm({...form, contador_dui: e.target.value})} placeholder="DUI 00000000-0" className={`${inputCls} font-mono`} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Auditor</label>
                                        <input value={form.auditor_nombre} onChange={e => setForm({...form, auditor_nombre: e.target.value})} placeholder="Nombre del auditor" className={inputCls} />
                                        <input value={form.auditor_dui} onChange={e => setForm({...form, auditor_dui: e.target.value})} placeholder="DUI 00000000-0" className={`${inputCls} font-mono`} />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onSave}
                                disabled={saveMutation.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </fieldset>
                    
);
export default AccountingGeneralTab;
