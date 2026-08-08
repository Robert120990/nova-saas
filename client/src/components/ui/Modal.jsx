import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${maxWidth} h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200 flex flex-col`}>
                <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                    <h3 className="text-base sm:text-xl font-bold text-slate-900 truncate pr-2">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0 text-slate-500 hover:text-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto overflow-x-hidden flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
