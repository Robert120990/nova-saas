import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';

const ChartOfAccounts = () => {
    const queryClient = useQueryClient();
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [selectedType, setSelectedType] = useState('');

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts', selectedType],
        queryFn: async () => (await axios.get(`/api/accounting/accounts?type_id=${selectedType}`)).data,
    });

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
            description: fd.get('description') || null,
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
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold">
                        <option value="">Todos los tipos</option>
                        {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={() => { setEditingAccount(null); setIsAccountModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2">
                        <Plus size={16} /> Nueva Cuenta
                    </button>
                </div>
            </div>

            <Table headers={['Código', 'Nombre', 'Tipo', 'Padre', 'Detalle', 'Estado']} data={accounts} isLoading={isLoading}
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
                                <button onClick={() => { setEditingAccount(a); setIsAccountModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit size={14} /></button>
                                <button onClick={() => { if (confirm('¿Eliminar?')) deleteMutation.mutate(a.id); }} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                            </div>
                        </td>
                    </tr>
                )}
            />

            <Modal isOpen={isAccountModalOpen} onClose={() => { setIsAccountModalOpen(false); setEditingAccount(null); }} title={editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'} maxWidth="max-w-md">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Tipo de Cuenta</label>
                        <select name="account_type_id" defaultValue={editingAccount?.account_type_id || ''} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
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
                                {accounts.filter(a => !a.allows_entries || a.id === editingAccount?.parent_id).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Nombre</label>
                        <input name="name" defaultValue={editingAccount?.name} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Descripción</label>
                        <input name="description" defaultValue={editingAccount?.description || ''} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
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
