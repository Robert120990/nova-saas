import Money from '../../ui/Money';
import { Search, Users, User, UserX, UserPlus, Save } from 'lucide-react';


import { labelCls } from './planillaUtils';
const PlanillaEmployeeHeader = ({ model }) => {
    const { employeeInputRef, codigoInput, setCodigoInput, handleCodigoSearch, hayOtraAbierta, setIsEmpModalOpen, empleadoData, diasTrabajados, handleDiasTrabajadosChange, saveCurrentEmployee, guardandoManual, savingRef, selected, handleExcluirEmpleado, excluirMutation, handleAgregarEmpleado } = model;
    return (<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                            <div className="lg:col-span-5">
                                <label className={labelCls}>
                                    Código de Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar en catálogo)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        ref={employeeInputRef}
                                        type="text"
                                        value={codigoInput}
                                        onChange={e => setCodigoInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                        disabled={hayOtraAbierta}
                                        placeholder="Ej: 0001"
                                        className="min-w-0 w-full sm:w-auto flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCodigoSearch}
                                        disabled={hayOtraAbierta}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Buscar por código"
                                    >
                                        <Search size={15} />
                                        <span>Buscar</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => !hayOtraAbierta && setIsEmpModalOpen(true)}
                                        disabled={hayOtraAbierta}
                                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Ver lista de empleados (F3)"
                                    >
                                        <Users size={15} />
                                        <span>Lista (F3)</span>
                                    </button>
                                </div>
                            </div>

                            <div className="lg:col-span-7">
                                {empleadoData ? (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                                                <User size={15} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 text-sm block">
                                                    {empleadoData.nombres} {empleadoData.apellidos}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    CÓD: {empleadoData.codigo}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Cargo</span>
                                            <span className="text-slate-700 font-medium">{empleadoData.cargo_nombre || 'Sin cargo'}</span>
                                        </div>
                                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Depto</span>
                                            <span className="text-slate-700 font-medium">{empleadoData.departamento_nombre || 'Sin depto.'}</span>
                                        </div>
                                        {parseFloat(empleadoData.bonificacion_fija || 0) > 0 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <div>
                                                    <span className="text-[10px] text-amber-600 uppercase font-bold block">Bonif. Fija</span>
                                                    <span className="text-xs font-black text-amber-700">
                                                        <Money value={parseFloat(empleadoData.bonificacion_fija)} />/q
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        {empleadoData.en_vacaciones === 1 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg">
                                                    🏖️ Vacaciones
                                                </span>
                                            </>
                                        )}
                                        {empleadoData.incapacitado === 1 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg">
                                                    🏥 Incapacitado
                                                </span>
                                            </>
                                        )}
                                        {(empleadoData.en_vacaciones === 1 || empleadoData.incapacitado === 1) && diasTrabajados > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDiasTrabajadosChange(0)}
                                                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300/80 transition-colors shadow-xs"
                                                title="Ajustar días trabajados a 0 para esta quincena"
                                            >
                                                Poner 0 días
                                            </button>
                                        )}

                                        <div className="ml-auto flex flex-wrap items-center gap-2">
                                            {empleadoData?.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => saveCurrentEmployee({ silent: false }).catch(() => {})}
                                                    disabled={guardandoManual || savingRef.current}
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                                    title="Guardar de inmediato todos los cambios y cuentas de este empleado"
                                                >
                                                    <Save size={13} className={guardandoManual ? 'animate-spin' : ''} />
                                                    <span>{guardandoManual ? 'Guardando...' : 'Guardar'}</span>
                                                </button>
                                            )}

                                            {selected?.id ? (
                                                <button
                                                    type="button"
                                                    onClick={handleExcluirEmpleado}
                                                    disabled={excluirMutation.isPending || guardandoManual}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                                    title="Excluir a este empleado únicamente de esta planilla quincenal"
                                                >
                                                    <UserX size={13} />
                                                    <span>{excluirMutation.isPending ? 'Excluyendo...' : 'Excluir de Planilla'}</span>
                                                </button>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-lg">
                                                        No incluido en quincena
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={handleAgregarEmpleado}
                                                        disabled={savingRef.current || guardandoManual}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                        title="Agregar formalmente a este empleado a la planilla de esta quincena"
                                                    >
                                                        <UserPlus size={13} />
                                                        <span>{savingRef.current ? 'Agregando...' : 'Agregar a Planilla'}</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="text-right pl-2 border-l border-slate-200">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Sueldo Quincenal</span>
                                                <span className="text-sm font-black text-indigo-600">
                                                    <Money value={(parseFloat(empleadoData.sueldo_base || 0) / 30) * diasTrabajados} />
                                                </span>
                                                <span className="text-[9px] text-slate-400 block font-medium">
                                                    Base: <Money value={parseFloat(empleadoData.sueldo_base || 0)} />/mes
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                                        <User size={16} className="text-slate-300 shrink-0" />
                                        <span>Seleccione un empleado del listado o escriba su código para comenzar a editar cuentas.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>);
};
export default PlanillaEmployeeHeader;
