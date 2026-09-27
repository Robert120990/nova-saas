import useMoneyFormatter from '../../../../hooks/useMoneyFormatter';


import {
    Plus,
    Trash2,
    HelpCircle,
    RefreshCw,
    DollarSign,
    Sparkles,
    Info
} from 'lucide-react';


export default function ConfigCostsTab({ model }) {
    const formatMoney = useMoneyFormatter();
    const { activeTab, costConcepts, setCostConcepts, loading, newConcept, setNewConcept, setHelpConceptModal, handleAddConcept, handleUpdateConcept, handleDeleteConcept, handleOpenSyncModal } = model;

    return (<>{activeTab === 'costs' && (
                <div className="space-y-6">
                    {/* Banner de Sincronización Automática con Planillas y Gastos */}
                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold tracking-wide uppercase">
                                <Sparkles size={12} className="text-amber-300" />
                                Sin Datos Quemados • Integración Contable Real
                            </div>
                            <h2 className="text-lg font-bold tracking-tight">Carga Automática de Planillas de Nómina y Gastos Operativos</h2>
                            <p className="text-xs text-indigo-100/90 leading-relaxed font-normal">
                                Extrae en tiempo real los salarios reales del módulo de RRHH y las compras/gastos indirectos de fabricación (electricidad, gas, químicos CIP, depreciación) para prorratearlos exactamente entre los lotes proyectados del mes.
                            </p>
                        </div>
                        <button
                            onClick={handleOpenSyncModal}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 border border-emerald-400/40"
                        >
                            <RefreshCw size={15} />
                            Cargar desde Planillas RRHH y Gastos Operativos
                        </button>
                    </div>

                    {/* Contenedor de Conceptos de Costo con Ayuda Interactiva */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-indigo-600" />
                                    Conceptos de Costos Fijos y Operativos de Planta
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Valores cargados automáticamente al costear cada lote de huevo líquido. Haga clic en el icono <span className="font-bold text-indigo-600">(?)</span> de cualquier concepto para conocer su origen y fórmula.
                                </p>
                            </div>
                            <button
                                onClick={() => setHelpConceptModal({
                                    concept_name: 'Guía General de Costeo de Planta',
                                    description: 'Los costos fijos y operativos representan todos los egresos indispensables para mantener en marcha la planta de pasteurizado ANDELSA, excluyendo el huevo cáscara (materia prima directa).',
                                    how_to_complete: 'Se complementan a partir de dos fuentes reales del sistema: (1) Las planillas de pago procesadas en el módulo de RRHH para operarios de planta, y (2) Los gastos registrados en contabilidad para servicios industriales (electricidad trifásica, gas GLP de calderas, agua potable, sanitizantes de ácido peracético, mantenimiento).',
                                    formula: 'Costo por Lote ($) = (Total Planillas Mensuales + Gastos Operativos Mensuales) / Lotes Estimados en el Mes.',
                                    example: 'Si la nómina mensual es de $6,428.80 y los gastos operativos son $1,200.00 (Total = $7,628.80), y se programan 20 lotes al mes, el costo asignado a cada lote es exactamente $381.44.',
                                    per_pound_impact: 'Al dividir el costo del lote entre las libras producidas (ej: 14,000 lbs de huevo líquido), el impacto es de aproximadamente $0.027 por cada libra producida.'
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all w-fit shadow-xs"
                            >
                                <HelpCircle size={14} />
                                ¿Cómo se calculan y complementan estos espacios?
                            </button>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {loading ? (
                            <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando conceptos de costo...</div>
                        ) : (
                            <div className="space-y-3">
                                {costConcepts.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Info size={24} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No hay conceptos de costo configurados.</p>
                                        <p className="text-[11px] text-slate-500 mt-1">Haga clic en el botón superior para cargar automáticamente desde planillas y gastos o agregue conceptos manualmente abajo.</p>
                                    </div>
                                ) : (
                                    (Array.isArray(costConcepts) ? costConcepts : []).map(c => (
                                        <div key={c.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 rounded-xl p-3 hover:bg-slate-50/90 transition-all">
                                            {/* Concept Name */}
                                            <input
                                                type="text"
                                                value={c.concept_name}
                                                onChange={(e) => {
                                                    setCostConcepts(prev => (Array.isArray(prev) ? prev : []).map(x => x.id === c.id ? { ...x, concept_name: e.target.value } : x));
                                                    handleUpdateConcept(c.id, 'concept_name', e.target.value);
                                                }}
                                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            />

                                            {/* Value per Batch */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-32">
                                                    <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={c.default_value}
                                                        onChange={(e) => {
                                                            setCostConcepts(prev => (Array.isArray(prev) ? prev : []).map(x => x.id === c.id ? { ...x, default_value: e.target.value } : x));
                                                        }}
                                                        onBlur={(e) => handleUpdateConcept(c.id, 'default_value', e.target.value)}
                                                        className="w-full pl-6 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                                                        step="0.01"
                                                    />
                                                </div>

                                                {/* Interactive (?) Help Button */}
                                                <button
                                                    onClick={() => setHelpConceptModal({
                                                        concept_name: c.concept_name,
                                                        description: `Representa el concepto de costo operativo [${c.concept_name}] asignado de forma fija o semivariable a cada lote de pasteurización.`,
                                                        how_to_complete: c.concept_name.toLowerCase().includes('planilla') || c.concept_name.toLowerCase().includes('mano de obra')
                                                            ? 'Este espacio se complementa tomando el sueldo base y bonificaciones fijas devengadas por los empleados operativos de planta registrados en la nómina de RRHH, dividido entre el número de lotes mensuales.'
                                                            : 'Este espacio se complementa calculando el gasto mensual registrado en facturas de compras y gastos (energía, insumos, mantenimiento, sanitización) dividido entre la cantidad de lotes producidos al mes.',
                                                        formula: `Costo del Concepto por Lote ($) = Monto Mensual Total ($) / Lotes Estimados en el Mes`,
                                                        example: `Si el gasto mensual en ${c.concept_name} es de ${formatMoney(parseFloat(c.default_value || 0) * 20, 2)}, al procesar 20 lotes en el mes se le carga a cada corrida de producción un valor de ${formatMoney(parseFloat(c.default_value || 0), 2)}.`,
                                                        per_pound_impact: `En una corrida típica de 15,000 libras de producto líquido terminado, este concepto añade aproximadamente ${formatMoney((parseFloat(c.default_value || 0) || 0) / 15000, 4)} por cada libra producida.`
                                                    })}
                                                    className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors shadow-xs"
                                                    title="¿Cómo se complementa este concepto?"
                                                >
                                                    <HelpCircle size={15} />
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDeleteConcept(c.id)}
                                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Eliminar concepto"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Agregar Nuevo Concepto */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3 mt-4">
                                    <input
                                        type="text"
                                        value={newConcept.concept_name}
                                        onChange={(e) => setNewConcept({ ...newConcept, concept_name: e.target.value })}
                                        placeholder="Nombre de nuevo concepto (ej: Insumos de Sanitización CIP, Mantenimiento Preventivo)..."
                                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 shadow-xs"
                                    />
                                    <div className="relative w-full sm:w-32">
                                        <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={newConcept.default_value}
                                            onChange={(e) => setNewConcept({ ...newConcept, default_value: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-6 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            step="0.01"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddConcept}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0"
                                    >
                                        <Plus size={14} /> Agregar Concepto
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}</>);
}
