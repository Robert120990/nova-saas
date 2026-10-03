import Money from '../../ui/Money';
import Table from '../../ui/Table';
import Pagination from '../../ui/Pagination';
import { Plus, Edit, Trash2, Lock, FileText, ReceiptText, AlertCircle } from 'lucide-react';


import { years, months } from '../planillas/planillaUtils';
const PlanillasHistoryTab = ({ model }) => {
    const { handleNuevaPlanillaClick, tieneAbiertas, primeraAbierta, handleVerDetalle, handleCerrarPeriodo, filterAnio, setFilterAnio, setPage, filterMes, setFilterMes, filterQuincena, setFilterQuincena, items, isLoading, handleEliminarPeriodo, setExportModalConfig, page, response } = model;
    return (<>
                    {/* Header List View */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900">Planillas</h2>
                            <p className="text-slate-500 text-xs font-medium">Gestión y control de planillas quincenales</p>
                        </div>
                        <button
                            onClick={handleNuevaPlanillaClick}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
                                tieneAbiertas
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300 shadow-none cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            }`}
                            title={tieneAbiertas ? "Hay una planilla abierta pendiente de cierre" : "Crear nueva planilla"}
                        >
                            <Plus size={18} />
                            <span>Nueva Planilla</span>
                        </button>
                    </div>

                    {/* Open Payroll Alert Banner */}
                    {tieneAbiertas && primeraAbierta && (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
                            <div className="flex items-start sm:items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-900">
                                        Existe una planilla abierta pendiente de pago
                                    </p>
                                    <p className="text-xs text-amber-700">
                                        Período: <span className="font-semibold">{months.find(m => m.value === primeraAbierta.periodo_mes)?.label} {primeraAbierta.periodo_anio} ({primeraAbierta.quincena === 'primera' ? '1ra Quincena' : '2da Quincena'})</span> — {primeraAbierta.total_empleados} empleado(s). Para crear una nueva planilla, debe cerrar o eliminar este período abierto.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleVerDetalle(primeraAbierta)}
                                    className="px-3 py-1.5 text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl transition-colors"
                                >
                                    Ver Planilla Abierta
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCerrarPeriodo(primeraAbierta)}
                                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Lock size={13} />
                                    <span>Cerrar Período</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Año</label>
                            <select
                                value={filterAnio}
                                onChange={e => { setFilterAnio(parseInt(e.target.value)); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Mes</label>
                            <select
                                value={filterMes}
                                onChange={e => { setFilterMes(parseInt(e.target.value)); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Todos</option>
                                {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quincena</label>
                            <select
                                value={filterQuincena}
                                onChange={e => { setFilterQuincena(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Todas</option>
                                <option value="primera">Primera</option>
                                <option value="segunda">Segunda</option>
                            </select>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table
                            headers={['Periodo', 'Q', '# Emp', 'Sueldo Quinc.', 'Ing. Adic.', 'Total Dev.', 'ISSS', 'AFP', 'Renta', 'Ded.', 'Neto', 'Estado', 'Acciones']}
                            data={items}
                            isLoading={isLoading}
                            renderRow={(item) => (
                                <tr key={`${item.periodo_anio}-${item.periodo_mes}-${item.quincena}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2">
                                        <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_anio}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.quincena === 'primera' ? '1ra' : '2da'}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs font-bold text-slate-800">{item.total_empleados}</span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700 font-medium"><Money value={parseFloat(item.total_sueldos_quincenal || (parseFloat(item.total_sueldos || 0) / 2))} /></td>
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-600"><Money value={parseFloat(item.total_ingresos_adic || 0)} /></td>
                                    <td className="px-3 py-2 text-xs font-bold text-indigo-600"><Money value={parseFloat(item.total_percepciones || 0)} /></td>
                                    <td className="px-3 py-2 text-xs text-slate-600"><Money value={parseFloat(item.total_isss || 0)} /></td>
                                    <td className="px-3 py-2 text-xs text-slate-600"><Money value={parseFloat(item.total_afp || 0)} /></td>
                                    <td className="px-3 py-2 text-xs text-slate-600"><Money value={parseFloat(item.total_renta || 0)} /></td>
                                    <td className="px-3 py-2 text-xs font-bold text-red-600"><Money value={parseFloat(item.total_deducciones || 0)} /></td>
                                    <td className="px-3 py-2 text-xs font-bold text-emerald-600"><Money value={parseFloat(item.total_neto || 0)} /></td>
                                    <td className="px-3 py-2">{item.total_pagadas === item.total_empleados ? <span className="text-emerald-700 text-xs font-bold">Pagada</span> : <span className="text-amber-700 text-xs font-bold">Pendiente</span>}</td>
                                    <td className="px-3 py-2 flex items-center gap-1">
                                        <button
                                            onClick={() => handleVerDetalle(item)}
                                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar planilla"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminarPeriodo(item)}
                                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar período"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleCerrarPeriodo(item)}
                                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Cerrar período (Marcar pagada)"
                                        >
                                            <Lock size={16} />
                                        </button>
                                        <span className="w-px h-4 bg-slate-200 mx-0.5" />
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'planilla' })}
                                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Ver Planilla Oficial (PDF)"
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'recibos' })}
                                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                            title="Ver Recibos Masivos (PDF)"
                                        >
                                            <ReceiptText size={16} />
                                        </button>
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'csv' })}
                                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                            title="Exportar archivo bancario (CSV / TXT)"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            )}
                        />
                    </div>

                    <Pagination
                        currentPage={page}
                        totalPages={response.totalPages}
                        totalItems={response.total}
                        onPageChange={setPage}
                        itemsOnPage={items.length}
                        isLoading={isLoading}
                    />
                </>);
};
export default PlanillasHistoryTab;
