import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Unlock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

const YearOpening = () => {
    const confirm = useConfirm();
    const [year, setYear] = useState(new Date().getFullYear() + 1);
    const [date, setDate] = useState(`${year}-01-01`);
    const [description, setDescription] = useState('Apertura del Ejercicio Contable');

    const { data: trialBalance = [], isLoading } = useQuery({
        queryKey: ['trial-balance', year - 1],
        queryFn: async () => (await axios.get(`/api/accounting/trial-balance?year=${year - 1}`)).data,
    });

    const balanceAccounts = trialBalance.filter(a => ['1', '2', '3'].includes(a.code.substring(0, 1)));
    const totalAssets = balanceAccounts.filter(a => a.code.startsWith('1')).reduce((s, a) => s + parseFloat(a.balance || 0), 0);
    const totalLiabilities = balanceAccounts.filter(a => a.code.startsWith('2') || a.code.startsWith('3')).reduce((s, a) => s + parseFloat(a.balance || 0), 0);

    const openMutation = useMutation({
        mutationFn: () => axios.post('/api/accounting/opening', { date, description }),
        onSuccess: (data) => toast.success(`Apertura generada: ${data.data?.entry_id || 'OK'} - ${data.data?.lines} líneas`),
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const formatNum = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Unlock size={28} className="text-emerald-600" />Apertura de Ejercicio</h1>
                    <p className="text-slate-500 font-medium">Iniciar un nuevo año fiscal con los saldos del balance</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Nuevo Año</label>
                    <input type="number" value={year} onChange={e => { setYear(e.target.value); setDate(`${e.target.value}-01-01`); }} className="w-full mt-1 text-2xl font-black bg-slate-50 rounded-xl px-4 py-2" />
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Fecha Apertura</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 text-lg font-bold bg-slate-50 rounded-xl px-4 py-2" />
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Total Activo</label>
                    <p className="text-2xl font-black text-blue-600">{formatNum(totalAssets)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Pasivo + Patrimonio</label>
                    <p className="text-2xl font-black text-rose-600">{formatNum(totalLiabilities)}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">Cargando saldos...</div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border overflow-hidden">
                        <div className="px-6 py-4 bg-emerald-50/50 border-b flex items-center gap-2">
                            <Calendar size={14} className="text-emerald-500" />
                            <h3 className="text-sm font-black text-slate-900">Saldos de Balance — Año {year - 1} ({balanceAccounts.length} cuentas)</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead><tr className="border-b bg-slate-50"><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Código</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Cuenta</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Tipo</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400 text-right">Saldo</th></tr></thead>
                            <tbody>
                                {balanceAccounts.map(a => (
                                    <tr key={a.id} className="border-b border-slate-50">
                                        <td className="px-6 py-2 font-mono text-xs">{a.code}</td>
                                        <td className="px-6 py-2 text-xs font-bold">{a.name}</td>
                                        <td className="px-6 py-2 text-xs">{a.type_name}</td>
                                        <td className={`px-6 py-2 text-xs font-bold text-right ${parseFloat(a.balance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNum(a.balance)}</td>
                                    </tr>
                                ))}
                                {balanceAccounts.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Sin saldos de balance del año anterior</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400">Descripción</label>
                        <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-bold" />
                        <button
                            onClick={async () => { const ok = await confirm({ title: 'Apertura de Ejercicio', message: '¿Generar partida de apertura?', confirmLabel: 'Abrir Ejercicio' }); if (ok) openMutation.mutate(); }}
                            disabled={openMutation.isPending || balanceAccounts.length === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50"
                        >
                            {openMutation.isPending ? 'Generando...' : 'Generar Partida de Apertura'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default YearOpening;
