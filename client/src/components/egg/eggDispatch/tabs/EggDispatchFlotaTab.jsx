import { getTodayString } from '../../../../utils/dateUtils';
import Money from '../../../ui/Money';
import {
    Plus,
    Wrench
} from 'lucide-react';


export default function EggDispatchFlotaTab({ model }) {
    const { activeTab, vehicles, setVehicleModalOpen, setEditingVehicle, setVehicleForm, maintenanceLogs, setMaintenanceModalOpen, setMaintenanceForm } = model;

    return (<>{activeTab === 'flota' && (
                <div className="space-y-6">
                    {/* Header Sección Flota */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Camiones y Vehículos de Reparto</h2>
                            <p className="text-xs text-slate-500">Control de capacidad de carga, refrigeración Termo-King y estado operativo</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setVehicleForm({
                                        codigo: '',
                                        placa: '',
                                        marca: '',
                                        modelo: '',
                                        anio: new Date().getFullYear(),
                                        tipo_vehiculo: 'camion_refrigerado',
                                        capacidad_peso_lbs: 10000,
                                        capacidad_cubetas: 350,
                                        tiene_termo_king: true,
                                        odometro_actual: 0,
                                        estado: 'disponible',
                                        notas: ''
                                    });
                                    setEditingVehicle(null);
                                    setVehicleModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl shadow hover:bg-indigo-700 transition"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Agregar Vehículo</span>
                            </button>

                            <button
                                onClick={() => {
                                    setMaintenanceForm({
                                        vehicle_id: vehicles[0]?.id || '',
                                        tipo_mantenimiento: 'preventivo',
                                        fecha_programada: getTodayString(new Date()),
                                        fecha_realizada: '',
                                        odometro: '',
                                        taller_proveedor: '',
                                        costo_total: 0,
                                        descripcion: '',
                                        repuestos_cambiados: '',
                                        estado: 'programado',
                                        proximo_servicio_km: '',
                                        proximo_servicio_fecha: '',
                                        notas: ''
                                    });
                                    setMaintenanceModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow hover:bg-amber-700 transition"
                            >
                                <Wrench className="w-4 h-4" />
                                <span>Registrar Mantenimiento</span>
                            </button>
                        </div>
                    </div>

                    {/* Tarjetas de Camiones */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(Array.isArray(vehicles) ? vehicles : []).map((v) => (
                            <div
                                key={v.id}
                                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                            {v.codigo}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 mt-1">{v.placa}</h3>
                                        <p className="text-xs text-slate-500">{v.marca} {v.modelo} ({v.anio})</p>
                                    </div>

                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                        v.estado === 'disponible'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : v.estado === 'en_mantenimiento'
                                            ? 'bg-rose-100 text-rose-700 animate-pulse'
                                            : v.estado === 'en_ruta'
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {v.estado === 'en_mantenimiento' ? '⚠️ En Taller' : v.estado}
                                    </span>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                                    <div className="flex justify-between">
                                        <span>Capacidad Peso:</span>
                                        <strong className="text-slate-900">{parseFloat(v.capacidad_peso_lbs).toLocaleString()} Lbs</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Capacidad Cubetas:</span>
                                        <strong className="text-slate-900">{v.capacidad_cubetas} Cubetas (30 Lb)</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Termo-King Refrigeración:</span>
                                        <strong className={v.tiene_termo_king ? 'text-emerald-600' : 'text-slate-400'}>
                                            {v.tiene_termo_king ? '✓ Sí (2-4°C)' : 'No'}
                                        </strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Odómetro Actual:</span>
                                        <strong className="text-indigo-700">{parseFloat(v.odometro_actual || 0).toLocaleString()} Km</strong>
                                    </div>
                                </div>

                                {v.notas && (
                                    <p className="text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-lg">
                                        "{v.notas}"
                                    </p>
                                )}

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => {
                                            setEditingVehicle(v);
                                            setVehicleForm({
                                                codigo: v.codigo,
                                                placa: v.placa,
                                                marca: v.marca || '',
                                                modelo: v.modelo || '',
                                                anio: v.anio || new Date().getFullYear(),
                                                tipo_vehiculo: v.tipo_vehiculo || 'camion_refrigerado',
                                                capacidad_peso_lbs: v.capacidad_peso_lbs,
                                                capacidad_cubetas: v.capacidad_cubetas,
                                                tiene_termo_king: !!v.tiene_termo_king,
                                                odometro_actual: v.odometro_actual,
                                                estado: v.estado,
                                                notas: v.notas || ''
                                            });
                                            setVehicleModalOpen(true);
                                        }}
                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                        Editar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Historial de Mantenimientos */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Historial y Planificación de Mantenimientos
                                </h3>
                                <p className="text-xs text-slate-500">Mantenimientos preventivos, correctivos, termo-king y cambio de fluidos</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                                        <th className="p-3">Vehículo</th>
                                        <th className="p-3">Tipo</th>
                                        <th className="p-3">Fecha Programada</th>
                                        <th className="p-3">Fecha Realizada</th>
                                        <th className="p-3">Odómetro</th>
                                        <th className="p-3">Taller / Proveedor</th>
                                        <th className="p-3 text-right">Costo</th>
                                        <th className="p-3">Estado</th>
                                        <th className="p-3">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {maintenanceLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="p-6 text-center text-slate-400 font-medium">
                                                No hay registros de mantenimiento registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        (Array.isArray(maintenanceLogs) ? maintenanceLogs : []).map((m) => (
                                            <tr key={m.id} className="hover:bg-slate-50/80 transition">
                                                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                                    {m.vehicle_codigo} ({m.vehicle_placa})
                                                </td>
                                                <td className="p-3 uppercase font-semibold text-slate-700 whitespace-nowrap">
                                                    {m.tipo_mantenimiento}
                                                </td>
                                                <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                                                    {m.fecha_programada ? m.fecha_programada.split('T')[0] : ''}
                                                </td>
                                                <td className="p-3 font-semibold text-emerald-700 whitespace-nowrap">
                                                    {m.fecha_realizada ? m.fecha_realizada.split('T')[0] : '-'}
                                                </td>
                                                <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                                                    {m.odometro ? `${parseFloat(m.odometro).toLocaleString()} Km` : '-'}
                                                </td>
                                                <td className="p-3 text-slate-800 whitespace-nowrap">
                                                    {m.taller_proveedor || '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                                    <Money amount={parseFloat(m.costo_total || 0)} />
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        m.estado === 'completado'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : m.estado === 'en_proceso'
                                                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {m.estado}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-600 max-w-xs truncate">
                                                    {m.descripcion}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}</>);
}
