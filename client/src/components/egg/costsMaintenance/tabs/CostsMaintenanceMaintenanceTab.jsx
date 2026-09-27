import { formatDate } from '../../../../utils/dateUtils';
import Money, { MoneyInput } from '../../../ui/Money';
import {
    Activity,
    Wrench,
    User
} from 'lucide-react';


export default function CostsMaintenanceMaintenanceTab({ model }) {
    const { maintenanceLogs, activeTab, maintenanceForm, setMaintenanceForm, isSubmitting, handleCreateMaintenance } = model;

    return (<>{activeTab === 'maintenance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-600" />
                                <span>Registrar Mantenimiento Técnico</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Bitácora de servicio preventivo y correctivo</p>
                        </div>

                        <form onSubmit={handleCreateMaintenance} className="space-y-3.5 text-xs">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Equipo de Planta</label>
                                <select
                                    value={maintenanceForm.equipment_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas APV</option>
                                    <option value="quebradora">Quebradora Centrífuga SANOVO</option>
                                    <option value="tanque holding">Tanques de Holding de Acero Inox</option>
                                    <option value="caldera">Caldera de Vapor Cleaver-Brooks</option>
                                    <option value="llenadora">Llenadora Automática de Envases</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Tipo de Servicio</label>
                                <select
                                    value={maintenanceForm.maintenance_type}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="preventivo">Preventivo Programado</option>
                                    <option value="correctivo">Correctivo por Falla/Paro</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Horas de Uso</label>
                                    <input
                                        type="number"
                                        value={maintenanceForm.usage_hours_count}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, usage_hours_count: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                        placeholder="Ej: 480"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Costo ($)</label>
                                    <MoneyInput
                                        value={maintenanceForm.cost}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Técnico Responsable</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.technician_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, technician_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                    placeholder="Ej: Ing. Hugo Martínez"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Descripción del Trabajo</label>
                                <textarea
                                    value={maintenanceForm.description}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm h-16"
                                    placeholder="Cambio de juntas de placas, lubricación de bombas..."
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Repuestos Utilizados</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.spare_parts_used}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, spare_parts_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                    placeholder="Ej: Juntas de goma, sensor PT100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                            >
                                Guardar Registro de Mantenimiento
                            </button>
                        </form>
                    </div>

                    {/* Historial de Mantenimientos */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-600" />
                            <span>Bitácora de Intervenciones a Equipos</span>
                        </h2>

                        <div className="space-y-3 overflow-y-auto max-h-[550px] pr-1">
                            {(Array.isArray(maintenanceLogs) ? maintenanceLogs : []).map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                log.maintenance_type === 'preventivo'
                                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {log.maintenance_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.description}</p>
                                        {log.spare_parts_used && (
                                            <div className="text-[11px] text-slate-500">
                                                Repuestos: <strong className="text-slate-800">{log.spare_parts_used}</strong>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1 pt-1">
                                            <User size={12} />
                                            <span>Técnico: {log.technician_name}</span>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className="text-[11px] text-slate-500 font-medium">{formatDate(log.created_at)}</span>
                                        <div className="flex gap-2 text-xs mt-2">
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[9px] font-bold block text-slate-500 uppercase">Horas Uso</span>
                                                <span className="text-xs font-bold text-slate-800">{log.usage_hours_count} hrs</span>
                                            </div>
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[9px] font-bold block text-slate-500 uppercase">Costo</span>
                                                <span className="text-xs font-black text-teal-700">
                                                    <Money value={log.cost} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}</>);
}
