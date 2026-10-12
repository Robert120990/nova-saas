import Modal from '../../ui/Modal';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const CloseoutCostsReportModal = ({
    open,
    onClose,
    pdfUrl,
    isLoading = false,
    error = null,
    onRetry = null,
    title = 'Comprobante de Costos de Venta'
}) => {
    if (!open) return null;

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={title}
            maxWidth="max-w-5xl"
            height="h-[88vh] sm:h-[88vh]"
            bodyClassName="p-0 flex flex-col flex-1 h-full min-h-[500px] overflow-hidden bg-slate-100"
        >
            {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <Loader2 className="text-indigo-600 animate-spin" size={42} />
                    <p className="text-slate-700 font-bold text-sm">Generando comprobante de costos...</p>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} />
                    </div>
                    <p className="text-rose-700 font-bold text-sm">{error}</p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                            <RefreshCw size={14} /> Reintentar
                        </button>
                    )}
                </div>
            ) : pdfUrl ? (
                <iframe
                    src={`${pdfUrl}#view=FitH`}
                    className="w-full flex-1 h-full border-none"
                    title={title}
                />
            ) : null}
        </Modal>
    );
};

export default CloseoutCostsReportModal;
