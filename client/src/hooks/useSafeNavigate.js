import { useNavigate, useLocation } from 'react-router-dom';
import { useConfirm } from '../context/ConfirmContext';
import { isAnyDirty, clearAllDirty } from '../store/dirtyState';

/**
 * Hook para navegación interna segura.
 * Intercepta cambios de ruta en SPA (Sidebar, CommandPalette, Navbar)
 * advirtiendo al usuario si hay formularios con cambios no guardados.
 */
export function useSafeNavigate() {
    const navigate = useNavigate();
    const location = useLocation();
    const confirm = useConfirm();

    /**
     * Intercepta el evento de clic en un elemento <NavLink> o <Link>.
     * Si hay datos sucios, previene la navegación y solicita confirmación.
     */
    const handleSafeLinkClick = async (e, targetPath, onNavigateSuccess) => {
        if (!targetPath || location.pathname === targetPath) {
            onNavigateSuccess?.();
            return;
        }

        if (isAnyDirty()) {
            e.preventDefault();

            const ok = await confirm({
                title: '¿Descartar cambios no guardados?',
                message: 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si cambias de menú, estos datos se perderán.',
                confirmLabel: 'Descartar y salir',
                cancelLabel: 'Permanecer aquí',
                variant: 'warning'
            });

            if (ok) {
                clearAllDirty();
                navigate(targetPath);
                onNavigateSuccess?.();
            }
        } else {
            onNavigateSuccess?.();
        }
    };

    /**
     * Navegación programática segura (para botones o atajos de teclado).
     */
    const safeNavigate = async (targetPath, options = {}) => {
        if (!targetPath) return false;

        if (location.pathname === targetPath) {
            return true;
        }

        if (isAnyDirty()) {
            const ok = await confirm({
                title: '¿Descartar cambios no guardados?',
                message: 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si cambias de sección, estos datos se perderán.',
                confirmLabel: 'Descartar y salir',
                cancelLabel: 'Permanecer aquí',
                variant: 'warning'
            });

            if (!ok) return false;
            clearAllDirty();
        }

        navigate(targetPath, options);
        return true;
    };

    /**
     * Confirmación segura para acciones que no son navegación directa (ej. logout, cambio de empresa).
     */
    const confirmAction = async (actionCallback, options = {}) => {
        if (isAnyDirty()) {
            const ok = await confirm({
                title: options.title || '¿Descartar cambios no guardados?',
                message: options.message || 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si continúas, estos datos se perderán.',
                confirmLabel: options.confirmLabel || 'Descartar y continuar',
                cancelLabel: options.cancelLabel || 'Permanecer aquí',
                variant: 'warning'
            });

            if (!ok) return false;
            clearAllDirty();
        }

        if (actionCallback) await actionCallback();
        return true;
    };

    return {
        handleSafeLinkClick,
        safeNavigate,
        confirmAction,
        isDirty: isAnyDirty
    };
}
