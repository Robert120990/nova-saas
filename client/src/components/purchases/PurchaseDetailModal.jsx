import { Eye, X } from 'lucide-react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

export default function PurchaseDetailModal({
    isOpen,
    onClose,
    purchase,
    detail,
    loading = false
}) {
    if (!isOpen || !purchase) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                            <Eye size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest leading-none">Detalle de Compra</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref: {purchase.numero_documento}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={16} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {loading ? (
                        <div className="py-20 text-center space-y-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando información detallada...</p>
                        </div>
                    ) : detail && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</label>
                                    <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{detail.provider_nombre}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sucursal</label>
                                    <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{detail.branch_nombre}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
                                    <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{formatDate(detail.fecha)}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tipo Documento</label>
                                    <p className="text-[11px] font-bold text-indigo-600 uppercase leading-tight">{detail.tipo_documento_nombre || purchase.tipo_documento_nombre || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Documento / Cód. Generación</label>
                                    <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">{detail.numero_documento}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Número de Control</label>
                                    <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">{detail.numero_control || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Condición</label>
                                    <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight">
                                        {detail.condicion_operacion_nombre || (String(detail.condicion_operacion_id) === '2' ? 'Crédito' : String(detail.condicion_operacion_id) === '1' ? 'Contado' : '---')}
                                        {String(detail.condicion_operacion_id) === '2' && Number(detail.dias_credito) > 0 && (
                                            <span className="text-slate-500 font-semibold ml-1">({detail.dias_credito} días)</span>
                                        )}
                                    </p>
                                    {String(detail.condicion_operacion_id) === '2' && detail.fecha_vencimiento && (
                                        <p className="text-[8px] font-bold text-amber-600 uppercase mt-0.5">
                                            Vence: {formatDate(detail.fecha_vencimiento)}
                                        </p>
                                    )}
                                </div>
                                {detail.num_quedan && (
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">N° Quedan</label>
                                        <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">
                                            {detail.num_quedan}
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${detail.status === 'ANULADO' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {detail.status}
                                    </span>
                                </div>
                                {detail.observaciones && (
                                    <div className="space-y-1 col-span-2 md:col-span-3">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Observaciones</label>
                                        <p className="text-[11px] font-medium text-slate-600 leading-tight bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                                            {detail.observaciones}
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-1 col-span-2 md:col-span-3">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sello de Recepción (MH)</label>
                                    <p className="text-[11px] font-mono text-slate-700 uppercase leading-tight break-all bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                                        {detail.sello_recepcion || 'NO REGISTRADO'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8">
                                <label className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 block border-b border-slate-100 pb-2">Productos Comprados</label>
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-4 py-2">Producto</th>
                                                <th className="px-4 py-2 text-right">Cant</th>
                                                <th className="px-4 py-2 text-right">Precio U.</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detail.items?.map((item, idx) => (
                                                <tr key={idx} className="text-[10px] font-bold text-slate-600">
                                                    <td className="px-4 py-2 uppercase italic">{item.nombre}</td>
                                                    <td className="px-4 py-2 text-right font-black text-slate-800">{parseFloat(item.cantidad).toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-right text-slate-400"><Money value={item.precio_unitario} /></td>
                                                    <td className="px-4 py-2 text-right font-black text-indigo-600"><Money value={item.total} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center mt-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Monto Total Invertido</p>
                                    <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                        <span>Gravada: <Money value={detail.total_gravada} /></span>
                                        <span>IVA: <Money value={detail.iva} /></span>
                                        {parseFloat(detail.fovial || 0) > 0 && (
                                            <span className="text-amber-600">FOVIAL: <Money value={detail.fovial} /></span>
                                        )}
                                        {parseFloat(detail.cotrans || 0) > 0 && (
                                            <span className="text-cyan-600">COTRANS: <Money value={detail.cotrans} /></span>
                                        )}
                                        {parseFloat(detail.retencion || 0) > 0 && (
                                            <span className="text-rose-500">Retención: -<Money value={detail.retencion} /></span>
                                        )}
                                        {parseFloat(detail.percepcion || 0) > 0 && (
                                            <span className="text-emerald-600">Percepción: +<Money value={detail.percepcion} /></span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tighter text-indigo-600"><Money value={detail.monto_total} /></p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
