import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';
import { AlertOctagon, Clock, Eye, Code, Terminal } from 'lucide-react';

const PhantomSalesTab = ({ phantomSales = [], onOpenSale }) => {
    return (
        <div className="space-y-3">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                <AlertOctagon size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                    <strong className="font-bold">Hallazgo de Ventas Locales sin Timbre Tributario:</strong>
                    <p className="mt-0.5 text-rose-700">
                        Ventas que figuran como <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">emitido</code> localmente pero Hacienda nunca emitió sello de recepción. 
                        En ambos casos, el operador re-facturó correctamente después y obtuvo sello legítimo. 
                        Haga <strong>doble clic</strong> o use las opciones a la derecha para inspeccionar la venta.
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
                            <th className="py-2.5 px-3">Estado Local</th>
                            <th className="py-2.5 px-3">Diagnóstico Forense</th>
                            <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {phantomSales.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="py-6 text-center text-slate-400 font-medium">
                                    No se encontraron ventas locales sin sello.
                                </td>
                            </tr>
                        ) : (
                            phantomSales.map((sale) => {
                                const saleId = sale.id || sale.sale_id;
                                return (
                                    <tr 
                                        key={saleId} 
                                        onDoubleClick={() => onOpenSale(saleId, 'detalle')}
                                        className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                                        title="Doble clic para ver detalle completo"
                                    >
                                        <td className="py-2.5 px-3 font-black text-slate-800">#{saleId}</td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-bold text-slate-700">{sale.dte_type}</div>
                                            <div className="font-mono text-[10px] text-slate-400">{sale.numero_control}</div>
                                        </td>
                                        <td className="py-2.5 px-3 font-medium text-slate-900">{sale.cliente_nombre}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <div className="font-semibold text-slate-800">{formatDate(sale.fecha)}</div>
                                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                                <Clock size={10} className="text-slate-400" />
                                                <span>{sale.hora || sale.hora_emision || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-rose-700">
                                            <Money value={sale.total_pagar} />
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                                                SIN SELLO MH
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs">
                                            {sale.diagnostico || 'Venta local sin sello de recepción MH.'}
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
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSale(saleId, 'json')}
                                                    className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                                    title="Ver JSON DTE"
                                                >
                                                    <Code size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSale(saleId, 'respuesta')}
                                                    className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                                                    title="Ver Respuesta Hacienda"
                                                >
                                                    <Terminal size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PhantomSalesTab;
