import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import AccountSelect from './AccountSelect';

const normalizeKey = (val) => (val || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 50);

const DefaultAccountCustomForm = ({ isOpen, onClose, accounts = [], onAdd, configuredKeys }) => {
    const [key, setKey] = useState('');
    const [accountId, setAccountId] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const clean = normalizeKey(key);
        if (!clean) {
            toast.error('Ingrese una clave válida (mayúsculas, números y guiones bajos)');
            return;
        }
        if (!accountId) {
            toast.error('Debe seleccionar una cuenta contable para esta clave');
            return;
        }
        if (configuredKeys.has(clean)) {
            toast.error(`La clave ${clean} ya está configurada`);
            return;
        }

        onAdd(clean, accountId);
        setKey('');
        setAccountId('');
        onClose();
        toast.success(`Clave ${clean} configurada exitosamente`);
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/40 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Plus size={14} className="text-indigo-600" /> Registrar Clave Personalizada
                </span>
                <span className="text-[11px] text-slate-500">Solo mayúsculas, números y guión bajo (_)</span>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_auto] gap-3 items-end">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Nombre de Clave</label>
                    <input
                        value={key}
                        onChange={e => setKey(normalizeKey(e.target.value))}
                        placeholder="EJ: CUENTA_PROYECTO_ESPECIAL"
                        maxLength={50}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Cuenta del Catálogo</label>
                    <AccountSelect
                        value={accountId}
                        onChange={setAccountId}
                        accounts={accounts}
                        placeholder="Buscar cuenta para asignar..."
                    />
                </div>
                <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl font-black uppercase text-xs text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                    Agregar Clave
                </button>
            </form>
        </div>
    );
};

export default DefaultAccountCustomForm;
