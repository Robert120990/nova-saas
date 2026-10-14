import { Filter } from 'lucide-react';
import Money from '../../ui/Money';

const BankCorrelativosReservationTable = ({ isLoading, filteredItems = [], localNums = {}, onUpdateNum }) => {
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
                            <th className="px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 text-center w-36">
                                CORRELATIVO (NUM)
                            </th>
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
                                const isCustomized = localNums[row.llave] !== undefined;
                                const currentNum = isCustomized ? localNums[row.llave] : (row.num || '');

                                return (
                                    <tr key={row.llave || idx} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                                        <td className="px-3.5 py-2 font-semibold text-slate-700 whitespace-nowrap">{row.fecha}</td>
                                        <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">{row.referencia || '---'}</td>
                                        <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                            <Money value={row.monto} />
                                        </td>
                                        <td className="px-3.5 py-2 font-medium text-slate-700 uppercase leading-snug">{row.concepto}</td>
                                        <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{row.llave}</td>
                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                            <div className="relative inline-flex items-center justify-center">
                                                <input
                                                    type="text"
                                                    value={currentNum}
                                                    onChange={(e) => onUpdateNum?.(row.llave, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    placeholder="---"
                                                    maxLength={14}
                                                    className={`w-28 px-2 py-1 text-xs font-black font-mono text-center rounded-lg border outline-none transition-all cursor-text ${
                                                        isCustomized
                                                            ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-400/30'
                                                            : currentNum
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20'
                                                                : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:border-indigo-400 focus:bg-white focus:text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-300'
                                                    }`}
                                                    title="Haz clic para asignar o editar el número de correlativo manualmente"
                                                />
                                                {isCustomized && (
                                                    <span
                                                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full shadow-sm"
                                                        title="Modificado manualmente (pendiente de guardar)"
                                                    />
                                                )}
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

export default BankCorrelativosReservationTable;
