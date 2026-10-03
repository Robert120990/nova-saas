import { Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AccountSelect from '../AccountSelect';
import AuxiliaresSection from '../AccountingAuxiliaresSection';

const normalizeKey = (val) => val.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 50);

const AccountingDefaultAccountsTab = ({ defaultAccounts, setDefaultAccounts, updateRow, removeRow, accounts, addRow, saveDefaultAccounts, saveDefaultsMutation }) => (
                        <fieldset disabled={saveDefaultsMutation.isPending} className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cuentas por Defecto</span>
                                <p className="text-[11px] text-slate-500">
                                    Define cuentas del catálogo bajo una clave personalizada. La clave solo acepta <b>mayúsculas, números y guion bajo</b>.
                                    Usa las claves sugeridas de <b>Contabilizar</b> para agregarlas con un clic.
                                </p>
                            </div>

                            <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-3">
                                <span className="text-[10px] font-black uppercase text-indigo-400 block">Claves Sugeridas — Contabilizar <span className="normal-case font-medium text-slate-400">(clic para agregar)</span></span>
                                {[
                                    { grupo: 'Partida de Ventas', keys: ['CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_CLIENTES_CXC', 'CUENTA_VENTAS_GRAVADAS', 'CUENTA_VENTAS_EXENTAS', 'CUENTA_VENTAS_NOSUJETAS', 'CUENTA_IVA_DEBITO', 'CUENTA_IVA_PERCIBIDO', 'CUENTA_FOVIAL_POR_PAGAR', 'CUENTA_COTRANS_POR_PAGAR'] },
                                    { grupo: 'Partida de Compras', keys: ['CUENTA_COMPRAS_GRAVADAS', 'CUENTA_COMPRAS_EXENTAS', 'CUENTA_IVA_CREDITO', 'CUENTA_PROVEEDORES_CXP', 'CUENTA_IVA_RETENIDO'] },
                                ].map(g => (
                                    <div key={g.grupo} className="space-y-1.5">
                                        <span className="block text-[9px] font-black uppercase text-slate-400">{g.grupo}</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.keys.map(key => {
                                                const added = defaultAccounts.some(r => r.key === key);
                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => {
                                                            if (added) { toast.info(`${key} ya está agregada`); return; }
                                                            setDefaultAccounts(rows => [...rows, { key, account_id: '' }]);
                                                        }}
                                                        title={added ? 'Ya agregada' : `Agregar ${key}`}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                                                            added
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                        }`}
                                                    >
                                                        {added ? '✓ ' : '+ '}{key}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {defaultAccounts.length === 0 && (
                                <p className="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                                    Aún no hay cuentas por defecto configuradas. Presiona "Agregar" para crear la primera.
                                </p>
                            )}

                            <div className="space-y-4">
                                {defaultAccounts.map((row, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_auto] gap-3 md:items-end bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 block">Clave</label>
                                            <input
                                                value={row.key}
                                                onChange={e => updateRow(index, { key: normalizeKey(e.target.value) })}
                                                placeholder="CUENTA_IVA"
                                                maxLength={50}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 block">Cuenta</label>
                                            <AccountSelect
                                                value={row.account_id}
                                                onChange={v => updateRow(index, { account_id: v })}
                                                accounts={accounts}
                                                placeholder="Buscar cuenta..."
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(index)}
                                            title="Eliminar"
                                            className="flex md:flex-none items-center justify-center gap-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 md:border-0 rounded-xl px-4 py-3 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                            <span className="md:hidden text-[10px] font-black uppercase">Eliminar</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addRow}
                                className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-600 py-3.5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus size={16} /> Agregar Cuenta por Defecto
                            </button>

                            <button
                                onClick={saveDefaultAccounts}
                                disabled={saveDefaultsMutation.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} /> {saveDefaultsMutation.isPending ? 'Guardando...' : 'Guardar Cuentas por Defecto'}
                            </button>

                            <AuxiliaresSection accounts={accounts} />
                        </fieldset>
                    
);
export default AccountingDefaultAccountsTab;
