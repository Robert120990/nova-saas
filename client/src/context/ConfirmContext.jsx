import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * useConfirm — imperative confirmation hook
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *       title:        '¿Eliminar registro?',
 *       message:      'Esta acción no se puede deshacer.',
 *       confirmLabel: 'Sí, eliminar',
 *       cancelLabel:  'Cancelar',
 *       variant:      'danger', // 'danger' | 'warning' | 'info' | 'success'
 *   });
 *   if (ok) { ... }
 */
export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
    return ctx.confirm;
};

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState({ isOpen: false });
    const resolveRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setState({ isOpen: true, ...options });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setState((s) => ({ ...s, isOpen: false }));
        resolveRef.current?.(true);
    }, []);

    const handleCancel = useCallback(() => {
        setState((s) => ({ ...s, isOpen: false }));
        resolveRef.current?.(false);
    }, []);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmDialog
                isOpen={state.isOpen}
                title={state.title}
                message={state.message}
                confirmLabel={state.confirmLabel}
                cancelLabel={state.cancelLabel}
                variant={state.variant}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
};

export default ConfirmContext;
