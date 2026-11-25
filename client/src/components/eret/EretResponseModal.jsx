import { Info } from 'lucide-react';
import Modal from '../ui/Modal';

const EretResponseModal = ({ isOpen, onClose, responseData }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Respuesta MH" maxWidth="max-w-xl">
            {responseData ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                        <Info size={18} className="shrink-0" />
                        <p>Respuesta del Ministerio de Hacienda para este ERET.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-3xl overflow-auto max-h-[400px]">
                        <pre className="text-indigo-300 font-mono text-xs leading-relaxed">
                            {typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2)}
                        </pre>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Sin respuesta registrada
                </div>
            )}
        </Modal>
    );
};

export default EretResponseModal;
