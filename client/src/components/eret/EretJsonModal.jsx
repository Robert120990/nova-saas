import { Code } from 'lucide-react';
import Modal from '../ui/Modal';

const EretJsonModal = ({ isOpen, onClose, jsonData }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="JSON del ERET" maxWidth="max-w-4xl">
            {jsonData?.json_original ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                        <Code size={18} /> JSON del Evento de Retorno
                    </div>
                    <div className="bg-slate-950 p-6 rounded-3xl overflow-auto max-h-[70vh] border border-slate-800 shadow-2xl">
                        <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
                            {JSON.stringify(jsonData.json_original, null, 2)}
                        </pre>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No hay datos JSON disponibles
                </div>
            )}
        </Modal>
    );
};

export default EretJsonModal;
