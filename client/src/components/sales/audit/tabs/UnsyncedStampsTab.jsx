import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';
import { Link2, Clock, Eye, Code, Terminal } from 'lucide-react';

const UnsyncedStampsTab = ({ unsyncedStamps = [], onOpenSale, onSyncStamps, isSyncing = false }) => {
    return (
        <div className="space-y-3">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <Link2 size={18} className="text-sky-600 shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-bold">Sellos de Hacienda Existentes pero no Enlazados a la Cabecera:</strong>
                        <p className="mt-0.5 text-sky-700">
                            Estas ventas fueron transmitidas con éxito y su sello está guardado en la tabla <code className="bg-sky-100 px-1 py-0.5 rounded font-mono">dtes</code>, 
                            pero el campo local de la venta no se actualizó. Puede enlazarlos inmediatamente con el botón de sincronización o hacer doble clic para ver el detalle.
                        </p>
                    </div>
                </div>
                {unsyncedStamps.length > 0 && (
                    <button
                        type="button"
                        onClick={onSyncStamps}
                        disabled={isSyncing}
                        className="shrink-0 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Sellos Ahora'}
                    </button>
                )}
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
                            <th className="py-2.5 px-3">Sello Encontrado en DTEs</th>
                            <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {unsyncedStamps.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="py-6 text-center text-emerald-600 font-bold">
                                    ✓ Todos los sellos de recepción están sincronizados correctamente.
                                </td>
                            </tr>
                        ) : (
                            unsyncedStamps.map((item) => {
                                const saleId = item.id || item.sale_id;
                                return (
                                    <tr 
                                        key={saleId} 
                                        onDoubleClick={() => onOpenSale(saleId, 'detalle')}
                                        className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                                        title="Doble clic para ver detalle completo"
                                    >
                                        <td className="py-2.5 px-3 font-black text-slate-800">#{saleId}</td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-bold text-slate-700">{item.dte_type}</div>
                                            <div className="font-mono text-[10px] text-slate-400">{item.numero_control}</div>
                                        </td>
                                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.cliente_nombre}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <div className="font-semibold text-slate-800">{formatDate(item.fecha)}</div>
                                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                                <Clock size={10} className="text-slate-400" />
                                                <span>{item.hora || item.hora_emision || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-sky-800">
                                            <Money value={item.total_pagar} />
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                            {item.sello_encontrado}
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

export default UnsyncedStampsTab;
