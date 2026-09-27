import {
    Search,
    ShieldCheck,
    FlaskConical,
    Calculator,
    SlidersHorizontal
} from 'lucide-react';


export default function TraceabilityHeader({ model }) {
    const { activeTab, setActiveTab, companyInfo } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 text-teal-600">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Trazabilidad de Lotes, Calidad & COA</h1>
                            {companyInfo && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {companyInfo.razon_social}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Control de calidad LAB-004, parametrización de normas, emisión de COA individual y despacho unificado</p>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                        onClick={() => setActiveTab('trace')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'trace' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Search size={14} />
                        Trazabilidad de Lotes
                    </button>
                    <button
                        onClick={() => setActiveTab('lab')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'lab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <FlaskConical size={14} />
                        Control de Calidad (LAB-004)
                    </button>
                    <button
                        onClick={() => setActiveTab('params')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'params' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <SlidersHorizontal size={14} />
                        Parámetros & Normas COA
                    </button>
                    <button
                        onClick={() => setActiveTab('solids')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'solids' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Calculator size={14} />
                        Calculadora de Sólidos HE+
                    </button>
                </div>
            </div>);
}
