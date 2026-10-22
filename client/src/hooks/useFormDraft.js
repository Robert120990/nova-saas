import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook para auto-guardar y recuperar borradores en sessionStorage.
 * Protege contra pérdida de datos ante recargas accidentales (F5),
 * reinicios del servidor o cierres inesperados de pestaña.
 *
 * @param {string} draftKey - Clave única del borrador (ej: `draft_liq_${companyId}`)
 * @param {object} formData - Objeto con los valores del formulario
 * @param {boolean} enabled - Si el guardado automático está activo (ej: modal abierto)
 */
export function useFormDraft(draftKey, formData, enabled = true) {
    const timerRef = useRef(null);

    // Guardado continuo con debounce en sessionStorage
    useEffect(() => {
        if (!enabled || !draftKey || !formData) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                sessionStorage.setItem(draftKey, JSON.stringify({
                    data: formData,
                    savedAt: Date.now()
                }));
            } catch (e) {
                // Ignore quota exceeded or private mode errors
            }
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [draftKey, formData, enabled]);

    const getDraft = useCallback(() => {
        if (!draftKey) return null;
        try {
            const raw = sessionStorage.getItem(draftKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            // Válido por 12 horas
            if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) {
                sessionStorage.removeItem(draftKey);
                return null;
            }
            return parsed.data;
        } catch {
            return null;
        }
    }, [draftKey]);

    const clearDraft = useCallback(() => {
        if (!draftKey) return;
        try {
            sessionStorage.removeItem(draftKey);
        } catch {}
    }, [draftKey]);

    return { getDraft, clearDraft };
}
