import { getTodayString } from '../../../../utils/dateUtils';
import Money from '../../../ui/Money';
import {
    Truck,
    CheckCircle2,
    Plus,
    RefreshCw,
    Trash2,
    Edit3,
    Printer,
    Search,
    X,
    Receipt
} from 'lucide-react';


export default function EggDispatchCalendarioTab({ model }) {
    const { activeTab, loading, selectedDate, setSelectedDate, dateFilterMode, setDateFilterMode, clientFilter, setClientFilter, setOrderModalOpen, setEditingOrder, orderStatusFilter, setOrderStatusFilter, orderPriorityFilter, setOrderPriorityFilter, printingOrderId, handlePrintOrderReceipt, getOrderItems, getOrderTotalUnits, handleDeleteOrder, handleOpenCreateRoute, filteredOrders, ordersByDate } = model;

    return (<>{activeTab === 'calendario' && (
                <div className="space-y-4">
                    {/* Barra de Filtros y Fechas */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Fecha y Modos de Visualización (Día, Semana, Mes, Todos) */}
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">
                                    Fecha Entrega:
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(getTodayString(new Date()))}
                                    className="text-xs font-semibold text-indigo-600 hover:underline px-1"
                                >
                                    Hoy
                                </button>

                                {/* Selector de Rango */}
                                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold ml-1">
                                    <button
                                        type="button"
                                        onClick={() => setDateFilterMode('dia')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${dateFilterMode === 'dia' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Día
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDateFilterMode('semana')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${dateFilterMode === 'semana' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Semana
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDateFilterMode('mes')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${dateFilterMode === 'mes' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Mes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDateFilterMode('todos')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${dateFilterMode === 'todos' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Todos
                                    </button>
                                </div>
                            </div>

                            {/* Botón Registrar Nuevo Pedido */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingOrder(null);
                                        setOrderModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl shadow transition hover:bg-indigo-700"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Nuevo Pedido</span>
                                </button>

                                {/* Botón Crear Ruta con Pedidos del Día Seleccionado */}
                                {ordersByDate[selectedDate]?.filter(o => o.delivery_status !== 'entregado' && !o.dispatch_route_id).length > 0 && (
                                    <button
                                        onClick={() => {
                                            const unassignedIds = (Array.isArray(ordersByDate[selectedDate]
                                                .filter(o => o.delivery_status !== 'entregado' && !o.dispatch_route_id)) ? ordersByDate[selectedDate]
                                                .filter(o => o.delivery_status !== 'entregado' && !o.dispatch_route_id) : [])
                                                .map(o => o.id);
                                            handleOpenCreateRoute(selectedDate, unassignedIds);
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3.5 py-2 rounded-xl shadow transition hover:bg-emerald-700"
                                    >
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>Ruta con {ordersByDate[selectedDate].filter(o => o.delivery_status !== 'entregado' && !o.dispatch_route_id).length} pedidos</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Fila Secundaria: Filtro por Cliente, Estado y Prioridad */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                            {/* Buscador de Cliente */}
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Filtrar por cliente..."
                                    value={clientFilter}
                                    onChange={(e) => setClientFilter(e.target.value)}
                                    className="w-full text-xs font-semibold pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-indigo-500"
                                />
                                {clientFilter && (
                                    <button
                                        type="button"
                                        onClick={() => setClientFilter('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filtro Estado */}
                            <select
                                value={orderStatusFilter}
                                onChange={(e) => setOrderStatusFilter(e.target.value)}
                                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 outline-none"
                            >
                                <option value="todos">Todos los estados</option>
                                <option value="pendiente">Pendientes</option>
                                <option value="en_ruta">En Ruta</option>
                                <option value="entregado">Entregados</option>
                            </select>

                            {/* Filtro Prioridad */}
                            <select
                                value={orderPriorityFilter}
                                onChange={(e) => setOrderPriorityFilter(e.target.value)}
                                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 outline-none"
                            >
                                <option value="todos">Todas las prioridades</option>
                                <option value="urgente">🔴 Urgentes</option>
                                <option value="alta">🟡 Altas</option>
                                <option value="normal">🔵 Normales</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabla de Pedidos */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Pedidos Programados para Entrega
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Total de pedidos listados: {filteredOrders.length}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                                        <th className="p-3">Fecha Requerida</th>
                                        <th className="p-3">Prioridad</th>
                                        <th className="p-3">Cliente / Sucursal</th>
                                        <th className="p-3">Producto / Presentación</th>
                                        <th className="p-3 text-right">Cantidad Lbs</th>
                                        <th className="p-3 text-right">Unidades</th>
                                        <th className="p-3 text-right">Precio / Lb</th>
                                        <th className="p-3">Estado / Ruta</th>
                                        <th className="p-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="9" className="p-8 text-center text-slate-400 font-medium">
                                                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-indigo-600 mb-2" />
                                                Cargando pedidos de clientes...
                                            </td>
                                        </tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="p-8 text-center text-slate-400 font-medium">
                                                No hay pedidos que coincidan con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (

                                        (Array.isArray(filteredOrders) ? filteredOrders : []).map((ord) => (
                                            <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                                                <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                                                    {ord.required_delivery_date ? ord.required_delivery_date.split('T')[0] : 'N/A'}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                        ord.priority === 'urgente'
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : ord.priority === 'alta'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                        {ord.priority || 'Normal'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900">{ord.customer_name}</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        📍 {ord.branch_name || 'Sucursal Principal'}
                                                        {ord.branch_contact_person && ` | Preguntar por: ${ord.branch_contact_person}`}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {(Array.isArray(getOrderItems(ord)) ? getOrderItems(ord) : []).map((item, itemIdx) => (
                                                        <div key={itemIdx} className="mb-1.5 last:mb-0">
                                                            <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                                <span>{item.product_type}</span>
                                                                {(item.catalog_code || ord.catalog_code) && (
                                                                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200" title={`Código SKU Catálogo: ${item.catalog_code || ord.catalog_code}`}>
                                                                        {item.catalog_code || ord.catalog_code}
                                                                    </span>
                                                                )}
                                                                {getOrderItems(ord).length > 1 && (
                                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                                                        {parseFloat(item.quantity_lbs || 0).toLocaleString()} Lbs
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">{item.presentation}</div>
                                                            {(item.lot_code || ord.linked_batch_code || ord.lot_code) && (
                                                                <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                                                    Lote: {item.lot_code || ord.linked_batch_code || ord.lot_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </td>
                                                <td className="p-3 text-right font-black text-indigo-700 whitespace-nowrap">
                                                    {parseFloat(ord.quantity_lbs || 0).toLocaleString()} Lbs
                                                </td>
                                                <td className="p-3 text-right font-bold text-slate-700 whitespace-nowrap">
                                                    {getOrderTotalUnits(ord).toLocaleString()} Uds
                                                </td>
                                                <td className="p-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    <Money amount={parseFloat(ord.price_per_lb || 0)} />
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <div className="space-y-1">
                                                        {ord.delivery_status === 'entregado' ? (
                                                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md flex items-center gap-1 w-max">
                                                                <CheckCircle2 className="w-3 h-3" /> Entregado
                                                            </span>
                                                        ) : ord.dispatch_route_id ? (
                                                            <span className="text-[10px] font-black bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-md flex items-center gap-1 w-max">
                                                                <Truck className="w-3 h-3" /> {ord.codigo_ruta || 'En Ruta'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md w-max block">
                                                                Pendiente Despacho
                                                            </span>
                                                        )}

                                                        {/* Badge de Facturación Anti-Refacturación */}
                                                        {ord.is_billed || ord.sale_id || ord.dte_codigo_generacion ? (
                                                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-md flex items-center gap-1 w-max shadow-2xs">
                                                                <Receipt className="w-3 h-3 text-emerald-600" />
                                                                <span>Facturado {ord.sale_numero_control ? `#${ord.sale_numero_control}` : ''}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-400 block pl-0.5">
                                                                Sin Facturar
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingOrder(ord);
                                                                setOrderModalOpen(true);
                                                            }}
                                                            title="Editar Pedido (ajustar productos, cantidades o lote)"
                                                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintOrderReceipt(ord.id)}
                                                            disabled={printingOrderId === ord.id}
                                                            title="Imprimir Comprobante de Entrega / Despacho"
                                                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition disabled:opacity-50"
                                                        >
                                                            {printingOrderId === ord.id ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                            ) : (
                                                                <Printer className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOrder(ord.id)}
                                                            title="Eliminar Pedido"
                                                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
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
