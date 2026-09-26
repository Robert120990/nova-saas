import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Eye, X } from 'lucide-react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

/**
 * AdjustmentDetailModal Component
 * Modal displaying the detailed view of an inventory adjustment/movement and its line items.
 */
const AdjustmentDetailModal = ({ adjustment, onClose }) => {
    const { data: detail, isLoading } = useQuery({
        queryKey: ['adjustment-detail', adjustment?.id],
        queryFn: async () => (await axios.get(`/api/inventory/adjustments/${adjustment.id}`)).data,
        enabled: !!adjustment
    });

    if (!adjustment) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                            <Eye size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest leading-none">Detalle de Movimiento</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref: AJ-{String(adjustment.id).padStart(6, '0')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {isLoading ? (
                        <div className="py-20 text-center space-y-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando información detallada...</p>
                        </div>
                    ) : detail && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sucursal</label>
                                    <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{detail.branch_name}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tipo / Motivo</label>
                                    <p className="text-[11px] font-bold text-indigo-600 uppercase leading-tight">{detail.tipo} - {detail.motivo_name}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
                                    <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{formatDate(detail.fecha)}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Número Doc.</label>
                                    <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">{detail.numero || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Registrado Por</label>
                                    <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight">{detail.usuario_nombre || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${detail.status === 'ANULADO' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {detail.status || 'COMPLETADO'}
                                    </span>
                                </div>
                                {detail.observaciones && (
                                    <div className="space-y-1 col-span-2 md:col-span-3">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Notas / Observaciones</label>
                                        <p className="text-[11px] font-medium text-slate-600 leading-tight bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                            {detail.observaciones}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8">
                                <label className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 block border-b border-slate-100 pb-2">Productos del Movimiento</label>
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-4 py-2">Producto</th>
                                                <th className="px-4 py-2 text-right">Cant</th>
                                                <th className="px-4 py-2 text-right">Costo</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detail.items?.map((item, idx) => (
                                                <tr key={item.id || idx} className="text-[10px] font-bold text-slate-600">
                                                    <td className="px-4 py-2.5 uppercase italic">
                                                        <div className="font-bold text-slate-800">{item.nombre}</div>
                                                        <div className="text-[8px] font-mono text-slate-400 not-italic">{item.codigo}</div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-black text-slate-800">{parseFloat(item.cantidad).toFixed(2)}</td>
                                                    <td className="px-4 py-2.5 text-right text-slate-400"><Money value={item.costo} /></td>
                                                    <td className="px-4 py-2.5 text-right font-black text-indigo-600"><Money value={item.total} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center mt-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Total Movimiento</p>
                                    <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                        <span>Items: <strong className="text-slate-600">{detail.items?.length || 0}</strong></span>
                                        <span>Total Unidades: <strong className="text-slate-600">{detail.items?.reduce((sum, i) => sum + parseFloat(i.cantidad || 0), 0).toFixed(2)}</strong></span>
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tighter text-indigo-600">
                                    <Money value={detail.items?.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0)} />
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdjustmentDetailModal;
