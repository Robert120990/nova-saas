import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ 
    currentPage, 
    totalPages, 
    totalItems, 
    onPageChange, 
    itemsOnPage, 
    isLoading,
    limit = 15,
    onLimitChange
}) => {
    if (totalPages <= 1 && totalItems <= itemsOnPage) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-4">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                {onLimitChange && (
                    <div className="flex items-center gap-1.5">
                        <select
                            value={limit}
                            onChange={(e) => onLimitChange(Number(e.target.value))}
                            className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-[11px] text-slate-400 font-medium">por pág.</span>
                    </div>
                )}
                <div className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                    <span className="hidden sm:inline">Mostrando </span><span className="text-slate-900 font-bold">{itemsOnPage}</span> de <span className="text-slate-900 font-bold">{totalItems}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <button 
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm flex items-center gap-1 text-xs font-bold"
                >
                    <ChevronLeft size={18} />
                    <span className="sm:hidden">Anterior</span>
                </button>

                {/* Etiqueta compacta en móviles */}
                <div className="sm:hidden text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
                    {currentPage} / {totalPages}
                </div>

                {/* Lista numerada completa en escritorio */}
                <div className="hidden sm:flex items-center gap-1">
                    {(() => {
                        const pages = [];
                        const maxVisiblePages = 7;
                        
                        if (totalPages <= maxVisiblePages) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                            pages.push(1);
                            
                            if (currentPage > 4) {
                                pages.push('...');
                            }
                            
                            const start = Math.max(2, currentPage - 2);
                            const end = Math.min(totalPages - 1, currentPage + 2);
                            
                            for (let i = start; i <= end; i++) {
                                if (!pages.includes(i)) pages.push(i);
                            }
                            
                            if (currentPage < totalPages - 3) {
                                pages.push('...');
                            }
                            
                            if (!pages.includes(totalPages)) pages.push(totalPages);
                        }
                        
                        return pages.map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} className="px-2 text-slate-400 font-bold">
                                    {page}
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                                        currentPage === page 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {page}
                                </button>
                            )
                        ));
                    })()}
                </div>

                <button 
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || isLoading}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm flex items-center gap-1 text-xs font-bold"
                >
                    <span className="sm:hidden">Siguiente</span>
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
