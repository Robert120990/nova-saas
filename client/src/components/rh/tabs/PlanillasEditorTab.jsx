import { PlanillaActionBar, PlanillaHeader, PlanillaEmployeeHeader, PlanillaItemsTable, PlanillaTotalsSidebar } from '../planillas';
import { AlertCircle } from 'lucide-react';


import { months } from '../planillas/planillaUtils';
const PlanillasEditorTab = ({ model }) => {
    const { hayOtraAbierta, otraAbiertaItem, handleVerDetalle, loadingEmployee, saveError, unsaved, guardandoManual, sincronizarMutation, syncingHuevo, generando, cerrarMutation, excluirMutation } = model;
    const busy = loadingEmployee || sincronizarMutation.isPending || syncingHuevo || generando || cerrarMutation.isPending || excluirMutation.isPending;
    const closed = model.empleadoData?.totales?.estado === 'pagada';
    return (<div className="space-y-4">
        {saveError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{saveError} Los cambios pendientes se conservan en este navegador. {model.hasConflict && <button type="button" onClick={model.reviewConflict} className="font-bold underline ml-2">Revisar datos guardados</button>}</div>}
        {loadingEmployee && <p role="status" className="text-sm text-indigo-700">Cargando empleado...</p>}
        {unsaved && !guardandoManual && !saveError && <p role="status" className="text-xs text-amber-700">Cambios pendientes de guardar</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-4">
                    {/* Form Top Navigation Bar */}
                    <PlanillaActionBar model={model} />
                    {closed && <p className="text-sm text-slate-600">Planilla cerrada. Los datos están disponibles para consulta.</p>}
                    <fieldset disabled={closed} className="min-w-0 space-y-4">

                    {/* Blocking Warning Banner if another period is open */}
                    {hayOtraAbierta && otraAbiertaItem && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
                            <div className="flex items-start sm:items-center gap-3">
                                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-rose-900">
                                        Bloqueo de creación de planilla
                                    </p>
                                    <p className="text-xs text-rose-700">
                                        No puede generar ni registrar empleados para este período porque la planilla de <span className="font-semibold">{months.find(m => m.value === otraAbiertaItem.periodo_mes)?.label} {otraAbiertaItem.periodo_anio} ({otraAbiertaItem.quincena === 'primera' ? '1ra' : '2da'} Quincena)</span> aún está abierta. Debe cerrarla o eliminarla antes de iniciar un período nuevo.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleVerDetalle(otraAbiertaItem)}
                                className="px-3 py-1.5 text-xs font-bold bg-rose-200 hover:bg-rose-300 text-rose-900 rounded-xl transition-colors whitespace-nowrap self-stretch sm:self-auto text-center"
                            >
                                Ir a la planilla abierta
                            </button>
                        </div>
                    )}

                    {/* Period Parameters Card */}
                    <PlanillaHeader model={model} />

                    {/* Employee Search & Banner */}
                    <PlanillaEmployeeHeader model={model} />

                    {/* Main Two-Column View: Cuentas Table & Summary Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Cuentas Table (Left) */}
                        <PlanillaItemsTable model={model} />

                        {/* Summary Panel (Right) */}
                        <PlanillaTotalsSidebar model={model} />
                    </div>
                    </fieldset>
                </fieldset></div>);
};
export default PlanillasEditorTab;
