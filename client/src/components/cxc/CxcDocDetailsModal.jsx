import { X, Calendar } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

const CxcDocDetailsModal = ({ doc, onClose }) => {
    if (!doc) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Detalles del Documento</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {doc.tipo} #{doc.documento || doc.id}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-4">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Original</span>
                            <span className="text-lg font-black text-slate-800">
                                <Money value={doc.total_original || 0} />
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saldo Pendiente</span>
                            <span className="text-lg font-black text-indigo-600">
                                <Money value={doc.originalSaldo || doc.saldo_pendiente || 0} />
                            </span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Emisión</span>
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <Calendar size={13} className="text-indigo-500" /> 
                                {formatDate(doc.fecha)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CxcDocDetailsModal;
