import {
    Calculator
} from 'lucide-react';


export default function CostsMaintenanceHeader({ model }) {
    const { navigate } = model;

    return (<div className="bg-gradient-to-r from-emerald-50 via-white to-indigo-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                                Oficial ANDELSA
                            </span>
                            <span className="text-xs font-bold text-slate-900">Módulo de Costeo por Libra de Ovoproductos</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Simulador financiero: Costeo de Huevo Entero, Plus, Clara, Yema, Químicos CIP y Acuerdos Comerciales por Cliente.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/industrial/costeo-libra')}
                    className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    Abrir Costeo por Libra &rarr;
                </button>
            </div>);
}
