import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';
import { AlertTriangle, Clock, Eye } from 'lucide-react';

const DuplicatesTab = ({ suspiciousDuplicates = [], onOpenSale }) => {
    return (
        <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <strong className="font-bold">Alerta de Posible Doble Facturación ante el Ministerio de Hacienda:</strong>
                    <p className="mt-0.5 text-amber-700">
                        Ventas con el mismo cliente, idéntico monto y fecha que cuentan con dos sellos de recepción legítimos y vigentes.
                        Haga <strong>doble clic</strong> o use los botones de cada venta para ver sus detalles en el sistema.
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Monto</th>
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Venta 1 (Primer Envío)</th>
                            <th className="py-2.5 px-3">Venta 2 (Segundo Envío)</th>
                            <th className="py-2.5 px-3">Acción Recomendada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {suspiciousDuplicates.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="py-6 text-center text-slate-400 font-medium">
                                    No se encontraron duplicados sospechosos en Hacienda.
                                </td>
                            </tr>
                        ) : (
                            suspiciousDuplicates.map((dup, idx) => {
                                const id1 = dup.id1 || dup.venta_1?.id;
                                const id2 = dup.id2 || dup.venta_2?.id;
                                return (
                                    <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-slate-900">{dup.cliente}</td>
                                        <td className="py-2.5 px-3 font-black text-amber-700">
                                            <Money value={dup.monto || dup.total} />
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <div className="font-semibold text-slate-800">{formatDate(dup.fecha)}</div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                Δ {dup.diff_minutos ? `${dup.diff_minutos} min` : 'Misma fecha'}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                                                <div>
                                                    <div className="font-black text-slate-800">#{id1}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                        <Clock size={10} className="text-slate-400" />
                                                        <span>{dup.hora1 || dup.venta_1?.hora || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSale(id1, 'detalle')}
                                                    className="p-1 hover:bg-white text-indigo-600 rounded shadow-xs border border-indigo-200 cursor-pointer"
                                                    title="Ver Venta 1"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                                                <div>
                                                    <div className="font-black text-slate-800">#{id2}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                        <Clock size={10} className="text-slate-400" />
                                                        <span>{dup.hora2 || dup.venta_2?.hora || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSale(id2, 'detalle')}
                                                    className="p-1 hover:bg-white text-indigo-600 rounded shadow-xs border border-indigo-200 cursor-pointer"
                                                    title="Ver Venta 2"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-[11px] text-amber-800 font-medium">
                                            {dup.accion_recomendada || 'Verificar entrega física o emitir evento de invalidación ante MH.'}
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

export default DuplicatesTab;
