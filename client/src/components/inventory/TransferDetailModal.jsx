import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { X } from 'lucide-react';

/**
 * TransferDetailModal Component
 * Reusable modal displaying detailed product lines and branch metadata of an inventory transfer.
 */
const TransferDetailModal = ({ transfer, onClose }) => {
    const { data: items, isLoading } = useQuery({
        queryKey: ['transfer-detail', transfer?.id],
        queryFn: async () => (await axios.get(`/api/inventory/transfers/${transfer.id}`)).data,
        enabled: !!transfer
    });

    if (!transfer) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-900">Detalle de Traslado</h3>
                            <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                TR-{String(transfer.id).padStart(6, '0')}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                            Realizado por {transfer.usuario_nombre} el {new Date(transfer.fecha).toLocaleString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 border-b border-slate-100">
                    <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Sucursal Origen</div>
                        <div className="text-sm font-bold text-slate-700">{transfer.origen_nombre}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Sucursal Destino</div>
                        <div className="text-sm font-bold text-indigo-600">{transfer.destino_nombre}</div>
                    </div>
                    {transfer.observaciones && (
                        <div className="col-span-2">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Observaciones</div>
                            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">{transfer.observaciones}</div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4 text-center">Código</th>
                                <th className="px-6 py-4 text-center">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan="3" className="px-6 py-10 text-center text-sm text-slate-400">Cargando ítems...</td></tr>
                            ) : items?.map(item => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{item.nombre}</td>
                                    <td className="px-6 py-4 text-center text-xs font-mono font-bold text-slate-500">{item.codigo}</td>
                                    <td className="px-6 py-4 text-center font-black text-indigo-600">{item.cantidad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransferDetailModal;
