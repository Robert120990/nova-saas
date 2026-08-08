
const Table = ({ headers, data = [], renderRow, renderCard, isLoading }) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Vista en tarjeta para móvil (si se provee renderCard) */}
            {renderCard && (
                <div className="md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium text-slate-500">Cargando registros...</span>
                            </div>
                        </div>
                    ) : data.length > 0 ? (
                        <div className="p-3 space-y-3">
                            {data.map((item, index) => (
                                <div key={item.id || index} className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 hover:border-indigo-100 transition-all">
                                    {renderCard(item, index)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-slate-400 italic text-sm">
                            No se encontraron registros
                        </div>
                    )}
                </div>
            )}

            {/* Vista en Tabla (Escritorio o fallback móvil si no hay renderCard) */}
            <div className={`overflow-x-auto ${renderCard ? 'hidden md:block' : 'block'}`}>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            {headers.map((h, i) => (
                                <th key={i} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={headers.length} className="px-4 py-6 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-5 h-5 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[11px] font-medium text-slate-500">Cargando registros...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length > 0 ? (
                            data.map((item, index) => renderRow(item, index))
                        ) : (
                            <tr>
                                <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-400 italic">
                                    No se encontraron registros
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Table;
