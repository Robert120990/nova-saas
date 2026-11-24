import { useState } from 'react';
import { Search, Edit3, Calendar, AlertTriangle, CheckCheck, Ban, SlidersHorizontal, Moon } from 'lucide-react';
import Table from '../ui/Table';
import { formatDate, formatDecimalHours, getDateRangePreset } from '../../utils/dateUtils';

const QUICK_PRESETS = [
    { id: 'quincena_actual', label: 'Quincena Actual' },
    { id: 'quincena_anterior', label: 'Quincena Anterior' },
    { id: 'mes_actual', label: 'Este Mes' },
    { id: 'mes_anterior', label: 'Mes Anterior' }
];

const getRowKey = (r) => `${r.device_uid}_${r.fecha}`;

const BiometricOvertimeTable = ({
    rows,
    isLoading,
    search,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onApplyRange,
    onlyOvertime,
    onOnlyOvertimeChange,
    isFrozenView,
    onOpenEdit,
    onBatchAction,
    isBatchPending = false
}) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [capValue, setCapValue] = useState('2.0');

    const visibleKeys = safeRows.map(getRowKey);
    const activeSelectedKeys = selectedKeys.filter(k => visibleKeys.includes(k));
    const allSelected = visibleKeys.length > 0 && activeSelectedKeys.length === visibleKeys.length;

    const toggleAll = () => setSelectedKeys(allSelected ? [] : visibleKeys);
    const toggleRow = (key) => {
        setSelectedKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };

    const runBatch = (action, customHours = 0) => {
        if (!onBatchAction || activeSelectedKeys.length === 0) return;
        const selectedEntries = safeRows.filter(r => activeSelectedKeys.includes(getRowKey(r)));
        onBatchAction({ entries: selectedEntries, action, customHours }, () => setSelectedKeys([]));
    };

    const headers = [
        {
            label: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            ),
            sortable: false,
            className: 'w-9 text-center'
        },
        { label: 'Fecha', sortKey: 'fecha', sortType: 'date' },
        { label: 'Colaborador', sortKey: 'nombre', sortType: 'string' },
        { label: 'Cargo / Depto', sortKey: 'departamento', sortType: 'string' },
        { label: 'Entrada', sortKey: 'entrada', sortType: 'string' },
        { label: 'Salida', sortKey: 'salida', sortType: 'string' },
        { label: 'Horas Lab.', sortKey: 'horas_trabajadas', sortType: 'number', className: 'text-right' },
        { label: 'Tardanza', sortKey: 'minutos_tardanza', sortType: 'number', className: 'text-right' },
        { label: 'H.E. Reloj', sortKey: 'horas_extra_calculadas', sortType: 'number', className: 'text-right' },
        { label: 'H.E. Aprobadas', sortKey: 'horas_extra_aprobadas', sortType: 'number', className: 'text-right' },
        { label: 'Observación', sortKey: 'observacion', sortType: 'string' },
        { label: 'Acciones', className: 'text-center', sortable: false }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Barra de Filtros */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                    <div className="relative lg:col-span-4">
                        <input
                            type="text"
                            placeholder="Buscar colaborador, código, cargo..."
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full text-xs font-medium border border-slate-300 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    {!isFrozenView && (
                        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
                            <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white" />
                            <span className="text-slate-400 font-bold shrink-0">a</span>
                            <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white" />
                        </div>
                    )}

                    <div className="flex items-center gap-2 lg:col-span-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={onlyOvertime} onChange={(e) => onOnlyOvertimeChange(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                            <span className="font-bold text-slate-700 text-xs">Solo registros con Horas Extra</span>
                        </label>
                    </div>
                </div>

                {!isFrozenView && onApplyRange && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mr-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Período rápido:
                        </span>
                        {QUICK_PRESETS.map((preset) => {
                            const pRange = getDateRangePreset(preset.id);
                            const isActive = startDate === pRange.startDate && endDate === pRange.endDate;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => onApplyRange(pRange.startDate, pRange.endDate)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Barra de Aprobación Masiva */}
                {activeSelectedKeys.length > 0 && onBatchAction && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <span className="font-bold text-indigo-900">
                            {activeSelectedKeys.length} registro(s) seleccionado(s)
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                disabled={isBatchPending}
                                onClick={() => runBatch('approve_clock')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg disabled:opacity-50"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Aprobar Reloj
                            </button>
                            <button
                                type="button"
                                disabled={isBatchPending}
                                onClick={() => runBatch('deny_zero')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg disabled:opacity-50"
                            >
                                <Ban className="w-3.5 h-3.5" />
                                Denegar (0h)
                            </button>
                            <div className="inline-flex items-center gap-1 bg-white border border-indigo-200 rounded-lg px-2 py-0.5">
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="12"
                                    value={capValue}
                                    onChange={(e) => setCapValue(e.target.value)}
                                    className="w-12 text-xs font-bold text-indigo-900 outline-none text-center"
                                />
                                <button
                                    type="button"
                                    disabled={isBatchPending}
                                    onClick={() => runBatch('cap_hours', parseFloat(capValue) || 0)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 rounded disabled:opacity-50"
                                    title="Limitar las horas extra de los registros seleccionados a este tope máximo"
                                >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    Tope (h)
                                </button>
                            </div>
                            <button type="button" onClick={() => setSelectedKeys([])} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-1.5">
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Table
                headers={headers}
                data={safeRows}
                isLoading={isLoading}
                emptyMessage="No se encontraron registros de asistencia/horas para el rango seleccionado."
                renderRow={(r, idx) => {
                    const rowKey = getRowKey(r);
                    const isChecked = activeSelectedKeys.includes(rowKey);
                    return (
                        <tr key={`${rowKey}-${idx}`} className={`hover:bg-slate-50/80 transition-colors text-xs text-slate-700 ${isChecked ? 'bg-indigo-50/40' : ''}`}>
                            <td className="py-2.5 px-2 text-center">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleRow(rowKey)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium">
                                <span className="block">{formatDate(r.fecha)}</span>
                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                    {r.es_festivo && <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded">Festivo</span>}
                                    {r.es_domingo && <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1 py-0.5 rounded">Dom</span>}
                                    {r.es_marcacion_incompleta && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-300 px-1 py-0.5 rounded" title={r.alerta_marcacion}>
                                            <AlertTriangle className="w-2.5 h-2.5" />
                                            Incompleta
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block">{r.nombre}</span>
                                <span className="text-[10px] text-slate-400 font-mono">[{r.codigo}]</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                <span>{r.cargo}</span>
                                <span className="block text-[10px] text-slate-400">{r.departamento}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{r.entrada || '---'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{r.salida || '---'}</td>
                            <td className="py-2.5 px-3 font-mono text-right text-slate-800">
                                {r.horas_trabajadas > 0 ? (
                                    <div>
                                        <span className="font-bold text-slate-800 block">{formatDecimalHours(r.horas_trabajadas)}</span>
                                        <span className="text-[10px] text-slate-400 font-normal block">({r.horas_trabajadas.toFixed(2)} h)</span>
                                    </div>
                                ) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-right">
                                {r.es_llegada_tarde ? (
                                    <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">{r.minutos_tardanza} min</span>
                                ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-right text-slate-500">
                                {r.horas_extra_calculadas > 0 ? (
                                    <div>
                                        <span className="font-bold text-indigo-900 block">{formatDecimalHours(r.horas_extra_calculadas)}</span>
                                        <span className="text-[10px] text-slate-400 font-normal block">({r.horas_extra_calculadas.toFixed(2)} h)</span>
                                    </div>
                                ) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-right bg-indigo-50/50">
                                {r.horas_extra_aprobadas > 0 ? (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                +{formatDecimalHours(r.horas_extra_aprobadas)}
                                            </span>
                                            {r.es_editado && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Ajustada manualmente" />}
                                        </div>
                                        <span className="text-[10px] text-emerald-700/80 font-normal mt-0.5 flex items-center gap-1">
                                            ({r.horas_extra_aprobadas.toFixed(2)} h)
                                            {r.horas_extra_nocturnas > 0 && (
                                                <span className="inline-flex items-center gap-0.5 px-1 rounded bg-indigo-100 text-indigo-800 font-bold" title={`Nocturnas: ${r.horas_extra_nocturnas}h | Diurnas: ${r.horas_extra_diurnas}h`}>
                                                    <Moon className="w-2.5 h-2.5" />{r.horas_extra_nocturnas}h
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={r.observacion || r.alerta_marcacion}>
                                {r.observacion || (r.alerta_marcacion ? <span className="text-amber-600 text-[11px]">{r.alerta_marcacion}</span> : <span className="text-slate-300 italic">Sin nota</span>)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <button
                                    type="button"
                                    onClick={() => onOpenEdit(r)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all shadow-xs"
                                    title="Editar horas extra de este día"
                                >
                                    <Edit3 className="w-3 h-3 text-indigo-600" />
                                    <span>Editar</span>
                                </button>
                            </td>
                        </tr>
                    );
                }}
            />
        </div>
    );
};

export default BiometricOvertimeTable;
