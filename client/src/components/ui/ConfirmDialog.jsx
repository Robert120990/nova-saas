import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, XCircle, HelpCircle, CheckCircle } from 'lucide-react';

const VARIANTS = {
    danger: {
        icon: Trash2,
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        confirmBtn: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 shadow-rose-200',
        confirmText: 'text-white',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        confirmBtn: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 shadow-amber-200',
        confirmText: 'text-white',
    },
    info: {
        icon: HelpCircle,
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 shadow-indigo-200',
        confirmText: 'text-white',
    },
    success: {
        icon: CheckCircle,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 shadow-emerald-200',
        confirmText: 'text-white',
    },
};

const ConfirmDialog = ({
    isOpen,
    title = '¿Confirmar acción?',
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    onConfirm,
    onCancel,
}) => {
    const confirmRef = useRef(null);
    const config = VARIANTS[variant] || VARIANTS.danger;
    const Icon = config.icon;

    useEffect(() => {
        if (!isOpen) return;

        // Focus confirm button on open
        const timer = setTimeout(() => {
            confirmRef.current?.focus();
        }, 80);

        // Close on Escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onConfirm, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                style={{
                    animation: 'confirmSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Accent bar */}
                <div className={`h-1.5 w-full ${variant === 'danger' ? 'bg-gradient-to-r from-rose-400 to-rose-600' : variant === 'warning' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : variant === 'success' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-indigo-400 to-indigo-600'}`} />

                <div className="px-7 pt-6 pb-7">
                    {/* Icon + Title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${config.iconBg}`}>
                            <Icon size={24} className={config.iconColor} />
                        </div>
                        <div className="pt-1">
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">{title}</h3>
                            {message && (
                                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{message}</p>
                            )}
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="border-t border-slate-100 my-5" />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={onCancel}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            ref={confirmRef}
                            onClick={onConfirm}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-lg ${config.confirmBtn} ${config.confirmText}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes confirmSlideIn {
                    from { opacity: 0; transform: scale(0.88) translateY(-12px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ConfirmDialog;
