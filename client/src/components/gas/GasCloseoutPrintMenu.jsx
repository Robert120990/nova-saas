import { useState, useRef, useEffect } from 'react';
import { Printer, ChevronDown, FileText, Files, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { downloadCloseoutPdf, printCloseoutAnnex } from '../../utils/closeoutPdf';

const ANNEX_OPTIONS = [
    { key: 'remesas', label: 'Remesas' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'creditos', label: 'Créditos' },
    { key: 'cupones', label: 'Cupones' },
    { key: 'descuentos', label: 'Descuentos' },
    { key: 'adelantos', label: 'Adelantos' },
    { key: 'tarjetas', label: 'Tarjetas' },
    { key: 'cheques', label: 'Cheques' },
    { key: 'vales', label: 'Vales' },
    { key: 'anticipos', label: 'Anticipos Despachados' },
    { key: 'lubricantes', label: 'Lubricantes' },
];

const GasCloseoutPrintMenu = ({
    closeoutId,
    estado,
    onPrintFull,
    compact = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loadingKey, setLoadingKey] = useState(null);
    const menuRef = useRef(null);

    const isCerrado = estado === 'cerrado';

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handlePrintSummary = async () => {
        setIsOpen(false);
        if (onPrintFull) {
            return onPrintFull();
        }
        if (!closeoutId) {
            toast.error('No hay un turno seleccionado');
            return;
        }
        try {
            setLoadingKey('full');
            const { data } = await axios.get(`/api/gas-station/closeouts/${closeoutId}/print-full`);
            await downloadCloseoutPdf(data);
        } catch (error) {
            console.error('Error al generar PDF de cierre:', error);
            toast.error('Error al generar PDF de cierre');
        } finally {
            setLoadingKey(null);
        }
    };

    const handlePrintConsolidatedPdf = async () => {
        setIsOpen(false);
        if (!closeoutId) {
            toast.error('No hay un turno seleccionado');
            return;
        }
        if (!isCerrado) {
            toast.error('El reporte consolidado de anexos solo está disponible cuando el turno está cerrado');
            return;
        }
        try {
            setLoadingKey('consolidated');
            const res = await axios.get(`/api/gas-station/closeouts/${closeoutId}/annexes-pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error al generar PDF consolidado de anexos:', error);
            toast.error('Error al generar PDF consolidado de anexos');
        } finally {
            setLoadingKey(null);
        }
    };

    const handlePrintAnnex = async (annexKey) => {
        setIsOpen(false);
        if (!closeoutId) {
            toast.error('No hay un turno seleccionado');
            return;
        }
        if (!isCerrado) {
            toast.error('La impresión de anexos detallados solo está disponible cuando el turno está cerrado');
            return;
        }

        try {
            setLoadingKey(annexKey);
            const res = await axios.get(`/api/gas-station/closeouts/${closeoutId}/annexes-pdf`, {
                params: { tipo: annexKey },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error(`Error al imprimir anexo ${annexKey}:`, error);
            try {
                const { data } = await axios.get(`/api/gas-station/closeouts/${closeoutId}/print-full`);
                printCloseoutAnnex(data, annexKey);
            } catch (fbErr) {
                toast.error('Error al generar PDF del anexo');
            }
        } finally {
            setLoadingKey(null);
        }
    };

    const handleTriggerClick = (e) => {
        e.stopPropagation();
        if (!isCerrado) {
            // Si no está cerrado, imprime directamente la hoja resumen previa
            handlePrintSummary();
            return;
        }
        setIsOpen(prev => !prev);
    };

    return (
        <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
            <div className="inline-flex items-center">
                <button
                    type="button"
                    onClick={handleTriggerClick}
                    disabled={!closeoutId || loadingKey !== null}
                    className={compact
                        ? "p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-0.5 disabled:opacity-50"
                        : "p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all inline-flex items-center gap-1 disabled:opacity-50"
                    }
                    title={isCerrado ? "Opciones de impresión del turno cerrado" : "Descargar PDF resumen"}
                >
                    {loadingKey ? (
                        <Loader2 size={compact ? 15 : 16} className="animate-spin text-indigo-600" />
                    ) : (
                        <Printer size={compact ? 15 : 16} />
                    )}
                    {isCerrado && (
                        <ChevronDown size={compact ? 12 : 13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                </button>
            </div>

            {isOpen && isCerrado && (
                <div className="absolute right-0 mt-1 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 text-[12px] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    <button
                        type="button"
                        onClick={handlePrintSummary}
                        className="w-full text-left px-3.5 py-1.5 font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors"
                    >
                        <FileText size={15} className="text-indigo-600 shrink-0" />
                        <div>
                            <div className="leading-tight">Hoja Resumen</div>
                            <div className="text-[10px] font-normal text-slate-400">Cuadre general del turno</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handlePrintConsolidatedPdf}
                        disabled={loadingKey === 'consolidated'}
                        className="w-full text-left px-3.5 py-1.5 font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-between gap-2 transition-colors mt-0.5"
                    >
                        <div className="flex items-center gap-2.5">
                            <Files size={15} className="text-emerald-600 shrink-0" />
                            <div>
                                <div className="leading-tight">Detalle de Cierre (PDF Único)</div>
                                <div className="text-[10px] font-normal text-slate-400">Todos los 10 anexos consolidados</div>
                            </div>
                        </div>
                        {loadingKey === 'consolidated' && (
                            <Loader2 size={13} className="animate-spin text-emerald-600 shrink-0" />
                        )}
                    </button>

                    <div className="my-1.5 border-t border-slate-100" />

                    <div className="px-3.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Anexos Individuales
                    </div>

                    {ANNEX_OPTIONS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handlePrintAnnex(item.key)}
                            className="w-full text-left px-3.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-between"
                        >
                            <span>{item.label}</span>
                            {loadingKey === item.key && (
                                <Loader2 size={12} className="animate-spin text-indigo-500" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GasCloseoutPrintMenu;
