import { formatDate } from '../../../utils/dateUtils';
import {
    Fuel,
    X,
    CreditCard,
    Calendar,
    FileText,
    Eye,
    PackageCheck,
    Clock,
    CheckCircle2,
    Info,
} from 'lucide-react';
import Money from '../../ui/Money';

function formatNumber(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-SV', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calculateOrderCost(order) {
    if (!order) return 0;
    if (order.estado === 'RECIBIDO' && parseFloat(order.pago) > 0) {
        return parseFloat(order.pago);
    }
    const flete = parseFloat(order.flete) || 0;
    const isReceived = order.estado === 'RECIBIDO';
    const dGal = isReceived && parseFloat(order.r_diesel) > 0 ? parseFloat(order.r_diesel) : (parseFloat(order.p_diesel) || 0);
    const rGal = isReceived && parseFloat(order.r_regular) > 0 ? parseFloat(order.r_regular) : (parseFloat(order.p_regular) || 0);
    const sGal = isReceived && parseFloat(order.r_super) > 0 ? parseFloat(order.r_super) : (parseFloat(order.p_super) || 0);
    const iGal = isReceived && parseFloat(order.r_ion) > 0 ? parseFloat(order.r_ion) : (parseFloat(order.p_ion) || 0);

    const cD = (parseFloat(order.costo_d) || 0) + flete;
    const cR = (parseFloat(order.costo_r) || 0) + flete;
    const cS = (parseFloat(order.costo_s) || 0) + flete;
    const cI = (parseFloat(order.costo_i) || 0) + flete;

    return (dGal * cD) + (rGal * cR) + (sGal * cS) + (iGal * cI);
}

function getStatusBadge(estado) {
    const est = String(estado || '').toUpperCase();
    if (est === 'PENDIENTE') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                PENDIENTE
            </span>
        );
    }
    if (est === 'VISTO') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <Eye className="w-3.5 h-3.5" />
                VISTO
            </span>
        );
    }
    if (est === 'RECIBIDO') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                RECIBIDO
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3.5 h-3.5" />
            {est || 'OTRO'}
        </span>
    );
}

export default function GasOrderDetailModal({
    open,
    order,
    onClose,
    onMarkSeen,
    onReceive,
}) {
    if (!open || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Fuel className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                Pedido #{order.numero || order.id}
                                {getStatusBadge(order.estado)}
                            </h3>
                            <p className="text-xs text-slate-500">
                                Fecha: {formatDate(order.fecha)} · Estación RRS: {order.id_estacion}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-5 text-xs">
                    {/* Fuel Comparison Table */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase">Desglose de Combustible y Costos</h4>
                            {parseFloat(order.flete) > 0 && (
                                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    Flete aplicado: <Money value={order.flete} digits={4} /> /gln
                                </span>
                            )}
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Producto</th>
                                        <th className="py-2.5 px-3 text-right">Gal. Pedidos</th>
                                        <th className="py-2.5 px-3 text-right">Gal. Recibidos</th>
                                        <th className="py-2.5 px-3 text-right">Costo /gln</th>
                                        <th className="py-2.5 px-3 text-right">Flete /gln</th>
                                        <th className="py-2.5 px-3 text-right">Costo Efectivo</th>
                                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                    <tr>
                                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                                            Diésel
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                            {formatNumber(order.p_diesel)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            {formatNumber(order.r_diesel)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            <Money value={order.costo_d || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-500">
                                            <Money value={order.flete || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                            <Money value={(parseFloat(order.costo_d) || 0) + (parseFloat(order.flete) || 0)} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                            <Money value={(parseFloat(order.estado === 'RECIBIDO' && parseFloat(order.r_diesel) > 0 ? order.r_diesel : order.p_diesel) || 0) * ((parseFloat(order.costo_d) || 0) + (parseFloat(order.flete) || 0))} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                            Regular
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                            {formatNumber(order.p_regular)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            {formatNumber(order.r_regular)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            <Money value={order.costo_r || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-500">
                                            <Money value={order.flete || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                            <Money value={(parseFloat(order.costo_r) || 0) + (parseFloat(order.flete) || 0)} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-amber-800">
                                            <Money value={(parseFloat(order.estado === 'RECIBIDO' && parseFloat(order.r_regular) > 0 ? order.r_regular : order.p_regular) || 0) * ((parseFloat(order.costo_r) || 0) + (parseFloat(order.flete) || 0))} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                            Súper
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                            {formatNumber(order.p_super)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            {formatNumber(order.r_super)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                            <Money value={order.costo_s || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-500">
                                            <Money value={order.flete || 0} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                            <Money value={(parseFloat(order.costo_s) || 0) + (parseFloat(order.flete) || 0)} digits={4} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-rose-800">
                                            <Money value={(parseFloat(order.estado === 'RECIBIDO' && parseFloat(order.r_super) > 0 ? order.r_super : order.p_super) || 0) * ((parseFloat(order.costo_s) || 0) + (parseFloat(order.flete) || 0))} />
                                        </td>
                                    </tr>
                                    {parseFloat(order.p_ion) > 0 && (
                                        <tr>
                                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                                Ion Diésel
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                {formatNumber(order.p_ion)} gln
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-600">
                                                {formatNumber(order.r_ion)} gln
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-600">
                                                <Money value={order.costo_i || 0} digits={4} />
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">
                                                <Money value={order.flete || 0} digits={4} />
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                                <Money value={(parseFloat(order.costo_i) || 0) + (parseFloat(order.flete) || 0)} digits={4} />
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-indigo-800">
                                                <Money value={(parseFloat(order.estado === 'RECIBIDO' && parseFloat(order.r_ion) > 0 ? order.r_ion : order.p_ion) || 0) * ((parseFloat(order.costo_i) || 0) + (parseFloat(order.flete) || 0))} />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold font-mono border-t border-slate-200">
                                    <tr>
                                        <td className="py-2.5 px-3 font-sans text-slate-800">Total</td>
                                        <td className="py-2.5 px-3 text-right text-indigo-700">
                                            {formatNumber(order.total_galones)} gln
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-emerald-700">
                                            {formatNumber(
                                                (parseFloat(order.r_diesel) || 0) +
                                                (parseFloat(order.r_regular) || 0) +
                                                (parseFloat(order.r_super) || 0) +
                                                (parseFloat(order.r_ion) || 0)
                                            )} gln
                                        </td>
                                        <td colSpan={3} className="py-2.5 px-3 text-right font-sans text-slate-500 text-[11px] uppercase">
                                            Total Estimado / Facturado:
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold text-sm">
                                            <Money value={calculateOrderCost(order)} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Payment & Discharge Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5" />
                                Forma de Pago / Bancos
                            </span>
                            <p className="text-slate-800 font-medium leading-relaxed">
                                {order.forma_pago || 'No especificada'}
                            </p>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Fecha de Descarga
                            </span>
                            <p className="text-slate-800 font-medium">
                                {order.fecha_descarga || 'No registrada'}
                            </p>
                        </div>
                    </div>

                    {/* Document, Notes & Observations */}
                    {(order.documento || order.observacion || order.ncr_numero) && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                Documentos y Observaciones
                            </span>
                            {order.documento && (
                                <p className="text-slate-700">
                                    <strong>Documento / Remisión:</strong> {order.documento}
                                </p>
                            )}
                            {order.ncr_numero && (
                                <p className="text-slate-700">
                                    <strong>Notas de Crédito:</strong> #{order.ncr_numero}{' '}
                                    {parseFloat(order.ncr_monto) > 0 && (
                                        <span className="text-emerald-700 font-bold">
                                            (<Money value={order.ncr_monto} />)
                                        </span>
                                    )}
                                </p>
                            )}
                            {order.observacion && (
                                <p className="text-slate-600 italic">
                                    "{order.observacion}"
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {String(order.estado || '').toUpperCase() === 'PENDIENTE' && onMarkSeen && (
                            <button
                                onClick={() => onMarkSeen(order)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Marcar como Visto</span>
                            </button>
                        )}

                        {String(order.estado || '').toUpperCase() === 'VISTO' && onReceive && (
                            <button
                                onClick={() => onReceive(order)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                            >
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Recibir Pedido</span>
                            </button>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
