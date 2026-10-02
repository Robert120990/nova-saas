import { useState } from 'react';
import { CheckCircle2, FileText, Files, X, Loader2, Printer, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';

const GasCloseoutSuccessModal = ({
    isOpen,
    onClose,
    closeoutId,
    numeroTurno,
    fechaTurno,
    onPrintSummary
}) => {
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingConsolidated, setLoadingConsolidated] = useState(false);

    if (!isOpen) return null;

    const handlePrintSummaryClick = async () => {
        try {
            setLoadingSummary(true);
            if (onPrintSummary) {
                await onPrintSummary();
            }
        } catch (error) {
            console.error('Error al imprimir resumen:', error);
            toast.error('Error al generar la hoja resumen');
        } finally {
            setLoadingSummary(false);
        }
    };

    const handlePrintConsolidatedClick = async () => {
        if (!closeoutId) {
            toast.error('No hay ID de turno válido');
            return;
        }
        try {
            setLoadingConsolidated(true);
            const res = await axios.get(`/api/gas-station/closeouts/${closeoutId}/annexes-pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success('Detalle consolidado abierto correctamente');
        } catch (error) {
            console.error('Error al generar PDF consolidado:', error);
            toast.error('Error al generar PDF consolidado de anexos');
        } finally {
            setLoadingConsolidated(false);
        }
    };

    const handlePrintBoth = async () => {
        await handlePrintSummaryClick();
        await handlePrintConsolidatedClick();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden scale-in-95 transition-all">
                {/* Header decorativo */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                        title="Cerrar ventana"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                            <CheckCircle2 size={28} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                                    Cierre Completado
                                </span>
                                {numeroTurno && (
                                    <span className="text-[10px] font-bold text-emerald-100">
                                        Turno #{numeroTurno}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                                ¡Turno Cerrado Exitosamente!
                            </h2>
                            {fechaTurno && (
                                <p className="text-[11px] text-emerald-100/90 font-medium">
                                    Fecha del turno: {formatDate(fechaTurno)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contenido / Opciones de impresión */}
                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-600">
                        El turno ha sido cuadrado y bloqueado contablemente. Puedes descargar e imprimir los comprobantes oficiales a continuación:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Opción 1: Hoja Resumen */}
                        <div className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                                    <FileText size={18} />
                                </div>
                                <h3 className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                                    Hoja Resumen
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Ventas por combustible, lecturas de bombas, tanques y cuadre de caja.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handlePrintSummaryClick}
                                disabled={loadingSummary}
                                className="mt-4 w-full py-2 px-3 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {loadingSummary ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Printer size={13} />
                                )}
                                <span>Imprimir Resumen</span>
                            </button>
                        </div>

                        {/* Opción 2: Detalle Completo de Cierre (PDF Único) */}
                        <div className="p-4 rounded-xl border-2 border-emerald-500/40 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/50 transition-all flex flex-col justify-between group relative overflow-hidden">
                            <div className="absolute top-2 right-2">
                                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                                    Consolidado
                                </span>
                            </div>
                            <div>
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                                    <Files size={18} />
                                </div>
                                <h3 className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">
                                    Detalle Completo (PDF)
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Consolidado contable de los 10 anexos: remesas, gastos, créditos, tarjetas y más.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handlePrintConsolidatedClick}
                                disabled={loadingConsolidated}
                                className="mt-4 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {loadingConsolidated ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Download size={13} />
                                )}
                                <span>Imprimir Detalle Único</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer acciones */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handlePrintBoth}
                        disabled={loadingSummary || loadingConsolidated}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                        <Printer size={13} />
                        <span>Imprimir Ambos Comprobantes</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                        Listo / Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GasCloseoutSuccessModal;
