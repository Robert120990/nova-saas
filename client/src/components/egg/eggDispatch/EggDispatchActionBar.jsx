import Modal from '../../ui/Modal';
import {
    AlertTriangle,
    RefreshCw
} from 'lucide-react';


export default function EggDispatchActionBar({ model }) {
    const { getOrderItems, getOrderTotalUnits, routeDetail, routeModalOpen, setRouteModalOpen, editingRouteId, savingRoute, routeForm, setRouteForm, vehicles, factoryUsers, handleSaveRoute, selectedVehicleForRoute, availableOrdersForRoute, calculatedLoadForNewRoute } = model;

    return (<Modal
                isOpen={routeModalOpen}
                onClose={() => setRouteModalOpen(false)}
                title="Planificar Ruta de Despacho"
                maxWidth="max-w-4xl"
                zIndex="z-[1200]"
            >
                <form onSubmit={handleSaveRoute} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Fecha de Despacho *
                            </label>
                            <input
                                type="date"
                                required
                                value={routeForm.fecha_despacho}
                                onChange={(e) => setRouteForm(prev => ({ ...prev, fecha_despacho: e.target.value }))}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Camión Asignado *
                            </label>
                            <select
                                required
                                value={routeForm.vehicle_id}
                                onChange={(e) => setRouteForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="">-- Seleccionar Camión --</option>
                                {(Array.isArray(vehicles) ? vehicles : []).map(v => (
                                    <option
                                        key={v.id}
                                        value={v.id}
                                        disabled={v.estado === 'en_mantenimiento'}
                                    >
                                        {v.codigo} ({v.placa}) - Cap: {parseFloat(v.capacidad_peso_lbs).toLocaleString()} Lbs {v.estado === 'en_mantenimiento' ? '[EN TALLER]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Motorista
                            </label>
                            <select
                                value={routeForm.driver_id}
                                onChange={(e) => {
                                    const uid = e.target.value;
                                    const u = factoryUsers.find(x => x.id === parseInt(uid));
                                    setRouteForm(prev => ({
                                        ...prev,
                                        driver_id: uid,
                                        driver_name: u ? u.nombre : prev.driver_name
                                    }));
                                }}
                                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="">-- Seleccionar de usuarios de planta --</option>
                                {(Array.isArray(factoryUsers) ? factoryUsers : []).map(u => (
                                    <option key={u.id} value={u.id}>{u.nombre} ({u.role_name})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Alerta de Capacidad en Tiempo Real */}
                    {selectedVehicleForRoute && (
                        <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                            calculatedLoadForNewRoute.isOverload
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                            <div className="flex justify-between font-bold">
                                <span>Capacidad Utilizada del Camión {selectedVehicleForRoute.codigo}:</span>
                                <span>
                                    {calculatedLoadForNewRoute.totalLbs.toLocaleString()} / {calculatedLoadForNewRoute.maxLbs.toLocaleString()} Lbs ({calculatedLoadForNewRoute.pctLbs.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${calculatedLoadForNewRoute.isOverload ? 'bg-rose-600' : 'bg-indigo-600'}`}
                                    style={{ width: `${calculatedLoadForNewRoute.pctLbs}%` }}
                                />
                            </div>
                            {calculatedLoadForNewRoute.isOverload && (
                                <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    ¡Atención! La carga total excede la capacidad máxima del camión.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Selección de Pedidos para la Ruta */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Seleccionar Pedidos para esta Ruta ({routeForm.selectedOrderIds.length} seleccionados)
                            </label>
                        </div>

                        <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                            {availableOrdersForRoute.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400">
                                    No hay pedidos pendientes disponibles para programar. Todos los pedidos ya fueron asignados a una ruta o entregados.
                                </div>
                            ) : (
                                (Array.isArray(availableOrdersForRoute) ? availableOrdersForRoute : []).map(ord => {
                                    const isAlreadyBilledInRoute = !!(routeDetail?.stops?.some(s => s.order_id === ord.id && (s.is_billed || s.sale_id || s.sale_sello_recepcion)));
                                    const isSelected = isAlreadyBilledInRoute || routeForm.selectedOrderIds.includes(ord.id);
                                    const orderItems = getOrderItems(ord);
                                    return (
                                        <label
                                            key={ord.id}
                                            className={`flex items-start justify-between p-3 text-xs transition ${
                                                isAlreadyBilledInRoute ? 'bg-emerald-50/50 cursor-default' : isSelected ? 'bg-indigo-50/80 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={isAlreadyBilledInRoute}
                                                    onChange={(e) => {
                                                        if (isAlreadyBilledInRoute) return;
                                                        if (e.target.checked) {
                                                            setRouteForm(prev => ({
                                                                ...prev,
                                                                selectedOrderIds: [...prev.selectedOrderIds, ord.id]
                                                            }));
                                                        } else {
                                                            setRouteForm(prev => ({
                                                                ...prev,
                                                                selectedOrderIds: prev.selectedOrderIds.filter(id => id !== ord.id)
                                                            }));
                                                        }
                                                    }}
                                                    className={`rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 ${isAlreadyBilledInRoute ? 'cursor-not-allowed opacity-60' : ''}`}
                                                />
                                                <div>
                                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                                        <span>{ord.customer_name}</span>
                                                        {isAlreadyBilledInRoute && (
                                                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200" title="Pedido ya facturado en esta ruta (preservado)">
                                                                ✓ Facturado
                                                            </span>
                                                        )}
                                                        {ord.priority === 'urgente' && (
                                                            <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                                                URGENTE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        📍 {ord.branch_name || 'Sucursal Principal'} | Fecha: {ord.required_delivery_date?.split('T')[0]}
                                                    </div>

                                                    {/* Desglose de Productos y Lotes */}
                                                    <div className="mt-1 space-y-0.5">
                                                        {(Array.isArray(orderItems) ? orderItems : []).map((it, i) => (
                                                            <div key={i} className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-slate-800">• {it.product_type}</span>
                                                                <span className="text-indigo-600 font-bold">
                                                                    ({parseFloat(it.quantity_lbs || 0).toLocaleString()} Lbs{it.presentation ? ` - ${it.presentation}` : ''})
                                                                </span>
                                                                {(it.lot_code || ord.lot_code || ord.linked_batch_code) && (
                                                                    <span className="bg-emerald-50 text-emerald-800 font-bold text-[10px] px-1.5 py-0.2 rounded border border-emerald-200">
                                                                        Lote: {it.lot_code || ord.lot_code || ord.linked_batch_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-left sm:text-right flex-shrink-0 sm:ml-3 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 flex sm:block justify-between items-center">
                                                <span className="font-black text-indigo-700 block">{parseFloat(ord.quantity_lbs || 0).toLocaleString()} Lbs</span>
                                                <span className="text-[10px] text-slate-500 block">
                                                    {getOrderTotalUnits(ord).toLocaleString()} Uds
                                                </span>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setRouteModalOpen(false)}
                            className="w-full sm:w-auto text-center text-xs font-semibold text-slate-600 px-4 py-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={savingRoute}
                            className="w-full sm:w-auto justify-center text-xs font-bold bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {savingRoute ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Guardando Ruta...</span>
                                </>
                            ) : (
                                <span>{editingRouteId ? 'Guardar Cambios' : 'Crear Ruta de Despacho'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>);
}
