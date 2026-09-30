import { useEffect, useState } from 'react';
import { Sparkles, RotateCw, X } from 'lucide-react';

/**
 * Modal / Card flotante de actualización disponible.
 * Diseñado conforme a la referencia visual (tarjeta oscura, borde naranja vibrante,
 * badge píldora superior con versión y botón principal de actualización inmediata).
 *
 * Contrato de props estándar:
 * @param {boolean} open - Control de visibilidad
 * @param {Function} onClose - Callback al descartar ("Más tarde" o botón "X")
 * @param {Function} onUpdate - Callback para proceder con la actualización
 * @param {string} [version] - Versión semántica (ej. "v2.7.143")
 * @param {string} [commit] - Hash de commit de git (ej. "3503e5c")
 * @param {boolean} [isUpdating] - Estado de carga mientras se actualiza
 */
const UpdateAvailableModal = ({
    open = false,
    onClose,
    onUpdate,
    version = 'v2.7.143',
    commit = '',
    isUpdating = false
}) => {
    const [visible, setVisible] = useState(open);

    useEffect(() => {
        setVisible(open);
    }, [open]);

    if (!visible) return null;

    const formattedCommit = commit ? (commit.startsWith('#') ? commit : `#${commit}`) : '';
    const displayVersion = version?.startsWith('v') ? version : `v${version || '2.7'}`;

    return (
        <div 
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 left-4 sm:left-auto z-[99999] max-w-[440px] w-auto sm:w-[420px] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-dialog-title"
        >
            <div className="relative overflow-hidden rounded-[22px] bg-[#14161d] border-[1.5px] border-[#f95700] p-5 sm:p-6 shadow-2xl shadow-black/80 backdrop-blur-md">
                {/* Glow decorativo sutil en la esquina superior izquierda */}
                <div 
                    className="absolute -top-16 -left-16 w-36 h-36 bg-[#f95700]/15 rounded-full blur-2xl pointer-events-none"
                    aria-hidden="true"
                />

                {/* Cabecera: Badge de versión a la izquierda y Botón Cerrar 'X' a la derecha */}
                <div className="relative flex items-center justify-between gap-3 mb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0a0f1d] border border-slate-700/70 shadow-inner">
                        <Sparkles size={13} className="text-[#f95700] shrink-0 fill-[#f95700]/20" />
                        <span className="text-white text-xs font-mono font-bold tracking-wide">
                            {displayVersion}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUpdating}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Cerrar notificación"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Título */}
                <div className="relative">
                    <h3 
                        id="update-dialog-title" 
                        className="text-white font-bold text-lg sm:text-xl tracking-tight mb-1.5"
                    >
                        Actualización disponible
                    </h3>

                    {/* Descripción con hash de commit si está disponible */}
                    <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed mb-6 font-normal">
                        Se ha publicado una nueva versión en el servidor
                        {formattedCommit ? ` (${formattedCommit})` : ''}. 
                        Actualiza para aplicar las últimas mejoras.
                    </p>
                </div>

                {/* Acciones: Botón Actualizar Ahora y Botón Más tarde */}
                <div className="relative flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onUpdate}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#f95700] hover:bg-[#ea4e00] active:scale-95 shadow-lg shadow-[#f95700]/25 transition-all disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <RotateCw 
                            size={16} 
                            className={`shrink-0 ${isUpdating ? 'animate-spin' : ''}`} 
                        />
                        <span>{isUpdating ? 'Actualizando...' : 'Actualizar Ahora'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUpdating}
                        className="px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Más tarde
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateAvailableModal;
