import EggEmissionRecoveryButton from '../../EggEmissionRecoveryButton';
import axios from 'axios';
import { toast } from 'sonner';
import DispatchRouteMap from '../../DispatchRouteMap';
import {
    Navigation,
    CheckCircle2,
    AlertTriangle,
    Plus,
    RefreshCw,
    ArrowUp,
    ArrowDown,
    Trash2,
    Edit3,
    Sparkles,
    Printer,
    Receipt,
    Files,
    Mail
} from 'lucide-react';


export default function EggDispatchRutasTab({ model }) {
    const { activeTab, orders, setOrderModalOpen, setEditingOrder, printingOrderId, printingManifest, handlePrintOrderReceipt, handlePrintRouteManifest, getOrderItems, getItemUnits, routes, selectedRoute, setSelectedRoute, routeDetail, optimizingRoute, fetchRouteDetail, handleOpenCreateRoute, handleEditRoute, handleRemoveStopFromRoute, handleDeleteRoute, handleOptimizeRoute, handleOpenAutoInvoice, handleMoveStop } = model;

    return (<>{activeTab === 'rutas' && (
                <div className="space-y-6">
                    {/* Selector de Rutas Existentes */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Seleccionar Ruta:
                            </label>
                            <select
                                value={selectedRoute?.id || ''}
                                onChange={(e) => {
                                    const r = routes.find(x => x.id === parseInt(e.target.value));
                                    setSelectedRoute(r || null);
                                }}
                                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                            >
                                <option value="">-- Seleccionar ruta de despacho --</option>
                                {(Array.isArray(routes) ? routes : []).map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.codigo_ruta} ({r.fecha_despacho ? r.fecha_despacho.split('T')[0] : ''}) - {r.driver_name || 'Sin Chofer'} [{r.estado}]
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleOpenCreateRoute()}
                                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl shadow hover:bg-indigo-700 transition"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Crear Nueva Ruta</span>
                            </button>

                            {selectedRoute && (
                                <button
                                    onClick={() => handleDeleteRoute(selectedRoute.id)}
                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
                                    title="Eliminar Ruta y Liberar Pedidos"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Detalle de la Ruta Activa */}
                    {routeDetail ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Columna Izquierda: Paradas y Secuencia (5 cols) */}
                            <div className="lg:col-span-5 space-y-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                {routeDetail.codigo_ruta}
                                            </span>
                                            <h3 className="text-sm font-black text-slate-800 mt-1">
                                                Camión: {routeDetail.vehicle_codigo} ({routeDetail.vehicle_placa})
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Chofer: <span className="font-semibold text-slate-700">{routeDetail.driver_name || 'No asignado'}</span>
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            {/* Botón Imprimir Listado / Manifiesto de Despacho (PDF solo o con DTEs anexados, y Excel) */}
                                            <div className="flex items-center bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden p-0.5 shadow-xs">
                                                <button
                                                    onClick={() => handlePrintRouteManifest(routeDetail.id, 'pdf', false)}
                                                    disabled={!!printingManifest}
                                                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                                                    title="Imprimir Manifiesto de Despacho en PDF Oficial (Solo Hoja de Ruta)"
                                                >
                                                    {printingManifest === 'only_manifest' ? (
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Printer className="w-3.5 h-3.5" />
                                                    )}
                                                    <span>Listado</span>
                                                </button>
                                                <button
                                                    onClick={() => handlePrintRouteManifest(routeDetail.id, 'pdf', true)}
                                                    disabled={!!printingManifest}
                                                    className="flex items-center gap-1 text-xs font-bold text-violet-700 hover:bg-violet-600 hover:text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 border-l border-indigo-200"
                                                    title="Imprimir Manifiesto de Despacho + Facturas DTE unificadas automáticamente en un solo PDF"
                                                >
                                                    {printingManifest === 'with_dtes' ? (
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Files className="w-3.5 h-3.5" />
                                                    )}
                                                    <span>+ DTEs</span>
                                                </button>
                                                <button
                                                    onClick={() => handlePrintRouteManifest(routeDetail.id, 'excel')}
                                                    className="text-[10px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1.5 rounded-lg transition border-l border-indigo-200"
                                                    title="Exportar Listado de Despacho a Excel"
                                                >
                                                    XLS
                                                </button>
                                            </div>

                                            {/* Botón Facturar Ruta Automáticamente */}
                                            <button
                                                onClick={handleOpenAutoInvoice}
                                                className="flex items-center gap-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
                                                title="Facturar automáticamente los pedidos de esta ruta con asignación de lotes"
                                            >
                                                <Receipt className="w-3.5 h-3.5" />
                                                <span>Facturar Ruta</span>
                                                {routeDetail.stops?.some(s => (!s.is_billed && !s.sale_sello_recepcion) || s.is_rejected || s.dte_status === 'REJECTED') && (
                                                    <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                                        {routeDetail.stops.filter(s => (!s.is_billed && !s.sale_sello_recepcion) || s.is_rejected || s.dte_status === 'REJECTED').length}
                                                    </span>
                                                )}
                                            </button>

                                            {/* Botón Agregar Pedidos a la Ruta */}
                                            <button
                                                onClick={() => handleEditRoute(selectedRoute || routeDetail, routeDetail)}
                                                className="flex items-center gap-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-xl border border-indigo-200 shadow-xs transition"
                                                title="Agregar más pedidos a esta ruta para facturarlos después"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>+ Agregar Pedidos</span>
                                            </button>

                                            {/* Botón Editar Ruta */}
                                            <button
                                                onClick={() => handleEditRoute(selectedRoute || routeDetail, routeDetail)}
                                                className="flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl border border-slate-200 transition"
                                                title="Editar Paradas, Camión o Chofer de esta Ruta"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>Editar</span>
                                            </button>

                                            {/* Botón Optimizar Secuencia */}
                                            <button
                                                onClick={handleOptimizeRoute}
                                                disabled={optimizingRoute}
                                                className="flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl shadow-sm transition disabled:opacity-50"
                                                title="Reordena automáticamente priorizando urgentes y proximidad geográfica"
                                            >
                                                <Sparkles className={`w-3.5 h-3.5 ${optimizingRoute ? 'animate-spin' : ''}`} />
                                                <span>{optimizingRoute ? '...' : 'Optimizar'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Barra de Carga del Camión */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                                        <div className="flex justify-between font-bold text-slate-700 text-[11px]">
                                            <span>Carga: {parseFloat(routeDetail.total_peso_lbs || 0).toLocaleString()} / {parseFloat(routeDetail.vehicle_capacidad_peso || 10000).toLocaleString()} Lbs</span>
                                            <span>{routeDetail.total_cubetas || 0} / {routeDetail.vehicle_capacidad_cubetas || 350} Cubetas</span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    (routeDetail.total_peso_lbs || 0) > (routeDetail.vehicle_capacidad_peso || 10000)
                                                        ? 'bg-rose-600'
                                                        : 'bg-indigo-600'
                                                }`}
                                                style={{
                                                    width: `${Math.min(
                                                        ((routeDetail.total_peso_lbs || 0) / (routeDetail.vehicle_capacidad_peso || 10000)) * 100,
                                                        100
                                                    )}%`
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Lista de Paradas Ordenadas */}
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                        {(Array.isArray(routeDetail.stops) ? routeDetail.stops : [])?.map((stop, idx) => {
                                            const isStopRejected = !!(
                                                stop.is_rejected ||
                                                stop.dte_status === 'REJECTED' ||
                                                (stop.sale_id && !stop.sale_sello_recepcion && stop.dte_status === 'REJECTED')
                                            );
                                            const isStopBilled = !isStopRejected && !!(
                                                stop.is_billed ||
                                                stop.sale_sello_recepcion ||
                                                ['ACCEPTED', 'CONTINGENCY', 'CONTINGENCIA_PENDIENTE'].includes(stop.dte_status)
                                            );

                                            return (
                                            <div
                                                key={stop.id}
                                                className={`p-3 rounded-xl border transition ${
                                                    isStopBilled
                                                        ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs'
                                                        : isStopRejected
                                                        ? 'bg-rose-50/90 border-rose-300 shadow-2xs'
                                                        : stop.estado_entrega === 'entregado'
                                                        ? 'bg-emerald-50/50 border-emerald-200'
                                                        : 'bg-white border-slate-200 hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2.5">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                                            isStopBilled
                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                : isStopRejected
                                                                ? 'bg-rose-600 text-white shadow-xs'
                                                                : stop.estado_entrega === 'entregado'
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-indigo-600 text-white'
                                                        }`}>
                                                            {isStopBilled ? '✓' : isStopRejected ? '✕' : stop.estado_entrega === 'entregado' ? '✓' : stop.orden_visita}
                                                        </span>

                                                        <div>
                                                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                                                <span>{stop.customer_name}</span>
                                                                {stop.sale_id && !isStopBilled && <EggEmissionRecoveryButton saleId={stop.sale_id} onSuccess={() => fetchRouteDetail(routeDetail.id)} />}
                                                                {isStopBilled ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full shadow-2xs">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        <span>FACTURADO</span>
                                                                        {stop.sale_numero_control ? (
                                                                            <span className="font-mono">#{stop.sale_numero_control}</span>
                                                                        ) : stop.sale_dte_type ? (
                                                                            <span className="font-mono">[{stop.sale_dte_type}]</span>
                                                                        ) : null}
                                                                    </span>
                                                                ) : isStopRejected ? (
                                                                    <span
                                                                        className="inline-flex items-center gap-1 text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full shadow-2xs cursor-help"
                                                                        title="El DTE fue rechazado por Hacienda y no procede. La parada queda lista para refacturarse con datos corregidos."
                                                                    >
                                                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                                        <span>RECHAZADO MH (NO PROCEDE)</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                                                        Pendiente Factura
                                                                    </span>
                                                                )}
                                                                {stop.prioridad === 'urgente' && (
                                                                    <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                                                        URGENTE
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                                📍 {stop.branch_name || 'Sucursal'}
                                                                {stop.branch_address && ` - ${stop.branch_address}`}
                                                            </p>

                                                            {stop.branch_contact_person && (
                                                                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                                                                    👤 Preguntar por: <span className="font-bold text-indigo-900">{stop.branch_contact_person}</span>
                                                                    {stop.branch_contact_phone && ` (${stop.branch_contact_phone})`}
                                                                </p>
                                                            )}

                                                             {/* Desglose de Productos del Pedido / Parada */}
                                                             <div className="mt-2 space-y-1">
                                                                 {(Array.isArray(getOrderItems(stop)) ? getOrderItems(stop) : []).map((item, itemIdx) => (
                                                                     <div key={itemIdx} className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                                                         <div className="flex items-center gap-1.5 flex-wrap">
                                                                             <span className="font-bold text-slate-800">• {item.product_type}</span>
                                                                             {(item.catalog_code || stop.catalog_code) && (
                                                                                 <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200" title={`Código SKU: ${item.catalog_code || stop.catalog_code}`}>
                                                                                     {item.catalog_code || stop.catalog_code}
                                                                                 </span>
                                                                             )}
                                                                             <span className="text-slate-500 text-[10px]">({item.presentation || 'cubeta 30LB'})</span>
                                                                             {(item.lot_code || stop.lot_code || stop.order_lot_code || stop.linked_batch_code) && (
                                                                                 <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] px-1.5 py-0.2 rounded">
                                                                                     Lote: {item.lot_code || stop.lot_code || stop.order_lot_code || stop.linked_batch_code}
                                                                                 </span>
                                                                             )}
                                                                         </div>
                                                                         <div className="text-right whitespace-nowrap">
                                                                             <span className="font-black text-indigo-700">{parseFloat(item.quantity_lbs || 0).toLocaleString()} Lbs</span>
                                                                             <span className="text-[10px] text-slate-500 ml-1">
                                                                                 ({getItemUnits(item).toLocaleString()} uds)
                                                                             </span>
                                                                         </div>
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                        </div>
                                                    </div>

                                                    {/* Controles para reordenar arriba/abajo y acciones */}
                                                    <div className="flex flex-col gap-1 flex-shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                const foundOrd = orders.find(o => o.id === stop.order_id);
                                                                const orderData = foundOrd || {
                                                                    ...stop,
                                                                    id: stop.order_id,
                                                                    order_number: stop.order_number,
                                                                    quantity_lbs: stop.quantity_lbs,
                                                                    price_per_lb: stop.price_per_lb,
                                                                    product_type: stop.product_type,
                                                                    presentation: stop.presentation,
                                                                    items_json: stop.items_json,
                                                                    batch_id: stop.batch_id || stop.order_batch_id,
                                                                    lot_code: stop.lot_code || stop.order_lot_code,
                                                                    customer_id: stop.customer_id,
                                                                    customer_branch_id: stop.customer_branch_id,
                                                                    notes: stop.order_notes || stop.notes
                                                                };
                                                                setEditingOrder(orderData);
                                                                setOrderModalOpen(true);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                                                            title="Editar pedido de esta parada (ajustar cantidades o lote)"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintOrderReceipt(stop.order_id)}
                                                            disabled={printingOrderId === stop.order_id}
                                                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded disabled:opacity-50"
                                                            title="Imprimir comprobante de entrega individual"
                                                        >
                                                            {printingOrderId === stop.order_id ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                            ) : (
                                                                <Printer className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                        {isStopBilled && stop.sale_id && (
                                                            <button
                                                                onClick={async () => {
                                                                    const toastId = toast.loading(`Enviando DTE a ${stop.customer_name}...`);
                                                                    try {
                                                                        await axios.post(`/api/sales/resend-email/${stop.sale_id}`);
                                                                        toast.success('DTE enviado exitosamente al correo del cliente.', { id: toastId });
                                                                    } catch (err) {
                                                                        toast.error(err.response?.data?.message || 'Error al enviar correo del DTE.', { id: toastId });
                                                                    }
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                                title="Enviar / Reenviar DTE oficial por correo al cliente"
                                                            >
                                                                <Mail className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveStopFromRoute(stop.id, stop.order_id)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                                            title="Quitar de esta ruta (volver a dejar pedido pendiente)"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            disabled={idx === 0}
                                                            onClick={() => handleMoveStop(idx, -1)}
                                                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                                                            title="Subir orden"
                                                        >
                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            disabled={idx === routeDetail.stops.length - 1}
                                                            onClick={() => handleMoveStop(idx, 1)}
                                                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                                                            title="Bajar orden"
                                                        >
                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: Mapa Interactivo de la Ruta (7 cols) */}
                            <div className="lg:col-span-7 space-y-4">
                                <DispatchRouteMap
                                    stops={routeDetail.stops || []}
                                    height="580px"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                            <Navigation className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="font-bold text-slate-700 text-base">No hay ninguna ruta seleccionada</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Seleccione una ruta en el menú superior o cree una nueva con los pedidos del día.
                            </p>
                        </div>
                    )}
                </div>
            )}</>);
}
