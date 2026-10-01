import { Clock, LogIn, LogOut, Users } from 'lucide-react';

const BiometricSummaryCards = ({ summary = {} }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Marcaciones Hoy</span>
                    <span className="text-2xl font-black text-slate-800">{summary.total_hoy ?? 0}</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Entradas Hoy</span>
                    <span className="text-2xl font-black text-slate-800">{summary.entradas_hoy ?? 0}</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <LogIn className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">Salidas Hoy</span>
                    <span className="text-2xl font-black text-slate-800">{summary.salidas_hoy ?? 0}</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Empleados Activos</span>
                    <span className="text-2xl font-black text-indigo-600">{summary.empleados_activos_hoy ?? 0}</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

export default BiometricSummaryCards;
