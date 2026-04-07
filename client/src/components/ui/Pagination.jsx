import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ 
    currentPage, 
    totalPages, 
    totalItems, 
    onPageChange, 
    itemsOnPage, 
    isLoading 
}) => {
    if (totalPages <= 1 && totalItems <= itemsOnPage) return null;

    return (
        <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-slate-500 font-medium">
                Mostrando <span className="text-slate-900 font-bold">{itemsOnPage}</span> de <span className="text-slate-900 font-bold">{totalItems}</span> registros
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-1">
                    {(() => {
                        const pages = [];
                        const maxVisiblePages = 7;
                        
                        if (totalPages <= maxVisiblePages) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                            // Siempre mostrar la primera
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
                            
                            // Siempre mostrar la última
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
                                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
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
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
