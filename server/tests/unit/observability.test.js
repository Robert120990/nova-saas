const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { logger, httpLogger } = require('../../src/utils/logger');
const { isEnabled, Sentry } = require('../../src/config/sentry');

describe('Fase 2: Observabilidad (Pino + Sentry) Unit Tests', () => {
    it('should have standard logging methods on logger instance', () => {
        assert.equal(typeof logger.info, 'function');
        assert.equal(typeof logger.warn, 'function');
        assert.equal(typeof logger.error, 'function');
        assert.equal(typeof logger.debug, 'function');
    });

    it('should export httpLogger middleware function', () => {
        assert.equal(typeof httpLogger, 'function');
    });

    it('should operate in passive mode when SENTRY_DSN is absent without crashing', () => {
        assert.equal(typeof isEnabled, 'boolean');
        assert.ok(Sentry);
        assert.equal(typeof Sentry.captureException, 'function');
        assert.equal(typeof Sentry.captureMessage, 'function');
    });

    it('should verify dte-api observability modules structure', () => {
        const dteLoggerModule = require('../../../dte-api/src/utils/logger');
        assert.equal(typeof dteLoggerModule.logger.info, 'function');
        assert.equal(typeof dteLoggerModule.httpLogger, 'function');

        const dteSentryModule = require('../../../dte-api/src/config/sentry');
        assert.equal(typeof dteSentryModule.isEnabled, 'boolean');
        assert.ok(dteSentryModule.Sentry);
    });
});
