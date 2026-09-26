import { QrCode, Printer } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

const EggLabelPreviewModal = ({
    isOpen,
    onClose,
    label,
    onPrint
}) => {
    if (!isOpen || !label) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5 text-slate-900">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <QrCode size={16} className="text-purple-600" />
                        Etiqueta de Trazabilidad
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
                <div className="h-px bg-slate-100" />

                {/* Printable Area Representation */}
                <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-300 shadow-sm flex flex-col items-center text-center font-mono space-y-4 max-w-sm mx-auto">
                    <div className="w-full flex justify-between items-center border-b border-slate-900 pb-2 text-[9px] font-bold">
                        <span>ANDELSA PLANTA INDUSTRIAL</span>
                        <span>REGISTRO SANITARIO</span>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">Código de Lote</span>
                        <span className="text-base font-bold tracking-tight text-slate-900 uppercase border border-slate-900 px-3 py-1 rounded-md">{label.lot_code}</span>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-2 text-left text-[10px] font-medium border-t border-b border-slate-900 py-3 font-sans">
                        <div>
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">Producto:</span>
                            <span className="font-bold capitalize text-slate-900">{label.product_type}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">Presentación:</span>
                            <span className="font-bold text-slate-900">{label.presentation}</span>
                        </div>
                        <div className="mt-1">
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">Cant. Envasada:</span>
                            <span className="font-bold text-slate-900">{label.units_packaged} Unidades</span>
                        </div>
                        <div className="mt-1">
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">Peso Total:</span>
                            <span className="font-bold text-slate-900">{label.total_batch_weight_lbs} Lbs</span>
                        </div>
                        <div className="mt-1">
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">F. Empaque:</span>
                            <span className="font-bold text-slate-900">{formatDate(label.created_at)}</span>
                        </div>
                        <div className="mt-1">
                            <span className="text-slate-500 block text-[8px] uppercase font-bold">F. Vencimiento:</span>
                            <span className="font-bold text-rose-600">{formatDate(label.expiry_date)}</span>
                        </div>
                    </div>

                    {/* Simulated Barcode block */}
                    <div className="py-2 flex flex-col items-center">
                        <div className="h-10 w-44 bg-slate-900 flex items-center justify-between px-2 text-white font-mono text-[9px] tracking-[4px] font-bold rounded">
                            |||| | | ||| || ||| || |||
                        </div>
                        <span className="text-[10px] text-slate-600 font-bold font-mono mt-1">({label.barcode})</span>
                    </div>

                    {/* Dynamic QR Code from API */}
                    <div className="flex flex-col items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="h-28 w-28 bg-white rounded-lg flex items-center justify-center p-1 shadow-xs relative overflow-hidden border border-slate-200">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(label.qr_code_payload)}`}
                                alt="QR Trazabilidad"
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold mt-2 tracking-tight uppercase">Escanee para verificar trazabilidad</span>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => {
                            onPrint?.(label);
                            onClose();
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Printer size={14} />
                        Imprimir Etiqueta (PDF)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EggLabelPreviewModal;
