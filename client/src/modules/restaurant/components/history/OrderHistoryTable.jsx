import { Eye, Printer, FileText, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import Money from '../../../../components/ui/Money';
import { formatDateTime } from '../../../../utils/dateUtils';

const STATUS_BADGES = {
    facturada: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Facturada', icon: CheckCircle2 },
    abierta: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Abierta', icon: Clock },
    en_cocina: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'En Cocina', icon: AlertCircle },
    lista: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Lista para Servir', icon: CheckCircle2 },
    cancelada: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelada', icon: XCircle }
};

export default function OrderHistoryTable({
    orders = [],
    isLoading = false,
    onViewDetail,
    onReprintTicket
}) {
    if (isLoading) {
        return (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-500">Cargando historial de comandas...</p>
            </div>
        );
    }

    if (!Array.isArray(orders) || orders.length === 0) {
        return (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
                <FileText size={32} className="mx-auto text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">No se encontraron comandas</h3>
                <p className="text-xs text-slate-400">Intenta ajustando el rango de fechas, estado o criterio de búsqueda.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <th className="py-3 px-4">Comanda</th>
                            <th className="py-3 px-4">Mesa / Tipo</th>
                            <th className="py-3 px-4">Mesero</th>
                            <th className="py-3 px-4 text-center">Estado</th>
                            <th className="py-3 px-4">Comprobante Fiscal</th>
                            <th className="py-3 px-4 text-right">Consumo</th>
                            <th className="py-3 px-4 text-right">Propina</th>
                            <th className="py-3 px-4 text-right">Total</th>
                            <th className="py-3 px-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {orders.map((o) => {
                            const badge = STATUS_BADGES[o.status] || STATUS_BADGES.abierta;
                            const BadgeIcon = badge.icon;
                            const isDte = Boolean(o.codigo_generacion);
                            const finalTotal = Number(o.total_with_tip || o.subtotal || 0);

                            return (
                                <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                                    {/* Comanda e info temporal */}
                                    <td className="py-3 px-4">
                                        <div className="font-black text-slate-900">#{o.id}</div>
                                        <span className="text-[10px] text-slate-400 block">
                                            {formatDateTime(o.opened_at)}
                                        </span>
                                    </td>

                                    {/* Mesa o Tipo */}
                                    <td className="py-3 px-4">
                                        {o.order_type === 'mesa' ? (
                                            <div>
                                                <span className="font-bold text-slate-800">
                                                    Mesa {o.table_number || 'S/N'}
                                                </span>
                                                {o.area_name && (
                                                    <span className="text-[10px] text-slate-400 block">
                                                        {o.area_name}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                                {o.order_type === 'para_llevar' ? 'Para Llevar' : 'Delivery'}
                                            </span>
                                        )}
                                        {o.customer_name && (
                                            <span className="text-[10px] text-indigo-600 block truncate max-w-[140px]" title={o.customer_name}>
                                                {o.customer_name}
                                            </span>
                                        )}
                                    </td>

                                    {/* Mesero */}
                                    <td className="py-3 px-4 font-medium text-slate-700">
                                        {o.waiter_name || 'Staff'}
                                    </td>

                                    {/* Estado */}
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                                            <BadgeIcon size={11} />
                                            <span>{badge.label}</span>
                                        </span>
                                    </td>

                                    {/* Comprobante / DTE */}
                                    <td className="py-3 px-4">
                                        {isDte ? (
                                            <div>
                                                <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    {o.dte_type === '03' ? 'Crédito Fiscal (03)' : 'Factura (01)'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[180px]" title={o.numero_control || o.codigo_generacion}>
                                                    {o.numero_control || o.codigo_generacion?.slice(0, 15) + '...'}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic">
                                                {o.status === 'facturada' ? 'Sin DTE (Interno)' : 'Pendiente'}
                                            </span>
                                        )}
                                    </td>

                                    {/* Consumo */}
                                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                                        <Money value={o.subtotal || 0} />
                                        <span className="text-[9px] text-slate-400 block">
                                            {o.total_items || (Array.isArray(o.items) ? o.items.length : 0)} ítems
                                        </span>
                                    </td>

                                    {/* Propina */}
                                    <td className="py-3 px-4 text-right font-bold text-indigo-600">
                                        {Number(o.tip_amount || 0) > 0 ? (
                                            <Money value={o.tip_amount} />
                                        ) : (
                                            <span className="text-slate-300 font-normal">$ -</span>
                                        )}
                                    </td>

                                    {/* Total */}
                                    <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                                        <Money value={finalTotal} />
                                    </td>

                                    {/* Acciones */}
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onViewDetail(o)}
                                                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                title="Ver Detalle Completo"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onReprintTicket(o)}
                                                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                                title="Reimprimir Ticket / Pre-cuenta"
                                            >
                                                <Printer size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
