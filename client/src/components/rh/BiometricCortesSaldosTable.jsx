import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Truck, Factory, Egg, History, ArrowRightCircle } from 'lucide-react';
import Table from '../ui/Table';
import { formatDate, formatDecimalHours } from '../../utils/dateUtils';

const fmtSigned = (val) => {
    const n = Number(val || 0);
    if (n === 0) return '0.0 h';
    return `${n > 0 ? '+' : ''}${n.toFixed(1)} h`;
};

const BiometricCortesSaldosTable = ({
    employeeSummaries = [],
    summary = {},
    previousCorte = null,
    rules = {},
    selectedEmployeeKey = '',
    onSelectEmployee
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const list = Array.isArray(employeeSummaries) ? employeeSummaries : [];
    if (list.length === 0) return null;

    const totProd = Number(summary.total_horas_extra_produccion || 0);
    const totTransp = Number(summary.total_horas_extra_transporte || 0);
    const totAvicola = Number(summary.total_horas_extra_avicola || 0);
    const totPend = Number(summary.total_horas_pendientes_aplicadas || 0);
    const totPagables = Number(summary.total_horas_extra_pagables ?? summary.total_horas_extra_aprobadas ?? 0);
    const totArrastre = Number(summary.total_saldo_arrastre_siguiente || 0);

    const headers = [
        { label: 'Colaborador', sortKey: 'nombre', sortType: 'string' },
        { label: 'Área / Grupo', sortKey: 'area', sortType: 'string' },
        { label: 'Jornada', sortKey: 'horas_jornada_base', sortType: 'number', className: 'text-center' },
        { label: 'H.E. Período', sortKey: 'horas_extra_periodo', sortType: 'number', className: 'text-right' },
        { label: 'H. Pendientes', sortKey: 'horas_pendientes_anteriores', sortType: 'number', className: 'text-right' },
        ...(totAvicola > 0 ? [{ label: 'Avícola', sortKey: 'horas_extra_avicola', sortType: 'number', className: 'text-right' }] : []),
        { label: 'Saldo Neto', sortKey: 'saldo_neto', sortType: 'number', className: 'text-right' },
        { label: 'Pagables Planilla', sortKey: 'horas_pagables', sortType: 'number', className: 'text-right' },
        { label: 'Arrastre Sig.', sortKey: 'saldo_arrastre_siguiente', sortType: 'number', className: 'text-right' }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-800">
                            Consolidado por Colaborador y Arrastre de Saldos
                        </h3>
                        {rules?.compensar_sabado && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                44h Sem. (Sáb -{rules.horas_jornada_sabado || 4}h)
                            </span>
                        )}
                        {rules?.redondeo_horas_extra_minutos > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Redondeo {rules.redondeo_horas_extra_minutos}m (umbral {rules.umbral_redondeo_minutos || 15}m)
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {previousCorte
                            ? `Arrastre tomado de "${previousCorte.nombre}" (${formatDate(previousCorte.fecha_fin)}). Haga clic en un colaborador para filtrar su detalle diario.`
                            : 'Haga clic en un colaborador para filtrar su detalle diario abajo.'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setCollapsed(v => !v)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl self-start sm:self-center"
                >
                    {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    <span>{collapsed ? `Mostrar (${list.length})` : 'Ocultar'}</span>
                </button>
            </div>

            {/* Tarjetas resumen por categoría */}
            <div className="p-3.5 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Factory className="w-3 h-3 text-indigo-500" /> Producción (Neto)
                    </span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${totProd < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {fmtSigned(totProd)}
                    </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Truck className="w-3 h-3 text-sky-500" /> Transporte
                    </span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${totTransp < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {fmtSigned(totTransp)}
                    </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <History className="w-3 h-3 text-amber-500" /> H. Pendientes Ant.
                    </span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${totPend < 0 ? 'text-rose-600' : totPend > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {fmtSigned(totPend)}
                    </span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Pagables Planilla</span>
                    <span className="text-sm font-black font-mono text-emerald-800 mt-0.5 block">
                        +{totPagables.toFixed(1)} h
                    </span>
                </div>
                <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-200/80">
                    <span className="text-[10px] font-bold text-rose-700 uppercase flex items-center gap-1">
                        <ArrowRightCircle className="w-3 h-3" /> Arrastre Sig.
                    </span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${totArrastre < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                        {totArrastre < 0 ? `${totArrastre.toFixed(1)} h` : '0.0 h'}
                    </span>
                </div>
                <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <span className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1">
                        <Egg className="w-3 h-3" /> Extra Avícola
                    </span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${totAvicola > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                        {totAvicola > 0 ? `+${totAvicola.toFixed(1)} h` : '0.0 h'}
                    </span>
                </div>
            </div>

            {!collapsed && (
                <Table
                    headers={headers}
                    data={list}
                    emptyMessage="No hay saldos consolidados en este rango."
                    renderRow={(emp) => {
                        const isSelected = selectedEmployeeKey === emp.employee_key;
                        return (
                            <tr
                                key={emp.employee_key}
                                onClick={() => onSelectEmployee && onSelectEmployee(isSelected ? '' : emp.employee_key, isSelected ? null : emp)}
                                className={`cursor-pointer transition-colors text-xs ${
                                    isSelected ? 'bg-indigo-50/90 font-semibold' : 'hover:bg-slate-50/90'
                                }`}
                            >
                                <td className="py-2.5 px-3">
                                    <span className="font-bold text-slate-800 block">{emp.nombre}</span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                        [{emp.codigo}] · {emp.dias_registrados} días{emp.sabados_compensados > 0 ? ` (${emp.sabados_compensados} sáb comp.)` : ''}
                                    </span>
                                </td>
                                <td className="py-2.5 px-3">
                                    <span className="font-semibold text-slate-700 block">{emp.area}</span>
                                    <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 ${
                                        emp.categoria === 'transporte'
                                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}>
                                        {emp.categoria === 'transporte' ? 'Transporte' : 'Producción'}
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                    {Number(emp.horas_jornada_base || 9).toFixed(0)}h
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-semibold ${emp.horas_extra_periodo < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {fmtSigned(emp.horas_extra_periodo)}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                                    emp.horas_pendientes_anteriores < 0 ? 'text-rose-600' : emp.horas_pendientes_anteriores > 0 ? 'text-emerald-700' : 'text-slate-300'
                                }`}>
                                    {emp.horas_pendientes_anteriores !== 0 ? fmtSigned(emp.horas_pendientes_anteriores) : '—'}
                                </td>
                                {totAvicola > 0 && (
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                        {emp.horas_extra_avicola > 0 ? `+${emp.horas_extra_avicola.toFixed(1)} h` : <span className="text-slate-300">—</span>}
                                    </td>
                                )}
                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                                    emp.saldo_neto < 0 ? 'text-rose-700' : emp.saldo_neto > 0 ? 'text-indigo-900' : 'text-slate-400'
                                }`}>
                                    {fmtSigned(emp.saldo_neto)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono bg-emerald-50/40">
                                    {emp.horas_pagables > 0 ? (
                                        <div>
                                            <span className="font-black text-emerald-700 block">+{emp.horas_pagables.toFixed(1)} h</span>
                                            <span className="text-[10px] text-emerald-600/80 block">{formatDecimalHours(emp.horas_pagables, { short: true })}</span>
                                        </div>
                                    ) : <span className="text-slate-300">0.0 h</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                    {emp.saldo_arrastre_siguiente < 0 ? (
                                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                            {emp.saldo_arrastre_siguiente.toFixed(1)} h
                                        </span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                            </tr>
                        );
                    }}
                />
            )}
        </div>
    );
};

export default BiometricCortesSaldosTable;
