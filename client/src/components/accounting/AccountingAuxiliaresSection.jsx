import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Search, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import AccountSelect from './AccountSelect';
import { unwrapList } from '../../utils/apiUtils';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';
const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

const AuxiliaresSection = ({ accounts }) => {
    const queryClient = useQueryClient();
    const [entityType, setEntityType] = useState('cliente');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [editsByType, setEditsByType] = useState({});
    const edits = editsByType[entityType] || {};
    const setEdits = (next) => setEditsByType(previous => ({
        ...previous, [entityType]: typeof next === 'function' ? next(previous[entityType] || {}) : next
    }));
    useDirtyTracker('accounting-auxiliares', Object.values(editsByType).some(changes => Object.keys(changes).length > 0));

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    const { data: entities = [], isFetching } = useQuery({
        queryKey: ['entity-accounts', entityType, debounced],
        queryFn: async () => unwrapList(await axios.get(`/api/accounting/generation/entity-accounts?type=${entityType}&search=${encodeURIComponent(debounced)}`)),
    });

    const saveMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/entity-accounts', payload),
        onSuccess: (_response, payload) => {
            toast.success('Asignaciones guardadas');
            setEditsByType(previous => {
                const remaining = { ...previous[payload.type] };
                for (const item of payload.items) {
                    if (String(remaining[item.id] || '') === String(item.account_id || '')) delete remaining[item.id];
                }
                return { ...previous, [payload.type]: remaining };
            });
            queryClient.invalidateQueries({ queryKey: ['entity-accounts'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const pendingItems = Object.entries(edits).map(([id, account_id]) => ({
        id: Number(id),
        account_id: account_id ? Number(account_id) : null
    }));
    const entryAccounts = (Array.isArray(accounts) ? accounts : []).filter(a => a.allows_entries === 1 || a.allows_entries === true);

    return (
        <div className="border-t pt-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1.5"><Users2 size={13} /> Cuentas Auxiliares por Cliente / Proveedor</span>
                    <p className="text-[11px] text-slate-500">
                        Asigna una cuenta contable por NRC para detallar el crédito en las partidas automáticas de Contabilizar.
                        Los sin cuenta asignada usarán la cuenta genérica CxC/CxP.
                    </p>
                </div>
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full md:w-auto px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400">
                    <option value="cliente">Clientes</option>
                    <option value="proveedor">Proveedores</option>
                </select>
            </div>

            <div className="relative">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o NRC..."
                    className={inputCls}
                />
                <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {entities.length === 0 && !isFetching && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                        Sin resultados para esta búsqueda.
                    </p>
                )}
                {(Array.isArray(entities) ? entities : []).map((ent) => (
                    <div key={ent.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1.3fr] gap-2 items-center bg-slate-50/50 border border-slate-100 rounded-xl p-2.5">
                        <div className="sm:w-28 shrink-0">
                            <span className="block text-[9px] font-black uppercase text-slate-400">NRC</span>
                            <span className="font-mono text-[12px] font-bold text-indigo-600">{ent.nrc || '—'}</span>
                        </div>
                        <div className="min-w-0">
                            <span className="block text-[9px] font-black uppercase text-slate-400">Nombre</span>
                            <span className="block truncate text-[12px] font-bold text-slate-700">{ent.nombre}</span>
                        </div>
                        <AccountSelect
                            value={edits[ent.id] !== undefined ? edits[ent.id] : String(ent.account_id || '')}
                            onChange={(v) => setEdits(prev => ({ ...prev, [ent.id]: v }))}
                            accounts={entryAccounts}
                            placeholder="Cuenta auxiliar..."
                        />
                    </div>
                ))}
            </div>

            <button
                onClick={() => saveMutation.mutate({ type: entityType, items: pendingItems })}
                disabled={saveMutation.isPending || pendingItems.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Save size={18} /> {saveMutation.isPending ? 'Guardando...' : `Guardar Cambios${pendingItems.length ? ` (${pendingItems.length})` : ''}`}
            </button>
        </div>
    );
};


export default AuxiliaresSection;
