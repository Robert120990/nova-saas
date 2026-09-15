import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * PdfPageNavigator - Reusable pagination control for PDF viewers.
 * Allows moving to previous/next page and direct page entry.
 *
 * @param {number} currentPage - Currently active page (1-based index)
 * @param {number} totalPages - Total pages in document
 * @param {function} onPageChange - Callback when page changes (newPage: number)
 * @param {boolean} disabled - Whether controls are disabled
 * @param {string} className - Additional container classes
 */
const PdfPageNavigator = ({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    disabled = false,
    className = ''
}) => {
    const validTotal = Math.max(1, totalPages || 1);
    const validCurrent = Math.max(1, Math.min(currentPage || 1, validTotal));

    const [inputValue, setInputValue] = useState(String(validCurrent));

    useEffect(() => {
        setInputValue(String(validCurrent));
    }, [validCurrent]);

    const handleCommit = () => {
        const parsed = parseInt(inputValue, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= validTotal) {
            if (parsed !== validCurrent && onPageChange) {
                onPageChange(parsed);
            }
        } else {
            // Restore previous valid page
            setInputValue(String(validCurrent));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
            handleCommit();
        } else if (e.key === 'Escape') {
            setInputValue(String(validCurrent));
            e.currentTarget.blur();
        }
    };

    const handlePrev = (e) => {
        e.preventDefault();
        if (validCurrent > 1 && onPageChange && !disabled) {
            onPageChange(validCurrent - 1);
        }
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (validCurrent < validTotal && onPageChange && !disabled) {
            onPageChange(validCurrent + 1);
        }
    };

    return (
        <div
            className={`inline-flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl p-0.5 shadow-xs select-none ${className}`}
            title={`Página ${validCurrent} de ${validTotal}`}
        >
            {/* Anterior */}
            <button
                type="button"
                onClick={handlePrev}
                disabled={disabled || validCurrent <= 1}
                className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
                title={validCurrent <= 1 ? 'Primera página' : 'Página anterior (←)'}
                aria-label="Página anterior"
            >
                <ChevronLeft size={16} />
            </button>

            {/* Indicador / Input */}
            <div className="flex items-center px-1 sm:px-1.5 gap-1 text-xs font-bold text-slate-700">
                <span className="hidden sm:inline text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Pág.
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    disabled={disabled || validTotal <= 1}
                    onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setInputValue(val);
                    }}
                    onBlur={handleCommit}
                    onKeyDown={handleKeyDown}
                    className="w-8 sm:w-9 text-center py-0.5 px-1 bg-white border border-slate-200/90 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs disabled:bg-slate-100 disabled:text-slate-500"
                    title="Escriba un número y presione Enter para ir a la página"
                    aria-label="Número de página"
                />
                <span className="text-slate-400 font-semibold text-[11px]">/</span>
                <span className="min-w-[14px] text-center font-bold text-slate-700 text-xs">
                    {validTotal}
                </span>
            </div>

            {/* Siguiente */}
            <button
                type="button"
                onClick={handleNext}
                disabled={disabled || validCurrent >= validTotal}
                className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
                title={validCurrent >= validTotal ? 'Última página' : 'Página siguiente (→)'}
                aria-label="Página siguiente"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
};

export default PdfPageNavigator;
