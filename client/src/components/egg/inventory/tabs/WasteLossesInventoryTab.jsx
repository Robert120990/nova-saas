import { useState, useMemo } from 'react';
import { Scale, Search, AlertOctagon, TrendingDown, Layers, User, FileText } from 'lucide-react';
import { formatDateTime } from '../../../../utils/dateUtils';

export default function WasteLossesInventoryTab({ model }) {
    const {
        overviewData,
        searchTerm,
        setSearchTerm,
        unitOfMeasure
    } = model;

    const [wasteViewMode, setWasteViewMode] = useState('logs'); // 'logs' | 'batch_balance'
    const [selectedStage, setSelectedStage] = useState('todas');

    const wastes = overviewData?.wastes || { summary: {}, by_stage: [], logs: [], batch_wastes: [] };
    const summary = wastes.summary || {};
    const byStage = Array.isArray(wastes.by_stage) ? wastes.by_stage : [];
    const logs = Array.isArray(wastes.logs) ? wastes.logs : [];
    const batchWastes = Array.isArray(wastes.batch_wastes) ? wastes.batch_wastes : [];

    // Etapas disponibles
    const availableStages = useMemo(() => {
        const stages = new Set();
        logs.forEach(l => { if (l.stage) stages.add(l.stage); });
        return Array.from(stages);
    }, [logs]);

    // Filtrar bitácora de mermas
    const filteredLogs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return logs.filter(l => {
            const matchesSearch = !term ||
                (l.batch_code_display || '').toLowerCase().includes(term) ||
                (l.waste_type || '').toLowerCase().includes(term) ||
                (l.reason || '').toLowerCase().includes(term) ||
                (l.operator_name || '').toLowerCase().includes(term) ||
                (l.stage || '').toLowerCase().includes(term);

            const matchesStage = selectedStage === 'todas' || (l.stage || '').toLowerCase() === selectedStage.toLowerCase();

            return matchesSearch && matchesStage;
        });
    }, [logs, searchTerm, selectedStage]);

    // Filtrar balance por lotes
    const filteredBatchWastes = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return batchWastes.filter(b => {
            return !term ||
                (b.batch_code_display || '').toLowerCase().includes(term) ||
                (b.product_type || '').toLowerCase().includes(term) ||
                (b.presentation || '').toLowerCase().includes(term);
        });
    }, [batchWastes, searchTerm]);

    const getStageBadge = (stage) => {
        const s = (stage || '').toLowerCase();
        if (s === 'quebraje') return 'bg-amber-100 text-amber-800 border-amber-200';
        if (s === 'pasteurizacion') return 'bg-rose-100 text-rose-800 border-rose-200';
        if (s === 'envasado' || s === 'tuberias') return 'bg-purple-100 text-purple-800 border-purple-200';
        if (s === 'calidad') return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-slate-100 text-slate-800 border-slate-200';
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Total Mermas</span>
                        <TrendingDown size={15} className="text-rose-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-rose-600">
                        {parseFloat(summary.total_waste_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5 truncate">
                        Lbs ({parseFloat(summary.total_waste_kg || 0).toLocaleString()} Kg)
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Cáscara Quebraje</span>
                        <Scale size={15} className="text-amber-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-amber-700">
                        {parseFloat(summary.shell_waste_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-amber-800 font-bold block mt-0.5 truncate">
                        Cascarón (Lbs)
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pérdidas Proceso</span>
                        <AlertOctagon size={15} className="text-orange-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-orange-700">
                        {parseFloat(summary.process_waste_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-orange-800 font-bold block mt-0.5 truncate">
                        Pasteurización (Lbs)
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Mermas Envasado</span>
                        <Scale size={15} className="text-purple-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-purple-700">
                        {parseFloat(summary.packaging_waste_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-purple-800 font-bold block mt-0.5 truncate">
                        Tubería / faltante (Lbs)
                    </span>
                </div>
            </div>

            {/* Distribution Bar */}
            {byStage.length > 0 && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Distribución de Mermas por Etapa Operativa
                        </h4>
                        <span className="text-xs text-slate-500 font-medium">
                            {summary.total_logs_count || 0} eventos registrados
                        </span>
                    </div>

                    {/* Progress multi-bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        {byStage.map((st, i) => {
                            const colors = [
                                'bg-amber-500',
                                'bg-purple-500',
                                'bg-rose-500',
                                'bg-blue-500',
                                'bg-slate-400'
                            ];
                            return (
                                <div
                                    key={st.stage}
                                    style={{ width: `${st.percentage}%` }}
                                    className={`${colors[i % colors.length]} h-full transition-all`}
                                    title={`${st.stage}: ${st.total_lbs} Lbs (${st.percentage}%)`}
                                />
                            );
                        })}
                    </div>

                    {/* Legend chips */}
                    <div className="flex flex-wrap gap-3 pt-1">
                        {byStage.map((st, i) => {
                            const dotColors = [
                                'bg-amber-500',
                                'bg-purple-500',
                                'bg-rose-500',
                                'bg-blue-500',
                                'bg-slate-400'
                            ];
                            return (
                                <div key={st.stage} className="flex items-center gap-1.5 text-xs text-slate-700">
                                    <span className={`w-2.5 h-2.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                                    <span className="font-semibold capitalize">{st.stage}:</span>
                                    <span className="font-black">{st.total_lbs.toLocaleString()} Lbs</span>
                                    <span className="text-slate-400 text-[11px]">({st.percentage}%)</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sub-view Navigation & Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setWasteViewMode('logs')}
                        className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            wasteViewMode === 'logs'
                                ? 'bg-white text-rose-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileText size={14} />
                        <span>Bitácora de Mermas</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setWasteViewMode('batch_balance')}
                        className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            wasteViewMode === 'batch_balance'
                                ? 'bg-white text-rose-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={14} />
                        <span>Balance por Lote</span>
                    </button>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar por lote, causa, operador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                        />
                    </div>

                    {wasteViewMode === 'logs' && availableStages.length > 0 && (
                        <select
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        >
                            <option value="todas">Todas las Etapas ({availableStages.length})</option>
                            {availableStages.map(s => (
                                <option key={s} value={s}>{s.toUpperCase()}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Waste View Content */}
            {wasteViewMode === 'logs' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <TrendingDown size={17} className="text-rose-600" />
                            Registro Detallado de Mermas ({filteredLogs.length})
                        </h3>
                    </div>

                    {filteredLogs.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <TrendingDown size={32} className="text-slate-300" />
                            No se encontraron registros de merma que coincidan con la búsqueda.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Fecha y Hora</th>
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3 text-center">Etapa Operativa</th>
                                        <th className="p-3">Tipo de Merma</th>
                                        <th className="p-3 text-right">
                                            {unitOfMeasure === 'kg' ? 'Cantidad (Kg)' : 'Cantidad (Lbs)'}
                                        </th>
                                        <th className="p-3">Motivo / Justificación</th>
                                        <th className="p-3">Operador</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {(Array.isArray(filteredLogs) ? filteredLogs : []).map((w) => (
                                        <tr key={w.id} className="hover:bg-rose-50/30 transition-colors">
                                            <td className="p-3 text-slate-700 whitespace-nowrap">
                                                {formatDateTime(w.created_at)}
                                            </td>
                                            <td className="p-3 font-semibold text-slate-800">
                                                {w.batch_code_display || `Lote #${w.batch_id}`}
                                                {w.batch_product_type && (
                                                    <span className="block text-[10px] text-slate-400 capitalize">
                                                        {w.batch_product_type}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${getStageBadge(w.stage)}`}>
                                                    {w.stage}
                                                </span>
                                            </td>
                                            <td className="p-3 capitalize text-slate-800">
                                                {(w.waste_type || '').replace(/_/g, ' ')}
                                            </td>
                                            <td className="p-3 text-right font-black text-rose-700">
                                                {unitOfMeasure === 'kg'
                                                    ? `${w.quantity_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg`
                                                    : `${w.quantity_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs`
                                                }
                                            </td>
                                            <td className="p-3 text-slate-600 max-w-xs truncate" title={w.reason}>
                                                {w.reason}
                                            </td>
                                            <td className="p-3 text-slate-700 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-slate-600">
                                                    <User size={12} className="text-slate-400" />
                                                    {w.operator_name}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {wasteViewMode === 'batch_balance' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Layers size={17} className="text-rose-600" />
                            Balance de Rendimiento y Mermas por Lote de Producción ({filteredBatchWastes.length})
                        </h3>
                    </div>

                    {filteredBatchWastes.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <Layers size={32} className="text-slate-300" />
                            No se encontraron lotes con mermas registradas.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3">Producto</th>
                                        <th className="p-3 text-right">MP Entrante (Lbs)</th>
                                        <th className="p-3 text-right">Líquido Obtenido (Lbs)</th>
                                        <th className="p-3 text-right">Cáscara (Lbs)</th>
                                        <th className="p-3 text-right">Proceso (Lbs)</th>
                                        <th className="p-3 text-right">Envasado (Lbs)</th>
                                        <th className="p-3 text-right">Merma Total</th>
                                        <th className="p-3 text-center">% Merma</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {(Array.isArray(filteredBatchWastes) ? filteredBatchWastes : []).map((b) => (
                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-900 font-mono">
                                                {b.batch_code_display || `Lote #${b.id}`}
                                            </td>
                                            <td className="p-3 capitalize text-slate-700">
                                                {b.product_type} {b.presentation ? `(${b.presentation})` : ''}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-800">
                                                {b.input_weight_lbs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-700">
                                                {b.yield_liquid_lbs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right text-amber-700 font-semibold">
                                                {b.waste_shell_lbs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right text-orange-700 font-semibold">
                                                {b.waste_loss_lbs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right text-purple-700 font-semibold">
                                                {b.packaging_loss_lbs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-black text-rose-700">
                                                {b.total_waste_lbs.toLocaleString()} Lbs
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    b.waste_pct > 25 ? 'bg-rose-100 text-rose-800' :
                                                    b.waste_pct > 15 ? 'bg-amber-100 text-amber-800' :
                                                    'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {b.waste_pct}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
