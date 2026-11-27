import { useState } from 'react';
import { Edit3, AlertTriangle, Moon } from 'lucide-react';
import Table from '../ui/Table';
import BiometricOvertimeFiltersBar from './BiometricOvertimeFiltersBar';
import { formatDate, formatDecimalHours } from '../../utils/dateUtils';

const getRowKey = (r) => `${r.device_uid}_${r.fecha}`;

const BiometricOvertimeTable = ({
    rows,
    isLoading,
    search,
    onSearchChange,
    employees = [],
    selectedEmployeeKey = 'all',
    onSelectedEmployeeChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onApplyRange,
    onlyOvertime,
    onOnlyOvertimeChange,
    includeDeficit = false,
    onIncludeDeficitChange,
    onlyNegative = false,
    onOnlyNegativeChange,
    negativeCount = 0,
    negativeHours = 0,
    isFrozenView,
    onOpenEdit,
    onBatchAction,
    isBatchPending = false
}) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeEmployees = Array.isArray(employees) ? employees : [];
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
            <BiometricOvertimeFiltersBar
                search={search}
                onSearchChange={onSearchChange}
                employees={safeEmployees}
                selectedEmployeeKey={selectedEmployeeKey}
                onSelectedEmployeeChange={onSelectedEmployeeChange}
                startDate={startDate}
                onStartDateChange={onStartDateChange}
                endDate={endDate}
                onEndDateChange={onEndDateChange}
                onApplyRange={onApplyRange}
                onlyOvertime={onlyOvertime}
                onOnlyOvertimeChange={onOnlyOvertimeChange}
                includeDeficit={includeDeficit}
                onIncludeDeficitChange={onIncludeDeficitChange}
                onlyNegative={onlyNegative}
                onOnlyNegativeChange={onOnlyNegativeChange}
                negativeCount={negativeCount}
                negativeHours={negativeHours}
                isFrozenView={isFrozenView}
                activeSelectedCount={activeSelectedKeys.length}
                isBatchPending={isBatchPending}
                capValue={capValue}
                onCapValueChange={setCapValue}
                onRunBatch={onBatchAction ? runBatch : null}
                onClearSelection={() => setSelectedKeys([])}
            />

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
                                    {r.es_sabado && <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.5 rounded">Sáb</span>}
                                    {r.es_domingo && <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1 py-0.5 rounded">Dom</span>}
                                    {r.es_dia_compensacion && <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.5 rounded">Comp.</span>}
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
                                {r.horas_extra_calculadas !== 0 ? (
                                    <div>
                                        <span className={`font-bold block ${r.horas_extra_calculadas < 0 ? 'text-rose-700' : 'text-indigo-900'}`}>
                                            {formatDecimalHours(r.horas_extra_calculadas)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal block">({Number(r.horas_extra_calculadas).toFixed(2)} h)</span>
                                    </div>
                                ) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-right bg-indigo-50/50">
                                {r.horas_extra_aprobadas !== 0 || r.horas_extra_avicola > 0 ? (
                                    <div className="flex flex-col items-end">
                                        {r.horas_extra_aprobadas !== 0 && (
                                            <div className="flex items-center justify-end gap-1">
                                                <span className={`font-bold px-2 py-0.5 rounded border ${
                                                    r.horas_extra_aprobadas < 0
                                                        ? 'text-rose-800 bg-rose-50 border-rose-200'
                                                        : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                                }`}>
                                                    {r.horas_extra_aprobadas > 0 ? '+' : ''}{formatDecimalHours(r.horas_extra_aprobadas)}
                                                </span>
                                                {r.es_editado && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Ajustada manualmente" />}
                                            </div>
                                        )}
                                        <span className={`text-[10px] font-normal mt-0.5 flex items-center gap-1 ${r.horas_extra_aprobadas < 0 ? 'text-rose-700/80' : 'text-emerald-700/80'}`}>
                                            {r.horas_extra_aprobadas !== 0 && `(${Number(r.horas_extra_aprobadas).toFixed(2)} h)`}
                                            {r.horas_extra_nocturnas > 0 && (
                                                <span className="inline-flex items-center gap-0.5 px-1 rounded bg-indigo-100 text-indigo-800 font-bold" title={`Nocturnas: ${r.horas_extra_nocturnas}h | Diurnas: ${r.horas_extra_diurnas}h`}>
                                                    <Moon className="w-2.5 h-2.5" />{r.horas_extra_nocturnas}h
                                                </span>
                                            )}
                                            {r.horas_extra_avicola > 0 && (
                                                <span className="inline-flex items-center px-1 rounded bg-amber-100 text-amber-800 font-bold" title="Horas Extra Avícola">
                                                    +{Number(r.horas_extra_avicola).toFixed(1)}h Avíc.
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
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all shadow-sm"
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
