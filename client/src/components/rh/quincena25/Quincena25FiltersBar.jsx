import { Calculator } from 'lucide-react';

const Quincena25FiltersBar = ({ model }) => {
    const { selectedYear, selectedDepto, selectedBranch, isCalculating, departamentos, branches, esPagada, handleCalcular, availableYears, contextBusy, setFilter } = model;
    return (
        <>
            {/* Barra de Filtros y Control de Período */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                    {/* Selector de Año */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Ejercicio Fiscal
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setFilter('year', parseInt(e.target.value));
                            }}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {(Array.isArray(availableYears) ? availableYears : []).map(yr => (
                                <option key={yr} value={yr}>
                                    {yr} {yr >= 2027 ? '(Obligatorio)' : '(Voluntario)'}
                                </option>
                            ))}
                        </select>
                    </div>
            
                    {/* Selector de Departamento */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Departamento
                        </label>
                        <select
                            value={selectedDepto}
                            onChange={(e) => {
                                setFilter('department', e.target.value);
                            }}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Todos los Departamentos</option>
                            {(Array.isArray(departamentos) ? departamentos : []).map(d => (
                                <option key={d.id} value={d.id}>{d.descripcion}</option>
                            ))}
                        </select>
                    </div>
            
                    {/* Selector de Sucursal */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Sucursal
                        </label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => {
                                setFilter('branch', e.target.value);
                            }}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Todas las Sucursales</option>
                            {(Array.isArray(branches) ? branches : []).map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
            
                {/* Botón de Cálculo / Simulación */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={handleCalcular}
                        disabled={contextBusy || esPagada}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                            esPagada
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                        }`}
                    >
                        <Calculator size={15} />
                        {isCalculating ? 'Calculando...' : 'Calcular Quincena 25'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default Quincena25FiltersBar;
