import { Search } from 'lucide-react';
import Modal from '../ui/Modal';

const AccountingAccountSearchModal = ({ open, onClose, accountModalSearch, setAccountModalSearch, accountModalResults, onSelect }) => {
    if (!open) return null;
    return (
<Modal isOpen={open} onClose={onClose} title="Seleccionar Cuenta" maxWidth="max-w-3xl">
                <div className="space-y-4 pt-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar por código o nombre..."
                            value={accountModalSearch}
                            onChange={e => setAccountModalSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>
                    <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                        <Search size={13} className="text-slate-400 shrink-0" />
                        <span>Se muestra el catálogo completo. Solo se pueden seleccionar cuentas de <b>detalle</b>.</span>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
                        {accountModalResults.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <Search size={40} className="mx-auto opacity-20 mb-2" />
                                <p className="font-black uppercase tracking-widest text-xs italic">No se encontraron cuentas</p>
                            </div>
                        ) : (
                            (Array.isArray(accountModalResults) ? accountModalResults : []).map(a => {
                                const isDetail = a.allows_entries === 1;
                                return (
                                    <div
                                        key={a.id}
                                        role="button"
                                        tabIndex={isDetail ? 0 : -1}
                                        onClick={isDetail ? () => onSelect(a) : undefined}
                                        onKeyDown={isDetail ? (e) => { if (e.key === 'Enter') onSelect(a); } : undefined}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                            isDetail ? 'cursor-pointer hover:bg-indigo-50/50' : 'opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className={`font-mono text-[11px] font-bold shrink-0 w-28 truncate ${isDetail ? 'text-indigo-500' : 'text-slate-400'}`}>{a.code}</span>
                                        <span className={`flex-1 min-w-0 truncate text-[13px] font-bold ${isDetail ? 'text-slate-700' : 'text-slate-400'}`}>{a.name}</span>
                                        {a.type_name && <span className="text-[10px] text-slate-400 shrink-0 w-24 truncate hidden sm:block">{a.type_name}</span>}
                                        <span className="text-xs shrink-0 w-10 text-center" title={isDetail ? 'Permite asientos' : 'Solo agrupación'}>
                                            {isDetail ? '✅' : '❌'}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] text-slate-400 font-medium">Presione <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600">F3</kbd> para abrir esta ventana desde el formulario</span>
                    </div>
                </div>
            </Modal>
    );
};
export default AccountingAccountSearchModal;
