import { Sparkles, Lock, Unlock, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

const Quincena25SummaryCards = ({ model }) => {
    const { itemsActuales, esPagada, fechaPago, metricas } = model;
    return (
        <>
            {/* Tarjetas de Métricas Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tarjeta 1: Total Planilla */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total a Dispersar</p>
                        <h3 className="text-xl font-black text-indigo-700 mt-1">
                            <Money value={metricas.totalMonto} />
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {metricas.totalConPago} empleados con pago
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Sparkles size={20} />
                    </div>
                </div>
            
                {/* Tarjeta 2: Elegibles */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Elegibles (≤ <Money value={1500} />)</p>
                        <h3 className="text-xl font-black text-emerald-700 mt-1">
                            {metricas.totalElegibles} <span className="text-xs font-medium text-slate-500">/ {metricas.totalEmpleados}</span>
                        </h3>
                        <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                            {metricas.totalProporcionales} proporcionales (&lt;1 año)
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShieldCheck size={20} />
                    </div>
                </div>
            
                {/* Tarjeta 3: Excluidos por Ley */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Excluidos (&gt; <Money value={1500} />)</p>
                        <h3 className="text-xl font-black text-amber-600 mt-1">
                            {metricas.totalExcluidos}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Techo salarial según Art. 1 D.L. 499
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={20} />
                    </div>
                </div>
            
                {/* Tarjeta 4: Estado del Período */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado Período</p>
                        <div className="mt-1 flex items-center gap-2">
                            {esPagada ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                    <CheckCircle2 size={13} />
                                    Pagada
                                </span>
                            ) : itemsActuales.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                    <Clock size={13} />
                                    Borrador
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                    Sin calcular
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {fechaPago ? `Pagada el ${formatDate(fechaPago)}` : 'Pago: 15-25 enero'}
                        </p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        esPagada ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {esPagada ? <Lock size={20} /> : <Unlock size={20} />}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Quincena25SummaryCards;
