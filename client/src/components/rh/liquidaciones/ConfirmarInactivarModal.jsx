import React from 'react';
import { UserX, UserCheck, AlertTriangle, X, ShieldAlert } from 'lucide-react';

const ConfirmarInactivarModal = ({ open, onClose, onConfirm, empleado, isSaving = false }) => {
    if (!open) return null;

    const nombreCompleto = `${empleado?.nombres || ''} ${empleado?.apellidos || ''}`.trim() || 'Empleado';
    const codigo = empleado?.codigo || '';
    const yaInactivo = empleado?.es_activo === 0;

    return (
        <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => !isSaving && onClose()}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Accent Top Border */}
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600" />

                <div className="p-6">
                    {/* Header with Icon */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-xs">
                            <UserX size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                                ¿Marcar como inactivo al empleado?
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Registro de finiquito y liquidación laboral
                            </p>
                        </div>
                        {!isSaving && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* Employee Card */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-4 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                            <div className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mb-1">
                                {codigo || 'S/C'}
                            </div>
                            <div className="text-xs font-bold text-slate-800 truncate">
                                {nombreCompleto}
                            </div>
                        </div>
                        <div className="shrink-0">
                            {yaInactivo ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    Actualmente Inactivo
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Actualmente Activo
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description Message */}
                    <p className="text-xs text-slate-600 leading-relaxed mb-5">
                        Al guardar la liquidación laboral, ¿desea marcar a este colaborador como <strong className="text-rose-700 font-semibold">Inactivo</strong> para darlo de baja en las planillas del sistema, o prefiere mantenerlo <strong className="text-emerald-700 font-semibold">Activo</strong>?
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => onConfirm(true)}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <UserX size={15} />
                            <span>Sí, marcar como inactivo</span>
                        </button>

                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => onConfirm(false)}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <UserCheck size={15} />
                            <span>No, mantener activo</span>
                        </button>

                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={onClose}
                            className="w-full py-2 px-4 rounded-xl font-semibold text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors text-center cursor-pointer mt-1"
                        >
                            Cancelar y volver al formulario
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmarInactivarModal;
