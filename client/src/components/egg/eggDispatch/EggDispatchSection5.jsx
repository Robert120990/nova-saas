import Modal from '../../ui/Modal';




export default function EggDispatchSection5({ model }) {
    const { vehicleModalOpen, setVehicleModalOpen, editingVehicle, vehicleForm, setVehicleForm, handleSaveVehicle } = model;

    return (<Modal
                isOpen={vehicleModalOpen}
                onClose={() => setVehicleModalOpen(false)}
                title={editingVehicle ? 'Editar Vehículo' : 'Agregar Vehículo a la Flota'}
                size="md"
            >
                <form onSubmit={handleSaveVehicle} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Código de Flota *
                            </label>
                            <input
                                type="text"
                                required
                                value={vehicleForm.codigo}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                placeholder="Ej: CAM-01"
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none uppercase"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Placa *
                            </label>
                            <input
                                type="text"
                                required
                                value={vehicleForm.placa}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                                placeholder="Ej: C-104928"
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Marca
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.marca}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, marca: e.target.value }))}
                                placeholder="Ej: Hino"
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Modelo
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.modelo}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, modelo: e.target.value }))}
                                placeholder="Ej: 300 Serie 816"
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Año
                            </label>
                            <input
                                type="number"
                                value={vehicleForm.anio}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, anio: e.target.value }))}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Capacidad Peso (Lbs)
                            </label>
                            <input
                                type="number"
                                required
                                value={vehicleForm.capacidad_peso_lbs}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, capacidad_peso_lbs: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Capacidad Cubetas (30 Lb)
                            </label>
                            <input
                                type="number"
                                required
                                value={vehicleForm.capacidad_cubetas}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, capacidad_cubetas: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Odómetro Actual (Km)
                            </label>
                            <input
                                type="number"
                                value={vehicleForm.odometro_actual}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, odometro_actual: e.target.value }))}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Estado Inicial
                            </label>
                            <select
                                value={vehicleForm.estado}
                                onChange={(e) => setVehicleForm(prev => ({ ...prev, estado: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="disponible">Disponible</option>
                                <option value="en_mantenimiento">En Mantenimiento</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                            type="checkbox"
                            checked={vehicleForm.tiene_termo_king}
                            onChange={(e) => setVehicleForm(prev => ({ ...prev, tiene_termo_king: e.target.checked }))}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-xs font-bold text-slate-700">
                            Equipado con Termo-King de Refrigeración para Ovoproductos (2°C - 4°C)
                        </span>
                    </label>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Notas / Características
                        </label>
                        <textarea
                            rows="2"
                            value={vehicleForm.notas}
                            onChange={(e) => setVehicleForm(prev => ({ ...prev, notas: e.target.value }))}
                            placeholder="Detalles adicionales del vehículo..."
                            className="w-full text-xs border border-slate-200 rounded-xl p-2 text-slate-800 outline-none"
                        />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setVehicleModalOpen(false)}
                            className="w-full sm:w-auto text-center text-xs font-semibold text-slate-600 px-4 py-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="w-full sm:w-auto justify-center text-xs font-bold bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-indigo-700 transition"
                        >
                            {editingVehicle ? 'Guardar Cambios' : 'Guardar Vehículo'}
                        </button>
                    </div>
                </form>
            </Modal>);
}
