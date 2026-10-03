import Money from '../../ui/Money';
import { Loader2 } from 'lucide-react';


const PlanillaTotalsSidebar = ({ model }) => {
    const { sinEmpleado, sueldoQuincActual, ingresosAdicActual, percTotal, calculando, calculo, quincena, otrasDedActual } = model;
    return (<div className="lg:col-span-4">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Resumen del Cálculo</span>
                                    <span className="text-[10px] text-slate-400">Totalizaciones y retenciones de ley</span>
                                </div>

                                <div className="p-4 space-y-4">
                                    {sinEmpleado ? (
                                        <div className="text-slate-300 text-xs italic text-center py-8">
                                            Seleccione un empleado para visualizar el resumen
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Sueldo Quincenal</span>
                                                    <span className="font-semibold text-slate-700"><Money value={sueldoQuincActual} /></span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Ingresos Adicionales</span>
                                                    <span className="font-semibold text-slate-700"><Money value={ingresosAdicActual} /></span>
                                                </div>
                                                <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                        Total Devengado
                                                    </label>
                                                    <div className="text-xl font-black text-indigo-600">
                                                        <Money value={percTotal} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 space-y-2.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    Retenciones y Deducciones
                                                </label>
                                                {calculando ? (
                                                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                                                        <Loader2 size={14} className="animate-spin" /> Calculando retenciones...
                                                    </div>
                                                ) : calculo ? (
                                                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">ISSS {calculo.isss_info?.porcentaje ? `(${calculo.isss_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-rose-600"><Money value={calculo.descuento_isss} /></span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">AFP {calculo.afp_info?.porcentaje ? `(${calculo.afp_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-rose-600"><Money value={calculo.descuento_afp} /></span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">Renta</span>
                                                            {quincena === 'primera' ? (
                                                                <span className="text-[10px] font-semibold text-slate-400 italic">No aplica (1ra quinc.)</span>
                                                            ) : (
                                                                <span className="font-bold text-rose-600"><Money value={calculo.descuento_renta || 0} /></span>
                                                            )}
                                                        </div>
                                                        {((calculo.total_deducciones_cuentas !== undefined ? calculo.total_deducciones_cuentas : otrasDedActual) > 0) && (
                                                            <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-1.5">
                                                                <span className="text-slate-600 font-medium">Otras Deducciones</span>
                                                                <span className="font-bold text-rose-600"><Money value={parseFloat(calculo.total_deducciones_cuentas !== undefined ? calculo.total_deducciones_cuentas : otrasDedActual)} /></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">Sin cálculo disponible</p>
                                                )}
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 space-y-2">
                                                {calculando ? (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Pagar</label>
                                                        <div className="text-slate-300 text-xl font-black mt-1">—</div>
                                                    </div>
                                                ) : calculo ? (
                                                    <>
                                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                                            <span>Total Deducciones</span>
                                                            <span className="font-bold text-rose-600"><Money value={calculo.total_deducciones} /></span>
                                                        </div>
                                                        <div className="border-t border-slate-200 pt-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                                            <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                                                                Neto a Recibir (Total a Pagar)
                                                            </label>
                                                            <div className="text-2xl font-black text-emerald-600 mt-1">
                                                                <Money value={calculo.monto_recibir} />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Pagar</label>
                                                        <div className="text-slate-300 text-xl font-black mt-1">—</div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>);
};
export default PlanillaTotalsSidebar;
