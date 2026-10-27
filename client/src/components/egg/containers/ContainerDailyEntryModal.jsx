import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, CheckCircle2 } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';

export default function ContainerDailyEntryModal({
    open,
    onClose,
    onSave,
    row = null,
    containers = [],
    defaultDailyRate = 195,
    isSubmitting = false
}) {
    const [entryDate, setEntryDate] = useState('');
    const [lbsIn, setLbsIn] = useState('');
    const [lbsOut, setLbsOut] = useState('');
    const [dailyRate, setDailyRate] = useState(195);
    const [loadingCost, setLoadingCost] = useState(0);
    const [withdrawalCount, setWithdrawalCount] = useState('');
    const [incomeCount, setIncomeCount] = useState('');
    const [selectedNums, setSelectedNums] = useState([]);

    useEffect(() => {
        if (!open) return;
        if (row) {
            setEntryDate(row.entry_date || new Date().toISOString().split('T')[0]);
            setLbsIn(row.lbs_in > 0 ? String(row.lbs_in) : '');
            setLbsOut(row.lbs_out > 0 ? String(row.lbs_out) : '');
            setDailyRate(row.daily_rate ?? defaultDailyRate ?? 195);
            setLoadingCost(row.loading_unloading_cost ?? 0);
            setWithdrawalCount(row.withdrawal_count > 0 ? String(row.withdrawal_count) : '');
            setIncomeCount(row.income_count > 0 ? String(row.income_count) : '');
            const matches = String(row.active_containers_list || '').match(/\d+/g);
            setSelectedNums(matches ? matches.map(n => parseInt(n, 10)) : []);
        } else {
            setEntryDate(new Date().toISOString().split('T')[0]);
            setLbsIn('');
            setLbsOut('');
            setDailyRate(defaultDailyRate ?? 195);
            setLoadingCost(0);
            setWithdrawalCount('');
            setIncomeCount('');
            const activeNums = (Array.isArray(containers) ? containers : [])
                .filter(c => c.is_active_power)
                .map(c => Number(c.container_number));
            setSelectedNums(activeNums);
        }
    }, [open, row, containers, defaultDailyRate]);

    const sortedNums = useMemo(
        () => Array.from(new Set(selectedNums)).sort((a, b) => a - b),
        [selectedNums]
    );
    const daysAmount = +(sortedNums.length * (parseFloat(dailyRate) || 0)).toFixed(2);

    if (!open) return null;

    const toggleContainerNum = (num) => {
        setSelectedNums(prev =>
            prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: row?.id || null,
            entry_date: entryDate,
            lbs_in: parseFloat(lbsIn) || 0,
            lbs_out: parseFloat(lbsOut) || 0,
            daily_rate: parseFloat(dailyRate) || 195,
            containers_count: sortedNums.length,
            loading_unloading_cost: parseFloat(loadingCost) || 0,
            withdrawal_count: parseInt(withdrawalCount, 10) || 0,
            income_count: parseInt(incomeCount, 10) || 0,
            active_containers_list: sortedNums.join(',')
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                {row ? `Editar Día (${entryDate})` : 'Registrar Día en Estado de Cuenta'}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Ingreso/salida de libras, contenedores encendidos (`N° CON.`) y cargas/descargas
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Fecha
                            </label>
                            <input
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Ingreso (Libras)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={lbsIn}
                                onChange={(e) => setLbsIn(e.target.value)}
                                placeholder="Ej. 76493"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-emerald-700"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Salida (Libras)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={lbsOut}
                                onChange={(e) => setLbsOut(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-rose-600"
                            />
                        </div>
                    </div>

                    {/* Selección Visual de Contenedores Encendidos ese Día (N° CON.) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase">
                                Contenedores Encendidos ese Día (N° CON.: {sortedNums.join(',') || 'Ninguno'})
                            </span>
                            <span className="text-xs font-black text-indigo-600">
                                #{sortedNums.length} cont. = <Money value={daysAmount} />
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(Array.isArray(containers) ? containers : []).map((c) => {
                                const num = Number(c.container_number);
                                const active = sortedNums.includes(num);
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => toggleContainerNum(num)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                            active
                                                ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                                                : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400'
                                        }`}
                                    >
                                        #{num}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                $ X Día
                            </label>
                            <MoneyInput
                                value={dailyRate}
                                onChange={(val) => setDailyRate(val)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Cargas / Descargas ($)
                            </label>
                            <MoneyInput
                                value={loadingCost}
                                onChange={(val) => setLoadingCost(val)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Ingreso (# Cont.)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={incomeCount}
                                onChange={(e) => setIncomeCount(e.target.value)}
                                placeholder="Ej. 2"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Retiro (# Cont.)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={withdrawalCount}
                                onChange={(e) => setWithdrawalCount(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                            <CheckCircle2 size={15} />
                            <span>{isSubmitting ? 'Guardando...' : 'Guardar Día'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
