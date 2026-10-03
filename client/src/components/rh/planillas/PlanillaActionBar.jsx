import { CheckCircle, Zap, Lock, ArrowLeft, FileText, ReceiptText } from 'lucide-react';


import { months } from './planillaUtils';
const PlanillaActionBar = ({ model }) => {
    const { handleVolverListado, periodoBloqueado, periodoMes, periodoAnio, quincena, handleVerPlanillaActual, handleVerRecibosActual, esEstePeriodoAbierto, handleCerrarPeriodo, cerrarMutation } = model;
    return (<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleVolverListado}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200 shadow-sm flex items-center justify-center"
                                title="Volver a la lista de planillas"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                                    {periodoBloqueado ? 'Planilla Quincenal' : 'Nueva Planilla Quincenal'}
                                </h2>
                                <p className="text-slate-500 text-xs font-medium">
                                    {months.find(m => m.value === periodoMes)?.label} {periodoAnio} — {quincena === 'primera' ? '1ra Quincena' : '2da Quincena'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {periodoBloqueado && (
                                <button
                                    type="button"
                                    onClick={handleVerPlanillaActual}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition-all shadow-sm active:scale-95"
                                    title="Ver planilla en formato oficial"
                                >
                                    <FileText size={14} />
                                    <span>Ver Planilla</span>
                                </button>
                            )}
                            {periodoBloqueado && (
                                <button
                                    type="button"
                                    onClick={handleVerRecibosActual}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-xl transition-all shadow-sm active:scale-95"
                                    title="Ver recibos de pago masivos"
                                >
                                    <ReceiptText size={14} />
                                    <span>Ver Recibos</span>
                                </button>
                            )}
                            {esEstePeriodoAbierto && model.empleadoData?.totales?.estado !== 'pagada' && (
                                <button
                                    type="button"
                                    onClick={() => handleCerrarPeriodo({ periodo_anio: periodoAnio, periodo_mes: periodoMes, quincena })}
                                    disabled={cerrarMutation.isPending}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                    title="Cerrar este período (Marcar como pagada)"
                                >
                                    <Lock size={14} />
                                    <span>{cerrarMutation.isPending ? 'Cerrando...' : 'Cerrar Período'}</span>
                                </button>
                            )}
                            {periodoBloqueado ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-xl">
                                    <CheckCircle size={14} /> Período Generado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
                                    <Zap size={14} /> Pendiente de Generar
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleVolverListado}
                                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                Volver al Listado
                            </button>
                        </div>
                    </div>);
};
export default PlanillaActionBar;
