const Sentry = require('@sentry/node');
const { logger } = require('../utils/logger');

/**
 * Sentry Configuration and Error Tracking for DTE API
 */

const dsn = process.env.SENTRY_DSN;
const isEnabled = Boolean(dsn && dsn.trim().length > 0);

const initSentry = () => {
    if (!isEnabled) {
        logger.debug('Sentry no inicializado en dte-api: SENTRY_DSN no definido (modo pasivo)');
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
            beforeSend(event) {
                // Sanitize sensitive DTE keys
                if (event.request?.headers) {
                    delete event.request.headers.authorization;
                    delete event.request.headers['x-restart-key'];
                }
                return event;
            }
        });

        logger.info('Sentry inicializado correctamente en dte-api');
    } catch (err) {
        logger.error({ err }, 'Error al inicializar Sentry en dte-api');
    }
};

const setupSentryErrorHandler = (app) => {
    if (!isEnabled) return;
    try {
        Sentry.setupExpressErrorHandler(app);
    } catch (err) {
        logger.error({ err }, 'Error configurando Sentry error handler en Express (dte-api)');
    }
};

module.exports = {
    Sentry,
    isEnabled,
    initSentry,
    setupSentryErrorHandler
};
