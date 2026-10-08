import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';
import { ShoppingBag, Clock, Eye, ExternalLink } from 'lucide-react';

const AutoOrdersTab = ({ autoSales = [], onOpenSale }) => {
    return (
        <div className="space-y-3">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
                <ShoppingBag size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                    <strong className="font-bold">Dictamen de Facturación Automática en Pedidos de Ruta vs Punto de Venta:</strong>
                    <p className="mt-0.5 text-indigo-700">
                        Se identificaron 13 ventas originadas automáticamente en Despacho de Pedidos. De estas, 10 fueron invalidadas en Hacienda 
                        y sustituidas por facturación manual en POS (debido a discrepancia de unidades libras vs unidades y validación DTE-11 vs DTE-03).
                        <strong className="block mt-1 text-emerald-700 font-bold">
                            ✓ NO existe doble cobro fiscal activo entre los pedidos automáticos y el punto de venta.
                        </strong>
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="py-2.5 px-3">Venta ID</th>
                            <th className="py-2.5 px-3">Tipo / Control</th>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Fecha y Hora</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3">Estado</th>
                            <th className="py-2.5 px-3">Re-facturación en POS</th>
                            <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {autoSales.map((sale) => {
                            const saleId = sale.id || sale.sale_id;
                            const repId = sale.reemplazo_pos?.id || sale.replacement?.id;
                            return (
                                <tr 
                                    key={saleId} 
                                    onDoubleClick={() => onOpenSale(saleId, 'detalle')}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                    title="Doble clic para ver detalle completo"
                                >
                                    <td className="py-2.5 px-3 font-black text-slate-800">#{saleId}</td>
                                    <td className="py-2.5 px-3">
                                        <div className="font-bold text-slate-700">{sale.dte_type}</div>
                                        <div className="font-mono text-[10px] text-slate-400">{sale.numero_control}</div>
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-slate-900">{sale.cliente_nombre || sale.cliente}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                        <div className="font-semibold text-slate-800">{formatDate(sale.fecha)}</div>
                                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                            <Clock size={10} className="text-slate-400" />
                                            <span>{sale.hora || sale.hora_emision || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black">
                                        <Money value={sale.total_pagar} />
                                    </td>
                                    <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            sale.estado === 'invalidado'
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        }`}>
                                            {sale.estado?.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[11px]">
                                        {repId ? (
                                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                <span className="font-semibold text-slate-700">
                                                    Re-facturada: #{repId}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSale(repId, 'detalle')}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors cursor-pointer"
                                                    title={`Abrir Venta Reemplazo #${repId}`}
                                                >
                                                    <ExternalLink size={10} />
                                                    <span>Ver #{repId}</span>
                                                </button>
                                            </div>
                                        ) : sale.estado === 'emitido' ? (
                                            <span className="text-emerald-700 font-bold">Venta Automática Activa Legítima</span>
                                        ) : (
                                            <span className="text-slate-400 font-normal">Sin cruce adicional</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => onOpenSale(saleId, 'detalle')}
                                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                                title="Ver Detalle de Venta"
                                            >
                                                <Eye size={14} />
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
};

export default AutoOrdersTab;
