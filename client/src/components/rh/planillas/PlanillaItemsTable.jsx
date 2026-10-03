import Money, { MoneyInput } from '../../ui/Money';
import { Users, Loader2, Save } from 'lucide-react';


import { calcularTarifaDetalle } from './planillaUtils';
const PlanillaItemsTable = ({ model }) => {
    const { autoSaveRef, empleadoData, saveCurrentEmployee, guardandoManual, savingRef, sinEmpleado, detalles, handleValorChange } = model;
    return (<div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Cuentas de Planilla</span>
                                    <span className="text-[10px] text-slate-400">Conceptos de percepciones y deducciones</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {autoSaveRef.current && (
                                        <span className="text-[10px] text-indigo-600 font-medium animate-pulse">Guardando cambios...</span>
                                    )}
                                    {empleadoData?.id && (
                                        <button
                                            type="button"
                                            onClick={() => saveCurrentEmployee({ silent: false }).catch(() => {})}
                                            disabled={guardandoManual || savingRef.current}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                            title="Guardar manualmente los cambios de este empleado"
                                        >
                                            <Save size={13} className={guardandoManual ? 'animate-spin' : ''} />
                                            <span>{guardandoManual ? 'Guardando...' : 'Guardar Cambios'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                {sinEmpleado ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-slate-300 text-xs italic gap-1.5">
                                        <Users size={28} className="opacity-30" />
                                        <span>Seleccione un empleado para ver y editar sus cuentas</span>
                                    </div>
                                ) : detalles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-1.5">
                                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                                        <span>Cargando cuentas de planilla...</span>
                                    </div>
                                ) : (
                                    <table className="table-cards w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase">
                                                <th className="text-left px-3 py-1.5 w-12">Cód.</th>
                                                <th className="text-left px-3 py-1.5">Descripción</th>
                                                <th className="text-center px-2 py-1.5 w-16">Operación</th>
                                                <th className="text-center px-2 py-1.5 w-16">Tipo</th>
                                                <th className="text-right px-3 py-1.5 w-32">Cant. / Base</th>
                                                <th className="text-right px-3 py-1.5 w-28">Total ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(Array.isArray(detalles) ? detalles : []).map((d, i) => (
                                                <tr key={i} className={`hover:bg-slate-50/70 transition-colors ${d.operacion === 'sumar' ? '' : 'bg-red-50/15'}`}>
                                                    <td data-label="Cód." className="px-3 py-1 font-bold font-mono text-slate-700">{d.codigo}</td>
                                                    <td data-label="Descripción" className="px-3 py-1 text-slate-700 font-medium text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{d.descripcion}</span>
                                                            {(d.codigo === '07' || (d.descripcion || '').toUpperCase().includes('COMISION')) && parseFloat(d.valor_ingresado || d.cantidad || 0) > 0 && (
                                                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded text-[9px] font-bold tracking-tight" title="Tope reglamentario máximo: $1,000.00">
                                                                    Tope $1K
                                                                </span>
                                                            )}
                                                        </div>
                                                        {d.tipo_valor === 'horas' && empleadoData?.sueldo_base && (
                                                            <div className="text-[10px] text-slate-400 font-normal">
                                                                Tarifa: <Money value={calcularTarifaDetalle(d, empleadoData.sueldo_base)} />/hr
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td data-label="Operación" className="px-2 py-1 text-center">
                                                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                            d.operacion === 'sumar' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                                                        }`}>
                                                            {d.operacion === 'sumar' ? '+ Suma' : '− Resta'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Tipo" className="px-2 py-1 text-center">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                                                            {d.tipo_valor}
                                                        </span>
                                                    </td>
                                                    <td data-label="Cant. / Base" className="px-3 py-1 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {d.tipo_valor === 'valor' ? (
                                                                <MoneyInput
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={d.cantidad !== undefined ? d.cantidad : ''}
                                                                    onChange={e => handleValorChange(i, e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full max-w-[80px] px-2 py-0.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-right shadow-sm"
                                                                />
                                                            ) : (
                                                                <input
                                                                    type="number"
                                                                    step={d.tipo_valor === 'dias' ? '1' : (d.tipo_valor === 'horas' ? '0.5' : '0.01')}
                                                                    min="0"
                                                                    value={d.cantidad !== undefined ? d.cantidad : ''}
                                                                    onChange={e => handleValorChange(i, e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full max-w-[80px] px-2 py-0.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-right shadow-sm"
                                                                />
                                                            )}
                                                            <span className="text-[10px] text-slate-400 font-medium w-7 text-left">
                                                                {d.tipo_valor === 'horas' ? 'hrs' : (d.tipo_valor === 'dias' ? 'días' : (d.tipo_valor === 'porcentaje' ? '%' : '$'))}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td data-label="Total" className="px-3 py-1 text-right font-bold text-slate-900 text-xs">
                                                        <span className={d.operacion === 'sumar' ? 'text-slate-900' : 'text-rose-600'}>
                                                            <Money value={parseFloat(d.valor_ingresado || 0)} />
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>);
};
export default PlanillaItemsTable;
