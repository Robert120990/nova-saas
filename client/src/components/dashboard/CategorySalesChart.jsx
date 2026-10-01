import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { TrendingUp } from 'lucide-react';
import Money from '../ui/Money';

export default function CategorySalesChart() {
    const [branchId, setBranchId] = useState('');
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const { data: catData, isLoading: catLoading } = useQuery({
        queryKey: ['category-sales', branchId, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
            if (branchId) params.append('branch_id', branchId);
            return (await axios.get(`/api/dashboard/category-sales?${params}`)).data;
        },
        refetchInterval: 60000
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'], queryFn: async () => (await axios.get('/api/branches')).data,
    });

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Ventas por Categoría</h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <select value={branchId} onChange={e => setBranchId(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-full sm:w-auto">
                        <option value="">Todas las sucursales</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px] flex-1 min-w-0 sm:flex-none" />
                        <span className="text-[10px] text-slate-400">a</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px] flex-1 min-w-0 sm:flex-none" />
                    </div>
                </div>
            </div>
            <div className="p-5">
                {catLoading ? (
                    <div className="text-center py-8 text-slate-400 text-xs">Cargando...</div>
                ) : !catData?.length ? (
                    <div className="text-center py-8 text-slate-300 text-xs">Sin datos para el período seleccionado</div>
                ) : (
                    <div className="space-y-3">
                        {catData.map((cat, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-600 w-32 truncate">{cat.category}</span>
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                        width: `${cat.pct}%`,
                                        backgroundColor: ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6'][i % 10]
                                    }} />
                                </div>
                                <div className="w-24 text-right">
                                    <Money value={cat.total} className="text-[10px] font-bold text-slate-600" />
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 w-10 text-right">{cat.pct}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
