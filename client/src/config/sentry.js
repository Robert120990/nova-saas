import * as Sentry from '@sentry/react';

/**
 * Sentry Frontend Configuration & Error Monitoring
 */

const dsn = import.meta.env.VITE_SENTRY_DSN;
export const isSentryEnabled = Boolean(dsn && dsn.trim().length > 0);

export const initSentry = () => {
    if (!isSentryEnabled) {
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE || 'development',
            tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
            beforeSend(event) {
                // Redact sensitive authorization headers or query parameters if any
                if (event.request?.headers) {
                    delete event.request.headers.Authorization;
                }
                return event;
            }
        });
    } catch (err) {
        console.error('[Sentry] Error al inicializar monitoreo en cliente:', err);
    }
};

export const captureClientException = (error, extraInfo = {}) => {
    if (isSentryEnabled) {
        try {
            Sentry.captureException(error, { extra: extraInfo });
        } catch (e) {
            console.error('[Sentry] Falló al reportar excepción:', e);
        }
    }
};

export { Sentry };
