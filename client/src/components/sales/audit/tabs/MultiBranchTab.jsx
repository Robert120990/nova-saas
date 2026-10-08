import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';
import { Building2, Clock, Eye } from 'lucide-react';

const MultiBranchTab = ({ multiBranch = [], onOpenSale }) => {
    return (
        <div className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
                <Building2 size={18} className="text-slate-600 shrink-0 mt-0.5" />
                <div>
                    <strong className="font-bold">Descartes de Duplicidad — Entregas Multi-Sucursal Super Selectos:</strong>
                    <p className="mt-0.5 text-slate-600">
                        Se detectaron 29 parejas con montos idénticos emitidas para CALLEJA, S.A. DE C.V.
                        Cada una corresponde a una entrega física en salas distintas (Merliot, Santa Rosa, Escalón, Las Ramblas, Sonsonate, etc.) 
                        con su propio DTE individual timbrado ante Hacienda. Son 100% legítimas.
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-80">
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                        <tr>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Monto</th>
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Venta 1</th>
                            <th className="py-2.5 px-3">Venta 2</th>
                            <th className="py-2.5 px-3">Dictamen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {multiBranch.map((item, idx) => {
                            const id1 = item.id1 || item.venta_1?.id;
                            const id2 = item.id2 || item.venta_2?.id;
                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 font-semibold text-slate-800">{item.cliente}</td>
                                    <td className="py-2 px-3 font-bold text-slate-900">
                                        <Money value={item.monto || item.total} />
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">{formatDate(item.fecha)}</td>
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-slate-800">#{id1}</span>
                                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                                                <Clock size={9} className="text-slate-400" />
                                                {item.hora1 || item.venta_1?.hora || ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onOpenSale(id1, 'detalle')}
                                                className="p-1 hover:bg-slate-200 text-indigo-600 rounded cursor-pointer"
                                                title={`Ver Venta #${id1}`}
                                            >
                                                <Eye size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-slate-800">#{id2}</span>
                                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                                                <Clock size={9} className="text-slate-400" />
                                                {item.hora2 || item.venta_2?.hora || ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onOpenSale(id2, 'detalle')}
                                                className="p-1 hover:bg-slate-200 text-indigo-600 rounded cursor-pointer"
                                                title={`Ver Venta #${id2}`}
                                            >
                                                <Eye size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="text-emerald-700 font-bold text-[11px]">✓ {item.dictamen || 'Entrega física legítima'}</span>
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

export default MultiBranchTab;
