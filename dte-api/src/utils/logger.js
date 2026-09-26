const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');

/**
 * High-performance structured logger with DTE context and secret redaction for DTE API
 */

const isProduction = process.env.NODE_ENV === 'production';

const redactOptions = {
    paths: [
        'password',
        'contrasena',
        'token',
        'p12Password',
        'privateKey',
        'privKey',
        'certificado',
        '*.password',
        '*.token',
        '*.p12Password',
        'req.headers.authorization',
        'req.headers["x-restart-key"]'
    ],
    censor: '[REDACTED]'
};

const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    redact: redactOptions,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: !isProduction
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
        : undefined
});

const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    customProps: (req) => ({
        company_id: req.company_id || req.headers['x-company-id'] || null,
        codigo_generacion: req.params?.codigoGeneracion || req.body?.codigoGeneracion || null
    }),
    customLogLevel: (res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `[DTE-API] ${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `[DTE-API] ${req.method} ${req.url} ${res.statusCode} - Error: ${err.message}`,
    autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/favicon.ico'
    }
});

module.exports = {
    logger,
    httpLogger
};
