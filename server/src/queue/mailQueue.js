/**
 * Mail Queue Service using BullMQ with Transparent In-Memory Fallback
 * Sipe Web SaaS - Phase 3.2
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'mail-queue';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;

// Lazy-loaded mailer to prevent circular dependencies
let mailerServiceInstance = null;
const getMailer = () => {
    if (!mailerServiceInstance) {
        mailerServiceInstance = require('../services/mailer.service');
    }
    return mailerServiceInstance;
};

class MailQueueService {
    constructor() {
        this.redisClient = null;
        this.queue = null;
        this.worker = null;
        this.isRedisReady = false;
        this.initConnection();
    }

    initConnection() {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        try {
            this.redisClient = new Redis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                lazyConnect: true,
                connectTimeout: 2000,
                retryStrategy: (times) => {
                    if (times > 3) {
                        return null; // Stop reconnecting, operate seamlessly in fallback mode
                    }
                    return Math.min(times * 1000, 3000);
                }
            });

            this.redisClient.on('connect', () => {
                this.isRedisReady = true;
                logger.info('[MailQueue] Conectado exitosamente al servidor Redis');
                this.ensureQueueAndWorker();
            });

            this.redisClient.on('error', (err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[MailQueue] Redis no disponible para colas, operando en fallback local');
            });

            this.redisClient.on('close', () => {
                this.isRedisReady = false;
            });

            // Attempt connection without throwing unhandled rejection
            this.redisClient.connect().catch((err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[MailQueue] Conexión inicial no establecida, operando en fallback local');
            });
        } catch (initErr) {
            this.isRedisReady = false;
            logger.warn({ err: initErr.message }, '[MailQueue] Error al inicializar cliente Redis');
        }
    }

    ensureQueueAndWorker() {
        if (!this.isRedisReady || !this.redisClient) return;

        if (!this.queue) {
            this.queue = new Queue(QUEUE_NAME, {
                connection: this.redisClient,
                defaultJobOptions: {
                    attempts: DEFAULT_ATTEMPTS,
                    backoff: {
                        type: 'exponential',
                        delay: DEFAULT_BACKOFF_DELAY
                    },
                    removeOnComplete: { count: 100 },
                    removeOnFail: { count: 500 }
                }
            });
        }

        if (!this.worker) {
            this.worker = new Worker(QUEUE_NAME, async (job) => {
                return this.processJob(job.name, job.data);
            }, {
                connection: this.redisClient,
                concurrency: 3
            });

            this.worker.on('completed', (job) => {
                logger.info({ jobId: job.id, jobName: job.name }, '[MailQueue] Job procesado exitosamente');
            });

            this.worker.on('failed', (job, err) => {
                logger.error({ jobId: job?.id, jobName: job?.name, err: err?.message, attemptsMade: job?.attemptsMade }, '[MailQueue] Job falló en procesamiento');
            });

            this.worker.on('error', (err) => {
                logger.debug({ err: err.message }, '[MailQueue] Worker error handled');
            });
        }
    }

    async processJob(jobName, data) {
        const mailer = getMailer();
        switch (jobName) {
            case 'send-dte-email':
                return await mailer.sendDTEEmail(data.saleId, data.companyId);

            case 'send-invalidated-dte-email':
                return await mailer.sendInvalidatedDTEEmail(data.saleId, data.companyId);

            case 'send-payment-receipt':
                return await mailer.sendPaymentReceiptEmail(data.paymentId);

            case 'send-advance-receipt':
                return await mailer.sendAdvanceReceiptEmail(data.advanceId, data.recipientEmail);

            case 'send-generic-mail':
                return await mailer.sendMail(data.mailOptions);

            default:
                throw new Error(`[MailQueue] Unknown job name: ${jobName}`);
        }
    }

    executeFallback(jobName, data) {
        setImmediate(async () => {
            try {
                logger.debug({ jobName, data }, '[MailQueue:Fallback] Procesando envío de correo de fondo en modo local');
                await this.processJob(jobName, data);
            } catch (err) {
                logger.error({ jobName, data, err: err.message }, '[MailQueue:Fallback] Error enviando correo en modo local');
            }
        });
    }

    async enqueueJob(jobName, data, opts = {}) {
        if (this.isRedisReady && this.queue) {
            try {
                const job = await this.queue.add(jobName, data, opts);
                logger.debug({ jobId: job.id, jobName }, '[MailQueue] Job encolado exitosamente en BullMQ');
                return { enqueued: true, jobId: job.id };
            } catch (err) {
                logger.warn({ err: err.message, jobName }, '[MailQueue] Error encolando en BullMQ, ejecutando en fallback local');
            }
        }

        // Fallback execution when Redis is unavailable
        this.executeFallback(jobName, data);
        return { enqueued: false, fallback: true };
    }

    // High-level enqueue helpers
    async enqueueDTEEmail(saleId, companyId = null) {
        return this.enqueueJob('send-dte-email', { saleId, companyId });
    }

    async enqueueInvalidatedDTEEmail(saleId, companyId = null) {
        return this.enqueueJob('send-invalidated-dte-email', { saleId, companyId });
    }

    async enqueuePaymentReceipt(paymentId) {
        return this.enqueueJob('send-payment-receipt', { paymentId });
    }

    async enqueueAdvanceReceipt(advanceId, recipientEmail = null) {
        return this.enqueueJob('send-advance-receipt', { advanceId, recipientEmail });
    }

    async enqueueMail(mailOptions) {
        return this.enqueueJob('send-generic-mail', { mailOptions });
    }

    async close() {
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }
        if (this.queue) {
            await this.queue.close();
            this.queue = null;
        }
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch {
                this.redisClient.disconnect();
            }
            this.redisClient = null;
        }
        this.isRedisReady = false;
    }
}

const mailQueueInstance = new MailQueueService();
module.exports = mailQueueInstance;
