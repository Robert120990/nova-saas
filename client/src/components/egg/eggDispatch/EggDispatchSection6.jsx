import Modal from '../../ui/Modal';
import { MoneyInput } from '../../ui/Money';




export default function EggDispatchSection6({ model }) {
    const { vehicles, maintenanceModalOpen, setMaintenanceModalOpen, maintenanceForm, setMaintenanceForm, handleSaveMaintenance } = model;

    return (<Modal
                isOpen={maintenanceModalOpen}
                onClose={() => setMaintenanceModalOpen(false)}
                title="Registrar Mantenimiento de Vehículo"
                size="lg"
            >
                <form onSubmit={handleSaveMaintenance} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Vehículo *
                            </label>
                            <select
                                required
                                value={maintenanceForm.vehicle_id}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="">-- Seleccionar --</option>
                                {(Array.isArray(vehicles) ? vehicles : []).map(v => (
                                    <option key={v.id} value={v.id}>{v.codigo} - {v.placa}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Tipo de Servicio *
                            </label>
                            <select
                                value={maintenanceForm.tipo_mantenimiento}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, tipo_mantenimiento: e.target.value }))}
                                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="preventivo">Preventivo (Aceite/Filtros)</option>
                                <option value="correctivo">Correctivo (Reparación)</option>
                                <option value="termo_king">Termo-King / Refrigeración</option>
                                <option value="llantas">Llantas / Alineación</option>
                                <option value="frenos">Frenos y Suspensión</option>
                                <option value="inspeccion">Inspección de Seguridad</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Fecha Programada *
                            </label>
                            <input
                                type="date"
                                required
                                value={maintenanceForm.fecha_programada}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Fecha Realizada
                            </label>
                            <input
                                type="date"
                                value={maintenanceForm.fecha_realizada}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, fecha_realizada: e.target.value }))}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Estado del Servicio
                            </label>
                            <select
                                value={maintenanceForm.estado}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, estado: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="programado">Programado</option>
                                <option value="en_proceso">En Proceso (Taller)</option>
                                <option value="completado">Completado</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Odómetro (Km)
                            </label>
                            <input
                                type="number"
                                value={maintenanceForm.odometro}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, odometro: e.target.value }))}
                                placeholder="Ej: 45200"
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Taller o Proveedor
                            </label>
                            <input
                                type="text"
                                value={maintenanceForm.taller_proveedor}
                                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, taller_proveedor: e.target.value }))}
                                placeholder="Ej: Taller Central Hino / Frío El Salvador"
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Costo Total ($)
                            </label>
                            <MoneyInput
                                value={maintenanceForm.costo_total}
                                onChange={(val) => setMaintenanceForm(prev => ({ ...prev, costo_total: val }))}
                                placeholder="0.00"
                                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Descripción de Trabajos *
                        </label>
                        <textarea
                            required
                            rows="2"
                            value={maintenanceForm.descripcion}
                            onChange={(e) => setMaintenanceForm(prev => ({ ...prev, descripcion: e.target.value }))}
                            placeholder="Detalle de las tareas realizadas o requeridas..."
                            className="w-full text-xs border border-slate-200 rounded-xl p-2 text-slate-800 outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setMaintenanceModalOpen(false)}
                            className="text-xs font-semibold text-slate-600 px-4 py-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="text-xs font-bold bg-amber-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-amber-700 transition"
                        >
                            Guardar Registro
                        </button>
                    </div>
                </form>
            </Modal>);
}
