import {
    Search,
    Plus,
    Edit,
    SlidersHorizontal,
    Trash2
} from 'lucide-react';


export default function TraceabilityParamsTab({ model }) {
    const { activeTab, paramFilterProduct, setParamFilterProduct, paramSearch, setParamSearch, handleOpenCreateParam, handleOpenEditParam, handleDeleteParam, filteredParameters, availableForms } = model;

    return (<>{activeTab === 'params' && (
                <div className="space-y-6">
                    {/* Top control card */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                                Parametrización de Control de Calidad & Formas de Ovoproductos
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Defina normas, límites permisibles y ensayos para cada forma o presentación (Huevo Entero, Clara, Yema o Formulado)</p>
                        </div>
                        <button
                            onClick={handleOpenCreateParam}
                            className="w-full sm:w-auto justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            <Plus size={14} />
                            Nuevo Parámetro de Calidad
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none max-w-full w-full sm:w-auto pb-1 sm:pb-0">
                            <span className="text-xs font-bold text-slate-500 uppercase shrink-0">Forma / Producto:</span>
                            {(Array.isArray(availableForms) ? availableForms : []).map(formKey => (
                                <button
                                    key={formKey}
                                    onClick={() => setParamFilterProduct(formKey)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${paramFilterProduct === formKey ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {formKey}
                                </button>
                            ))}
                        </div>
                        <div className="w-full sm:w-64 relative">
                            <input
                                type="text"
                                value={paramSearch}
                                onChange={(e) => setParamSearch(e.target.value)}
                                placeholder="Buscar parámetro o norma..."
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                    </div>

                    {/* Tables Grouped by Category */}
                    <div className="space-y-6">
                        {(Array.isArray(['microbiologico', 'fisicoquimico', 'organoleptico', 'otro']) ? ['microbiologico', 'fisicoquimico', 'organoleptico', 'otro'] : []).map(cat => {
                            const catParams = filteredParameters.filter(p => p.category === cat);
                            if (catParams.length === 0) return null;

                            const catTitles = {
                                microbiologico: { label: 'Ensayos Microbiológicos (Inocuidad & Patógenos)', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                                fisicoquimico: { label: 'Parámetros Físico-Químicos (Sólidos, pH, Densidad)', color: 'text-teal-700 bg-teal-50 border-teal-200' },
                                organoleptico: { label: 'Criterios Organolépticos / Sensoriales', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                                otro: { label: 'Otros Ensayos y Requisitos Específicos', color: 'text-slate-700 bg-slate-50 border-slate-200' }
                            };

                            return (
                                <div key={cat} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catTitles[cat].color}`}>
                                                {catTitles[cat].label}
                                            </span>
                                            <span className="text-slate-400 font-normal">({catParams.length} parámetros)</span>
                                        </h3>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="p-2.5 w-12 text-center">Orden</th>
                                                    <th className="p-2.5">Parámetro / Ensayo</th>
                                                    <th className="p-2.5">Especificación / Límite Normativo</th>
                                                    <th className="p-2.5">Lectura Típica</th>
                                                    <th className="p-2.5">Unidad</th>
                                                    <th className="p-2.5">Forma / Producto</th>
                                                    <th className="p-2.5">Criterio</th>
                                                    <th className="p-2.5 text-center">Estado</th>
                                                    <th className="p-2.5 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {(Array.isArray(catParams) ? catParams : []).map(param => (
                                                    <tr key={param.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="p-2.5 text-center font-bold text-slate-500">{param.sort_order}</td>
                                                        <td className="p-2.5 font-bold text-slate-900">{param.parameter_name}</td>
                                                        <td className="p-2.5 font-medium text-slate-700">{param.specification}</td>
                                                        <td className="p-2.5 font-semibold text-teal-700">{param.default_value || '-'}</td>
                                                        <td className="p-2.5 text-slate-500">{param.unit || '-'}</td>
                                                        <td className="p-2.5">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                                                {param.applicable_product}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 font-semibold text-emerald-700">{param.expected_criterion || 'CONFORME'}</td>
                                                        <td className="p-2.5 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${param.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                                {param.is_active ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleOpenEditParam(param)}
                                                                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                    title="Editar parámetro"
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteParam(param.id)}
                                                                    className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Eliminar parámetro"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}</>);
}
