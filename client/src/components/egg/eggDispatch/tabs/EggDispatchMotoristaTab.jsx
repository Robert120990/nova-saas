import {
    Navigation,
    Phone,
    CheckCircle2,
    QrCode,
    ExternalLink
} from 'lucide-react';


export default function EggDispatchMotoristaTab({ model }) {
    const { activeTab, getOrderTotalUnits, routeDetail, driverRoutes, setDeliveryScannerModalOpen, setSelectedStopToDeliver, fetchRouteDetail } = model;

    return (<>{activeTab === 'motorista' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    {/* Header Móvil del Chofer */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                                    Hoja de Reparto del Chofer
                                </span>
                                <h2 className="text-lg font-black mt-0.5">
                                    {routeDetail?.driver_name || 'Motorista Asignado'}
                                </h2>
                                <p className="text-xs text-indigo-200">
                                    🚛 {routeDetail?.vehicle_codigo} ({routeDetail?.vehicle_placa})
                                </p>
                            </div>

                            <div className="text-right">
                                <span className="text-2xl font-black text-emerald-400">
                                    {routeDetail?.stops?.filter(s => s.estado_entrega === 'entregado').length || 0}
                                    <span className="text-sm text-slate-300"> / {routeDetail?.stops?.length || 0}</span>
                                </span>
                                <p className="text-[10px] font-bold text-slate-300">Entregas Realizadas</p>
                            </div>
                        </div>

                        {/* Selector de Ruta del día si hay más de una */}
                        {driverRoutes.length > 1 && (
                            <select
                                value={routeDetail?.id || ''}
                                onChange={(e) => fetchRouteDetail(e.target.value)}
                                className="w-full text-xs font-bold bg-white/10 border border-white/20 rounded-xl p-2 text-white outline-none"
                            >
                                {(Array.isArray(driverRoutes) ? driverRoutes : []).map(r => (
                                    <option key={r.id} value={r.id} className="text-slate-900">
                                        {r.codigo_ruta} ({r.total_stops} paradas)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Lista de Paradas del Motorista */}
                    <div className="space-y-3">
                        {(Array.isArray(routeDetail?.stops) ? routeDetail?.stops : [])?.map((stop) => {
                            const isDelivered = stop.estado_entrega === 'entregado';
                            const gmapsUrl = stop.branch_latitude && stop.branch_longitude
                                ? `https://www.google.com/maps/dir/?api=1&destination=${stop.branch_latitude},${stop.branch_longitude}`
                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((stop.branch_address || '') + ', ' + (stop.customer_name || ''))}`;
                            const wazeUrl = stop.branch_latitude && stop.branch_longitude
                                ? `https://waze.com/ul?ll=${stop.branch_latitude},${stop.branch_longitude}&navigate=yes`
                                : null;

                            return (
                                <div
                                    key={stop.id}
                                    className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-sm transition space-y-3 ${
                                        isDelivered
                                            ? 'bg-emerald-50/60 border-emerald-200'
                                            : 'bg-white border-slate-200'
                                    }`}
                                >
                                    {/* Cabecera de la parada */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-8 h-8 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-sm ${
                                                isDelivered ? 'bg-emerald-600' : 'bg-indigo-600'
                                            }`}>
                                                {isDelivered ? '✓' : stop.orden_visita}
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 leading-tight">
                                                    {stop.customer_name}
                                                </h3>
                                                <p className="text-xs text-slate-600 font-semibold">
                                                    📍 {stop.branch_name || 'Sucursal Principal'}
                                                </p>
                                            </div>
                                        </div>

                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                            isDelivered
                                                ? 'bg-emerald-200 text-emerald-800'
                                                : stop.prioridad === 'urgente'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                            {isDelivered ? 'Entregado' : (stop.prioridad || 'Normal')}
                                        </span>
                                    </div>

                                    {/* Dirección */}
                                    {stop.branch_address && (
                                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            {stop.branch_address}
                                        </div>
                                    )}

                                    {/* Datos de contacto: "¿Por quién preguntar?" y Teléfono */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-indigo-50/50 p-2.5 rounded-2xl border border-indigo-100 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase block">
                                                Preguntar por:
                                            </span>
                                            <span className="font-black text-slate-900">
                                                {stop.recibido_por || stop.branch_contact_person || 'Encargado de Recepción'}
                                            </span>
                                        </div>

                                        {(stop.telefono_receptor || stop.branch_contact_phone || stop.customer_phone) && (
                                            <div>
                                                <span className="text-[10px] font-bold text-indigo-600 uppercase block">
                                                    Teléfono receptor:
                                                </span>
                                                <a
                                                    href={`tel:${stop.telefono_receptor || stop.branch_contact_phone || stop.customer_phone}`}
                                                    className="font-bold text-indigo-700 hover:underline flex items-center gap-1 mt-0.5"
                                                >
                                                    <Phone className="w-3 h-3 text-emerald-600" />
                                                    <span>{stop.telefono_receptor || stop.branch_contact_phone || stop.customer_phone}</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Detalle del producto */}
                                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        <span className="font-semibold text-slate-700">{stop.product_type}</span>
                                        <span className="font-black text-indigo-700">
                                            {stop.quantity_lbs} Lbs ({getOrderTotalUnits(stop).toLocaleString()} Uds)
                                        </span>
                                    </div>

                                    {/* Botones de Navegación Externa */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={gmapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 rounded-xl border border-blue-200 transition text-center"
                                        >
                                            <Navigation className="w-3.5 h-3.5" />
                                            <span>Google Maps</span>
                                        </a>

                                        {wazeUrl ? (
                                            <a
                                                href={wazeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-1.5 text-xs font-bold bg-cyan-50 text-cyan-700 hover:bg-cyan-100 py-2 rounded-xl border border-cyan-200 transition text-center"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span>Waze</span>
                                            </a>
                                        ) : (
                                            <div className="flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                                                Sin GPS (Waze N/A)
                                            </div>
                                        )}
                                    </div>

                                    {/* Botón Principal de Confirmación / Escaneo QR */}
                                    {!isDelivered ? (
                                        <button
                                            onClick={() => {
                                                setSelectedStopToDeliver(stop);
                                                setDeliveryScannerModalOpen(true);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl shadow-md transition"
                                        >
                                            <QrCode className="w-4 h-4" />
                                            <span>Escanear QR DTE / Confirmar Entrega</span>
                                        </button>
                                    ) : (
                                        <div className="bg-emerald-100/80 p-2.5 rounded-2xl border border-emerald-300 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                <div>
                                                    <span className="font-bold">Entrega Registrada</span>
                                                    {stop.recibido_por && (
                                                        <span className="text-[11px] block text-emerald-800">
                                                            Recibió: {stop.recibido_por} ({stop.telefono_receptor || 'Sin tel.'})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {stop.dte_codigo_generacion && (
                                                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
                                                    DTE: {stop.dte_codigo_generacion.substring(0, 8)}...
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}</>);
}
