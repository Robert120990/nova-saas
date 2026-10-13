import { Filter } from 'lucide-react';
import Money from '../../ui/Money';

const BankCorrelativosReservationTable = ({ isLoading, filteredItems = [], localNums = {} }) => {
    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 w-28">FECHA</th>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 w-32">REFERENCIA</th>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 text-right w-32">MONTO</th>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600">CONCEPTO</th>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 w-52">LLAVE</th>
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 text-center w-28">NUM</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400">
                                    <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Cargando movimientos...</span>
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400">
                                    <Filter size={24} className="mx-auto mb-2 text-slate-300" />
                                    <span className="text-xs font-bold uppercase tracking-wider">No se encontraron movimientos para el período seleccionado</span>
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((row, idx) => {
                                const isGenerated = localNums[row.llave] !== undefined;
                                return (
                                    <tr key={row.llave || idx} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                                        <td className="px-3.5 py-2 font-semibold text-slate-700 whitespace-nowrap">{row.fecha}</td>
                                        <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">{row.referencia || '---'}</td>
                                        <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                            <Money value={row.monto} />
                                        </td>
                                        <td className="px-3.5 py-2 font-medium text-slate-700 uppercase leading-snug">{row.concepto}</td>
                                        <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{row.llave}</td>
                                        <td className="px-3.5 py-2 text-center whitespace-nowrap">
                                            {row.num ? (
                                                <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black font-mono transition-all ${
                                                    isGenerated
                                                        ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400/50'
                                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                }`}>
                                                    {row.num}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">---</span>
                                            )}
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

export default BankCorrelativosReservationTable;
