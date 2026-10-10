import { formatDate } from '../../../utils/dateUtils';
import Modal from '../../ui/Modal';
import Money from '../../ui/Money';
import {
    Plus,
    Sparkles,
    Trash2,
    Edit3,
    CalendarCheck
} from 'lucide-react';




export default function ProductionCalendarSection7({ model }) {
    const { customerOrders, isOrdersModalOpen, setIsOrdersModalOpen, setIsCustomerOrderModalOpen, setSelectedOrderToEdit, setHoverPreview, handleDeleteOrder, handleOpenAlterDateModal } = model;

    return (<Modal
                isOpen={isOrdersModalOpen}
                onClose={() => setIsOrdersModalOpen(false)}
                title="Pedidos de Clientes (Ovoproductos)"
                maxWidth="max-w-4xl"
            >
                <div className="space-y-4">
                    {/* Barra Superior con botón para Registrar Nuevo Pedido */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                <span>Pedidos de Clientes Programados</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Total de pedidos registrados: <strong>{customerOrders.length}</strong>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedOrderToEdit(null);
                                setIsCustomerOrderModalOpen(true);
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl shadow hover:bg-indigo-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>+ Registrar Nuevo Pedido</span>
                        </button>
                    </div>

                    {/* Tabla de Pedidos */}
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs">
                        <table className="w-full text-left text-xs min-w-[750px]">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-2.5">Cliente</th>
                                    <th className="px-3 py-2.5">Producto / Presentación</th>
                                    <th className="px-3 py-2.5 text-right">Cantidad (Lbs)</th>
                                    <th className="px-3 py-2.5 text-right">Precio ($/Lb)</th>
                                    <th className="px-3 py-2.5">Lote Vinculado</th>
                                    <th className="px-3 py-2.5">Entrega</th>
                                    <th className="px-3 py-2.5">Estado</th>
                                    <th className="px-3 py-2.5 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400 font-medium">
                                            No hay pedidos registrados todavía.
                                        </td>
                                    </tr>
                                ) : (
                                    (Array.isArray(customerOrders) ? customerOrders : []).map(order => (
                                        <tr
                                            key={order.id}
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setHoverPreview({ type: 'order', data: order, rect });
                                            }}
                                            onMouseLeave={() => setHoverPreview(null)}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-900">{order.customer_name}</div>
                                                {order.customer_id && (
                                                    <span className="text-[10px] text-slate-400 font-normal block">
                                                        Cliente ID #{order.customer_id}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="text-slate-800 font-semibold">{order.product_type}</div>
                                                <div className="text-[10px] text-slate-500">{order.presentation}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-indigo-600 whitespace-nowrap">
                                                {parseFloat(order.quantity_lbs || 0).toLocaleString()} Lbs
                                            </td>
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                <span className="font-bold text-slate-800">
                                                    <Money value={order.price_per_lb} />
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-normal">/ Lb</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {order.linked_batch_code || order.lot_code ? (
                                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        {order.linked_batch_code || order.lot_code}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">Sin lote</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                                                {order.required_delivery_date ? formatDate(order.required_delivery_date) : 'N/A'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                    {order.delivery_status || order.status || 'pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedOrderToEdit(order);
                                                            setIsCustomerOrderModalOpen(true);
                                                        }}
                                                        className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                                                        title="Editar pedido"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAlterDateModal('order', order)}
                                                        className="p-1 hover:bg-amber-50 text-amber-700 rounded transition-colors"
                                                        title="Alterar fecha de entrega"
                                                    >
                                                        <CalendarCheck className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                                                        title="Eliminar pedido"
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
            </Modal>);
}
