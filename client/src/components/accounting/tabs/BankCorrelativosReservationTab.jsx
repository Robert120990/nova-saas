import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Sparkles, Save, RotateCcw, ArrowDownLeft, ArrowUpRight, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import Money from '../../ui/Money';
import BankCorrelativosReservationTable from './BankCorrelativosReservationTable';

const MONTHS = [
    { value: 1, label: '01 - ENERO' }, { value: 2, label: '02 - FEBRERO' },
    { value: 3, label: '03 - MARZO' }, { value: 4, label: '04 - ABRIL' },
    { value: 5, label: '05 - MAYO' }, { value: 6, label: '06 - JUNIO' },
    { value: 7, label: '07 - JULIO' }, { value: 8, label: '08 - AGOSTO' },
    { value: 9, label: '09 - SEPTIEMBRE' }, { value: 10, label: '10 - OCTUBRE' },
    { value: 11, label: '11 - NOVIEMBRE' }, { value: 12, label: '12 - DICIEMBRE' },
];

const SUB_TABS = [
    { id: 'ingresos', label: 'INGRESOS', subtitle: 'Movimientos de Tipo Ingreso', icon: ArrowDownLeft },
    { id: 'egresos', label: 'EGRESOS', subtitle: 'Movimientos de Tipo Egreso', icon: ArrowUpRight },
    { id: 'diario', label: 'DIARIO', subtitle: 'Movimientos de Tipo Diario', icon: BookOpen },
];

const BankCorrelativosReservationTab = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [activeSubTab, setActiveSubTab] = useState('ingresos');
    const [searchTerm, setSearchTerm] = useState('');

    const [localNums, setLocalNums] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const { data: serverItems = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['bank-reservation-movements', companyId, month, year, activeSubTab],
        queryFn: async () => {
            const res = await axios.get('/api/accounting/generation/bank/reservation/movements', {
                headers,
                params: { month, year, type: activeSubTab }
            });
            return unwrapList(res.data);
        },
        enabled: !!companyId,
    });

    const items = useMemo(() => {
        return (Array.isArray(serverItems) ? serverItems : []).map(item => ({
            ...item,
            num: localNums[item.llave] !== undefined ? localNums[item.llave] : (item.num || '')
        }));
    }, [serverItems, localNums]);

    const filteredItems = useMemo(() => {
        const q = (searchTerm || '').trim().toLowerCase();
        if (!q) return items;
        return items.filter(it => 
            (it.referencia || '').toLowerCase().includes(q) ||
            (it.concepto || '').toLowerCase().includes(q) ||
            (it.llave || '').toLowerCase().includes(q) ||
            (it.num || '').toLowerCase().includes(q) ||
            (it.fecha || '').toLowerCase().includes(q)
        );
    }, [items, searchTerm]);

    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/accounting/generation/bank/reservation/save', payload, { headers });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Correlativos guardados exitosamente');
            setHasUnsavedChanges(false);
            setLocalNums({});
            queryClient.invalidateQueries({ queryKey: ['bank-reservation-movements'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar correlativos');
        }
    });

    const handleConsultar = () => {
        setLocalNums({});
        setHasUnsavedChanges(false);
        refetch();
    };

    const handleGenerarCorrelativo = () => {
        if (items.length === 0) {
            toast.warning('No hay movimientos disponibles para numerar');
            return;
        }

        if (allAssigned) {
            toast.info('Todos los movimientos ya tienen correlativo asignado.');
            return;
        }

        const mm = String(month).padStart(2, '0');
        const nextMap = { ...localNums };

        // Determine highest existing sequence number for this month
        let maxSeq = 0;
        items.forEach(it => {
            const val = String(it.num || '').trim();
            if (val) {
                if (val.startsWith(mm) && val.length > 2) {
                    const parsed = parseInt(val.slice(2), 10);
                    if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
                } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
                }
            }
        });

        let assignedCount = 0;
        items.forEach(item => {
            if (!item.num || String(item.num).trim() === '') {
                maxSeq += 1;
                const seq = String(maxSeq).padStart(4, '0');
                nextMap[item.llave] = `${mm}${seq}`;
                assignedCount++;
            }
        });

        setLocalNums(nextMap);
        setHasUnsavedChanges(true);
        toast.info(`Se asignaron ${assignedCount} correlativo(s) pendiente(s) (${mm}${String(maxSeq - assignedCount + 1).padStart(4, '0')} - ${mm}${String(maxSeq).padStart(4, '0')})`);
    };

    const handleGuardar = () => {
        if (!hasUnsavedChanges) {
            toast.info('No hay cambios pendientes de guardar');
            return;
        }

        const payloadItems = items
            .filter(it => it.num && String(it.num).trim() !== '')
            .map(it => ({
                id: it.id,
                llave: it.llave,
                num: it.num,
                origen: it.origen
            }));

        saveMutation.mutate({
            month,
            year,
            type: activeSubTab,
            items: payloadItems
        });
    };

    const currentSubTabInfo = SUB_TABS.find(t => t.id === activeSubTab) || SUB_TABS[0];
    const totalMonto = useMemo(() => items.reduce((s, it) => s + (parseFloat(it.monto) || 0), 0), [items]);
    const withNumCount = useMemo(() => items.filter(it => Boolean(it.num && String(it.num).trim() !== '')).length, [items]);
    const pendingItems = useMemo(() => items.filter(it => !it.num || String(it.num).trim() === ''), [items]);
    const allAssigned = items.length > 0 && pendingItems.length === 0;

    return (
        <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                            <Sparkles size={20} className="text-indigo-600" />
                            Reserva de Correlativos Contables
                        </h2>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                            Asignación y reserva correlativa de partidas contables de ingresos, egresos y diario
                        </p>
                    </div>

                    {/* Period Controls & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Período:</span>
                            <select
                                value={month}
                                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min="2020"
                                max="2035"
                                value={year}
                                onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                                className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleConsultar}
                            disabled={isLoading || isFetching}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition-all disabled:opacity-50 shadow-sm"
                        >
                            <RotateCcw size={14} className={isFetching ? "animate-spin" : ""} />
                            Consultar
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerarCorrelativo}
                            disabled={isLoading || isFetching || items.length === 0 || allAssigned}
                            title={allAssigned ? 'Todos los movimientos de este período ya tienen correlativo asignado' : 'Generar correlativos para los movimientos pendientes'}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                                allAssigned
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
                            }`}
                        >
                            <Sparkles size={14} />
                            {allAssigned ? 'Correlativos Asignados' : pendingItems.length < items.length && pendingItems.length > 0 ? `Generar (${pendingItems.length})` : 'Generar Correlativo'}
                        </button>

                        <button
                            type="button"
                            onClick={handleGuardar}
                            disabled={!hasUnsavedChanges || saveMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-600/20"
                        >
                            {saveMutation.isPending ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            Guardar
                        </button>
                    </div>
                </div>

                {/* Sub-tabs Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                        {SUB_TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeSubTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveSubTab(tab.id);
                                        setLocalNums({});
                                        setHasUnsavedChanges(false);
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                        isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Search */}
                    <div className="relative w-full sm:w-72">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar ref, concepto, llave..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Subtitle & Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {currentSubTabInfo.subtitle}
                </span>

                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                    <span>Total: <strong className="text-slate-800">{items.length}</strong> movs</span>
                    <span>•</span>
                    <span>Con NUM: <strong className={allAssigned ? 'text-emerald-600' : 'text-slate-800'}>{withNumCount}</strong></span>
                    <span>•</span>
                    <span>Monto: <strong className="text-slate-900"><Money value={totalMonto} /></strong></span>
                    {allAssigned && items.length > 0 && !hasUnsavedChanges && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-[10px]">
                            ✓ 100% Asignados
                        </span>
                    )}
                    {pendingItems.length > 0 && items.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-black text-[10px]">
                            {pendingItems.length} pendientes
                        </span>
                    )}
                    {hasUnsavedChanges && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-black text-[10px] animate-pulse">
                            Cambios pendientes de guardar
                        </span>
                    )}
                </div>
            </div>

            {/* Table Subcomponent */}
            <BankCorrelativosReservationTable
                isLoading={isLoading}
                filteredItems={filteredItems}
                localNums={localNums}
            />
        </div>
    );
};

export default BankCorrelativosReservationTab;
