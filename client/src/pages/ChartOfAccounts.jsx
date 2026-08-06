import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Edit, Trash2, BookOpen, Search, Upload, HelpCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';

const ChartOfAccounts = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [selectedFormType, setSelectedFormType] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [, setIsImporting] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
    });

    const filteredAccounts = useMemo(() => {
        if (!search) return accounts;
        const q = search.toLowerCase();
        return accounts.filter(a => a.code?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q));
    }, [accounts, search]);

    const totalPages = Math.ceil(filteredAccounts.length / limit);
    const paginatedAccounts = filteredAccounts.slice((page - 1) * limit, page * limit);
    if (page > totalPages && totalPages > 0) setPage(1);

    const { data: accountTypes = [] } = useQuery({
        queryKey: ['accountTypes'],
        queryFn: async () => (await axios.get('/api/accounting/account-types')).data,
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/accounts', data),
        onSuccess: () => { queryClient.invalidateQueries(['accounts']); setIsAccountModalOpen(false); setEditingAccount(null); toast.success('Cuenta creada'); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/accounting/accounts/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries(['accounts']); setIsAccountModalOpen(false); setEditingAccount(null); toast.success('Cuenta actualizada'); },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/accounting/accounts/${id}`),
        onSuccess: () => { queryClient.invalidateQueries(['accounts']); toast.success('Cuenta eliminada'); },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            account_type_id: fd.get('account_type_id'),
            parent_id: fd.get('parent_id') || null,
            code: fd.get('code'),
            name: fd.get('name'),
            allows_entries: fd.get('allows_entries') === '1' ? 1 : 0,
            active: fd.get('active') === '1' ? 1 : 0,
        };
        if (editingAccount) updateMutation.mutate({ id: editingAccount.id, ...data });
        else createMutation.mutate(data);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><BookOpen size={28} className="text-indigo-600" />Catálogo de Cuentas</h1>
                    <p className="text-slate-500 font-medium">Gestión del plan contable</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold w-56 outline-none" />
                    </div>
                    <button                     onClick={() => { setEditingAccount(null); setSelectedFormType(''); setIsAccountModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2">
                        <Plus size={16} /> Nueva Cuenta
                    </button>
                    <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2 cursor-pointer transition-colors">
                        <Upload size={16} /> Importar CSV
                        <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setIsImporting(true);
                            try {
                                const text = await file.text();
                                const lines = text.split('\n').filter(l => l.trim());
                                // Esperado: code,name,account_type_id,parent_code,allows_entries
                                const accounts = lines.slice(1).map(line => {
                                    const vals = line.split(',');
                                    return {
                                        code: vals[0]?.trim(),
                                        name: vals[1]?.trim(),
                                        account_type_id: vals[2]?.trim(),
                                        parent_code: vals[3]?.trim(),
                                        allows_entries: vals[4]?.trim()
                                    };
                                });
                                const { data } = await axios.post('/api/accounting/import', { accounts });
                                queryClient.invalidateQueries(['accounts']);
                                toast.success(data.message);
                            } catch (err) {
                                toast.error('Error al importar: ' + (err.response?.data?.message || err.message));
                            } finally {
                                setIsImporting(false);
                                e.target.value = '';
                            }
                        }} />
                    </label>
                    <button onClick={() => setShowHelp(!showHelp)} className="p-3 rounded-2xl transition-colors" title="Ayuda">
                        <HelpCircle size={18} className="text-slate-400 hover:text-indigo-500" />
                    </button>
                </div>
            </div>

            {showHelp && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-xs space-y-3 relative">
                    <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600"><X size={14} /></button>
                    <h3 className="font-black text-blue-700 text-sm">Formato del archivo CSV para importar</h3>
                    <p className="text-blue-600">El archivo debe ser <b>CSV</b> (valores separados por coma) con las siguientes columnas en orden:</p>
                    <table className="w-full text-left border-collapse mt-2">
                        <thead><tr className="bg-blue-100/50"><th className="p-2 border border-blue-200 font-bold">Columna</th><th className="p-2 border border-blue-200 font-bold">Descripción</th><th className="p-2 border border-blue-200 font-bold">Ejemplo</th></tr></thead>
                        <tbody>
                            <tr><td className="p-2 border border-blue-200 font-mono">code</td><td className="p-2 border border-blue-200">Código de la cuenta</td><td className="p-2 border border-blue-200 font-mono">110101</td></tr>
                            <tr><td className="p-2 border border-blue-200 font-mono">name</td><td className="p-2 border border-blue-200">Nombre de la cuenta</td><td className="p-2 border border-blue-200">CAJA GENERAL</td></tr>
                            <tr><td className="p-2 border border-blue-200 font-mono">account_type_id</td><td className="p-2 border border-blue-200">ID del tipo: 1=Activo, 2=Pasivo, 3=Patrimonio, 4=Ingreso, 5=Costo, 6=Gasto</td><td className="p-2 border border-blue-200 font-mono">1</td></tr>
                            <tr><td className="p-2 border border-blue-200 font-mono">parent_code</td><td className="p-2 border border-blue-200">Código de la cuenta padre (vacío si es raíz)</td><td className="p-2 border border-blue-200 font-mono">1101</td></tr>
                            <tr><td className="p-2 border border-blue-200 font-mono">allows_entries</td><td className="p-2 border border-blue-200">1 = permite asientos, 0 = solo agrupación</td><td className="p-2 border border-blue-200 font-mono">1</td></tr>
                        </tbody>
                    </table>
                    <div className="bg-blue-100 rounded-xl p-3 font-mono text-[10px] text-blue-800 mt-3">
                        <b>Ejemplo de archivo CSV:</b><br/>
                        code,name,account_type_id,parent_code,allows_entries<br/>
                        1,ACTIVO,1,,0<br/>
                        11,ACTIVO CORRIENTE,1,1,0<br/>
                        1101,EFECTIVO Y EQUIVALENTES,1,11,0<br/>
                        110101,CAJA GENERAL,1,1101,1<br/>
                        110102,CAJA CHICA,1,1101,1
                    </div>
                    <p className="text-blue-500 text-[10px]">Las cuentas padre deben existir o estar antes en el archivo. Si una cuenta ya existe, se actualiza.</p>
                </div>
            )}

            <Table headers={['Código', 'Nombre', 'Tipo', 'Padre', 'Detalle', 'Estado']} data={paginatedAccounts} isLoading={isLoading}
                renderRow={(a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-mono font-bold text-xs">{a.code}</td>
                        <td className="px-6 py-3 font-bold text-sm">{a.name}</td>
                        <td className="px-6 py-3 text-xs"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.nature === 'debit' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>{a.type_name}</span></td>
                        <td className="px-6 py-3 text-xs text-slate-400">{a.parent_name || '—'}</td>
                        <td className="px-6 py-3 text-xs">{a.allows_entries ? '✅' : '❌'}</td>
                        <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{a.active ? 'Activo' : 'Inactivo'}</span></td>
                        <td className="px-6 py-3">
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingAccount(a); setSelectedFormType(a.account_type_id); setIsAccountModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit size={14} /></button>
                                <button onClick={async () => { const ok = await confirm({ title: 'Eliminar Cuenta', message: '¿Eliminar esta cuenta contable?', confirmLabel: 'Eliminar' }); if (ok) deleteMutation.mutate(a.id); }} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                            </div>
                        </td>
                    </tr>
                )}
            />
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} limit={limit} onLimitChange={(l) => { setLimit(l); setPage(1); }} />}

            <Modal isOpen={isAccountModalOpen} onClose={() => { setIsAccountModalOpen(false); setEditingAccount(null); setSelectedFormType(''); }} title={editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'} maxWidth="max-w-md">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Tipo de Cuenta</label>
                        <select name="account_type_id" defaultValue={editingAccount?.account_type_id || ''} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" onChange={e => setSelectedFormType(e.target.value)}>
                            <option value="">Seleccionar</option>
                            {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Código</label>
                            <input name="code" defaultValue={editingAccount?.code} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Cuenta Padre</label>
                            <select name="parent_id" defaultValue={editingAccount?.parent_id || ''} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                                <option value="">Ninguna (raíz)</option>
                                {accounts.filter(a => a.id !== editingAccount?.id && (!selectedFormType || a.account_type_id == selectedFormType)).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Nombre</label>
                        <input name="name" defaultValue={editingAccount?.name} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2"><input type="checkbox" name="allows_entries" value="1" defaultChecked={editingAccount ? editingAccount.allows_entries : true} className="w-4 h-4 text-indigo-600" /> <span className="text-xs font-bold">Permite asientos</span></label>
                        <label className="flex items-center gap-2"><input type="checkbox" name="active" value="1" defaultChecked={editingAccount ? editingAccount.active : true} className="w-4 h-4 text-indigo-600" /> <span className="text-xs font-bold">Activo</span></label>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => { setIsAccountModalOpen(false); setEditingAccount(null); }} className="flex-1 py-3 text-xs font-black uppercase text-slate-400">Cancelar</button>
                        <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ChartOfAccounts;
