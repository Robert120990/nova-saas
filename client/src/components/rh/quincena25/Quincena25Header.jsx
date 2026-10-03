import { Sparkles } from 'lucide-react';
import Money from '../../ui/Money';

const Quincena25Header = ({ model }) => {
    const { selectedYear, tabActiva, setTabActiva } = model;
    return (
        <>
            {/* Header Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Quincena 25 (Planilla 25)</h1>
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Decreto Legislativo Nº 499
                            </span>
                            {selectedYear >= 2027 ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Obligatorio 2027
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Incentivo Fiscal 2026
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Prestación económica extraordinaria anual del 50 % de salario mensual para empleados con sueldo nominal menor o igual a <Money value={1500} />.
                        </p>
                    </div>
                </div>
            
                {/* Switch de Vistas */}
                <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setTabActiva('gestion')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tabActiva === 'gestion'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Gestión Actual
                    </button>
                    <button
                        onClick={() => setTabActiva('historial')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tabActiva === 'historial'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Historial Anual
                    </button>
                </div>
            </div>
        </>
    );
};

export default Quincena25Header;
