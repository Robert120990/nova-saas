import { Printer, X, ShieldCheck, Clock, User } from 'lucide-react';
import Money from '../../../../components/ui/Money';
import { formatDateTime } from '../../../../utils/dateUtils';

export default function OrderDetailModal({
    isOpen,
    onClose,
    order,
    onReprintTicket
}) {
    if (!isOpen || !order) return null;

    const items = Array.isArray(order.items) ? order.items : [];
    const isDte = Boolean(order.codigo_generacion);
    const finalTotal = Number(order.total_with_tip || order.subtotal || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                            Detalle de Comanda
                        </span>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <span>Comanda #{order.id}</span>
                            {order.table_number && (
                                <span className="bg-indigo-500/30 text-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    Mesa {order.table_number} {order.area_name ? `(${order.area_name})` : ''}
                                </span>
                            )}
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/20 capitalize">
                                {order.status}
                            </span>
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                    {/* Metadatos de la orden */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Atendida por:</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1 pt-0.5">
                                <User size={12} className="text-indigo-600" />
                                {order.waiter_name || 'Personal Staff'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Apertura:</span>
                            <span className="font-medium text-slate-700 flex items-center gap-1 pt-0.5">
                                <Clock size={12} className="text-slate-400" />
                                {formatDateTime(order.opened_at)}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Cierre / Facturación:</span>
                            <span className="font-medium text-slate-700">
                                {order.closed_at ? formatDateTime(order.closed_at) : 'En curso'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Modalidad:</span>
                            <span className="font-bold text-slate-800 uppercase">
                                {order.order_type === 'mesa' ? 'Comedor (Mesa)' : (order.order_type === 'para_llevar' ? 'Para Llevar' : 'Delivery')}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta de DTE Fiscal si existe */}
                    {isDte && (
                        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                                <ShieldCheck size={16} />
                                <span>Documento Tributario Electrónico (DTE Emitido)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                                <div>
                                    <span className="text-slate-500 font-bold block">Tipo & N° de Control:</span>
                                    <span className="font-mono font-black text-slate-900">
                                        {order.dte_type === '03' ? 'Crédito Fiscal (03)' : 'Factura (01)'} • {order.numero_control}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold block">Código de Generación:</span>
                                    <span className="font-mono text-slate-800 break-all select-all">
                                        {order.codigo_generacion}
                                    </span>
                                </div>
                                {order.sello_recepcion && (
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-500 font-bold block">Sello de Recepción Hacienda:</span>
                                        <span className="font-mono text-emerald-700 break-all select-all font-bold">
                                            {order.sello_recepcion}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tabla de Productos / Consumo */}
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                            Detalle de Consumo ({items.length} partidas)
                        </span>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                                    <tr>
                                        <th className="py-2 px-3 text-center">Cant.</th>
                                        <th className="py-2 px-3">Producto / Notas</th>
                                        <th className="py-2 px-3">Estación</th>
                                        <th className="py-2 px-3 text-right">P. Unit</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((it) => {
                                        const mods = Array.isArray(it.selected_modifiers) ? it.selected_modifiers : [];
                                        const lineTotal = (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);

                                        return (
                                            <tr key={it.id} className="hover:bg-slate-50/50">
                                                <td className="py-2 px-3 text-center font-bold text-slate-800">
                                                    {it.quantity}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <div className="font-bold text-slate-900">{it.product_name}</div>
                                                    {mods.length > 0 && (
                                                        <div className="text-[10px] text-indigo-600">
                                                            {mods.map(m => m.name || m.nombre).join(', ')}
                                                        </div>
                                                    )}
                                                    {it.notes && (
                                                        <div className="text-[10px] text-amber-600 italic">
                                                            Nota: {it.notes}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-slate-500">
                                                    {it.station_name || 'Cocina'}
                                                </td>
                                                <td className="py-2 px-3 text-right text-slate-600">
                                                    <Money value={it.unit_price} />
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                    <Money value={lineTotal} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Resumen de Liquidación */}
                    <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Subtotal Consumo:</span>
                            <span className="text-white font-medium"><Money value={order.subtotal || 0} /></span>
                        </div>
                        {Number(order.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-xs text-rose-400">
                                <span>Descuento aplicado:</span>
                                <span>-<Money value={order.discount_amount} /></span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs text-indigo-300">
                            <span>Propina Voluntaria:</span>
                            <span>+<Money value={order.tip_amount || 0} /></span>
                        </div>
                        <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
                            <span className="text-xs font-bold text-slate-300 uppercase">Total Liquidado:</span>
                            <span className="text-lg font-black text-emerald-400"><Money value={finalTotal} /></span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => onReprintTicket(order)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-white flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Printer size={14} />
                        <span>Imprimir Ticket</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
