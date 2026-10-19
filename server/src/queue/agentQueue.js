const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { logger } = require('../utils/logger');
const pool = require('../config/db');

const QUEUE_NAME = 'agent-queue';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;

class AgentQueueService {
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
                    if (times > 3) return null;
                    return Math.min(times * 1000, 3000);
                }
            });

            this.redisClient.on('connect', () => {
                this.isRedisReady = true;
                logger.info('[AgentQueue] Conectado exitosamente al servidor Redis');
                this.ensureQueueAndWorker();
            });

            this.redisClient.on('error', (err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[AgentQueue] Redis no disponible, operando en fallback local');
            });

            this.redisClient.on('close', () => {
                this.isRedisReady = false;
            });

            this.redisClient.connect().catch((err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[AgentQueue] Conexión inicial Redis no establecida, operando en fallback local');
            });
        } catch (initErr) {
            this.isRedisReady = false;
            logger.warn({ err: initErr.message }, '[AgentQueue] Error al inicializar cliente Redis');
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
                    removeOnFail: { count: 200 }
                }
            });
        }

        if (!this.worker) {
            this.worker = new Worker(QUEUE_NAME, async (job) => {
                return this.processJob(job.name, job.data);
            }, {
                connection: this.redisClient,
                concurrency: 2
            });

            this.worker.on('completed', (job) => {
                logger.info({ jobId: job.id, jobName: job.name }, '[AgentQueue] Job de agente completado');
            });

            this.worker.on('failed', (job, err) => {
                logger.error({ jobId: job?.id, jobName: job?.name, err: err?.message }, '[AgentQueue] Job de agente falló');
            });

            this.worker.on('error', (err) => {
                logger.debug({ err: err.message }, '[AgentQueue] Worker error handled');
            });
        }
    }

    async processJob(jobName, data) {
        const telegramService = require('../services/telegram.service');

        switch (jobName) {
            case 'proactive-stock-check': {
                const { companyId } = data;
                const [lowStock] = await pool.query(
                    `SELECT nombre, stock, stock_minimo FROM products 
                     WHERE company_id = ? AND status = 'activo' AND stock <= stock_minimo AND stock_minimo > 0
                     LIMIT 10`,
                    [companyId]
                );

                if (lowStock.length > 0) {
                    const [chats] = await pool.query(
                        'SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE (company_id = ? OR company_id IS NULL) AND receive_alerts = 1',
                        [companyId]
                    );

                    let alertMsg = `⚠️ **ALERTA PROACTIVA DE INVENTARIO**\n\nSe detectaron ${lowStock.length} producto(s) en punto de reorden:\n`;
                    lowStock.forEach(p => {
                        alertMsg += `• **${p.nombre}**: ${p.stock} disponibles (Mínimo: ${p.stock_minimo})\n`;
                    });

                    for (const c of chats) {
                        await telegramService.sendMessage(c.chat_id, alertMsg, { parse_mode: 'Markdown' }).catch(() => {});
                    }
                }
                return { checked: lowStock.length };
            }

            case 'proactive-dte-contingency-check': {
                const { companyId } = data;
                // Verificar si hay DTEs pendientes de contingencia
                const [pending] = await pool.query(
                    `SELECT id, tipo_documento, total_pagar, created_at FROM sales_headers
                     WHERE company_id = ? AND estado = 'contingencia'
                       AND created_at < DATE_SUB(NOW(), INTERVAL 18 HOUR)
                     LIMIT 5`,
                    [companyId]
                );

                if (pending.length > 0) {
                    const [chats] = await pool.query(
                        'SELECT DISTINCT chat_id FROM telegram_chat_bindings WHERE (company_id = ? OR company_id IS NULL) AND receive_alerts = 1',
                        [companyId]
                    );
                    const alertMsg = `🚨 **ALERTA DE AGENTE FISCAL DTE**\n\nHay ${pending.length} documento(s) en contingencia con más de 18 horas de emisión. Recuerda que el plazo legal del Ministerio de Hacienda vence a las 24 horas.`;
                    for (const c of chats) {
                        await telegramService.sendMessage(c.chat_id, alertMsg, { parse_mode: 'Markdown' }).catch(() => {});
                    }
                }
                return { pendingCount: pending.length };
            }

            default:
                logger.warn({ jobName }, '[AgentQueue] Job desconocido');
                return { skipped: true };
        }
    }

    executeFallback(jobName, data) {
        setImmediate(async () => {
            try {
                await this.processJob(jobName, data);
            } catch (err) {
                logger.error({ jobName, data, err: err.message }, '[AgentQueue:Fallback] Error ejecutando job en modo local');
            }
        });
    }

    async enqueueJob(jobName, data, opts = {}) {
        if (this.isRedisReady && this.queue) {
            try {
                const job = await this.queue.add(jobName, data, opts);
                return { enqueued: true, jobId: job.id };
            } catch (err) {
                logger.warn({ err: err.message, jobName }, '[AgentQueue] Error encolando en BullMQ, ejecutando en fallback local');
            }
        }

        this.executeFallback(jobName, data);
        return { enqueued: false, fallback: true };
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
            try { await this.redisClient.quit(); } catch { this.redisClient.disconnect(); }
            this.redisClient = null;
        }
        this.isRedisReady = false;
    }
}

const agentQueueInstance = new AgentQueueService();
module.exports = agentQueueInstance;
