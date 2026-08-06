import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Lock, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

const YearClosing = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [year, setYear] = useState(new Date().getFullYear());
    const [date, setDate] = useState(`${year}-12-31`);
    const [description, setDescription] = useState('Cierre del Ejercicio Contable');

    const { data: trialBalance = [], isLoading } = useQuery({
        queryKey: ['trial-balance', year],
        queryFn: async () => (await axios.get(`/api/accounting/trial-balance?year=${year}`)).data,
    });

    // Solo cuentas de resultado
    const incomeAccounts = trialBalance.filter(a => ['4', '5', '6'].includes(a.code.substring(0, 1)));
    const totalIncome = incomeAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

    const closeMutation = useMutation({
        mutationFn: () => axios.post('/api/accounting/closing', { date, description }),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['entries']);
            toast.success(`Cierre generado: ${data.data?.entry_id || 'OK'} - ${data.data?.lines} líneas`);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const formatNum = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Lock size={28} className="text-rose-600" />Cierre Contable</h1>
                    <p className="text-slate-500 font-medium">Cerrar cuentas de resultado al final del ejercicio</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Año Fiscal</label>
                    <input type="number" value={year} onChange={e => { setYear(e.target.value); setDate(`${e.target.value}-12-31`); }} className="w-full mt-1 text-2xl font-black bg-slate-50 rounded-xl px-4 py-2" />
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Fecha de Cierre</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 text-lg font-bold bg-slate-50 rounded-xl px-4 py-2" />
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                    <label className="text-[10px] font-black uppercase text-slate-400">Total Resultado</label>
                    <p className={`text-2xl font-black ${totalIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNum(totalIncome)}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-400">Cargando saldos...</div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border overflow-hidden">
                        <div className="px-6 py-4 bg-rose-50/50 border-b flex items-center gap-2">
                            <TrendingDown size={14} className="text-rose-500" />
                            <h3 className="text-sm font-black text-slate-900">Cuentas de Resultado a Cerrar ({incomeAccounts.length})</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead><tr className="border-b bg-slate-50"><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Código</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Cuenta</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400">Tipo</th><th className="px-6 py-2 text-[10px] uppercase text-slate-400 text-right">Saldo</th></tr></thead>
                            <tbody>
                                {incomeAccounts.map(a => (
                                    <tr key={a.id} className="border-b border-slate-50">
                                        <td className="px-6 py-2 font-mono text-xs">{a.code}</td>
                                        <td className="px-6 py-2 text-xs font-bold">{a.name}</td>
                                        <td className="px-6 py-2 text-xs">{a.type_name}</td>
                                        <td className={`px-6 py-2 text-xs font-bold text-right ${parseFloat(a.balance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNum(a.balance)}</td>
                                    </tr>
                                ))}
                                {incomeAccounts.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Sin saldos de resultado para este año</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400">Descripción de la Partida</label>
                        <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-bold" />
                        <button
                            onClick={async () => { const ok = await confirm({ title: 'Cierre Anual', message: '¿Generar partida de cierre? Esto no se puede deshacer.', confirmLabel: 'Cerrar Ejercicio' }); if (ok) closeMutation.mutate(); }}
                            disabled={closeMutation.isPending || incomeAccounts.length === 0}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50"
                        >
                            {closeMutation.isPending ? 'Generando...' : 'Generar Partida de Cierre'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default YearClosing;
