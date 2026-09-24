/**
 * Contingency Resend Queue using BullMQ with Transparent In-Memory Fallback
 * Sipe Web SaaS - Phase 3.2
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const axios = require('axios');
const pool = require('../config/db');
const { logger } = require('../utils/logger');
const { authenticate, transmitDTE } = require('../transmission/transmissionService');
const { getSchemaVersion } = require('../utils/versionMap');
const { getMHAmbiente } = require('../config/haciendaConfig');

const QUEUE_NAME = 'contingency-resend-queue';
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF_DELAY = 10000;

class ContingencyQueueService {
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
                logger.info('[ContingencyQueue] Conectado exitosamente al servidor Redis');
                this.ensureQueueAndWorker();
            });

            this.redisClient.on('error', (err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[ContingencyQueue] Redis no disponible para colas de contingencia, operando en fallback local');
            });

            this.redisClient.on('close', () => {
                this.isRedisReady = false;
            });

            this.redisClient.connect().catch((err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[ContingencyQueue] Conexión inicial Redis no establecida, operando en fallback');
            });
        } catch (initErr) {
            this.isRedisReady = false;
            logger.warn({ err: initErr.message }, '[ContingencyQueue] Error al inicializar cliente Redis');
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
                    removeOnComplete: { count: 50, age: 3600 },
                    removeOnFail: { count: 100 }
                }
            });
        }

        if (!this.worker) {
            this.worker = new Worker(QUEUE_NAME, async (job) => {
                return this.processDocumentJob(job.data);
            }, {
                connection: this.redisClient,
                concurrency: 2
            });

            this.worker.on('completed', (job) => {
                logger.info({ jobId: job.id, codigoGeneracion: job.data?.codigoGeneracion }, '[ContingencyQueue] Documento de contingencia retransmitido exitosamente');
            });

            this.worker.on('failed', (job, err) => {
                logger.error({ jobId: job?.id, codigoGeneracion: job?.data?.codigoGeneracion, attemptsMade: job?.attemptsMade, err: err?.message }, '[ContingencyQueue] Error retransmitiendo documento de contingencia');
            });

            this.worker.on('error', (err) => {
                logger.debug({ err: err.message }, '[ContingencyQueue] Worker error handled');
            });
        }
    }

    async processDocumentJob(data) {
        const { docId, codigoGeneracion, companyId } = data;

        // 1. Double check: Contingency must NOT be OPEN
        const [openContingencies] = await pool.query(
            'SELECT id FROM dte_contingencies WHERE company_id = ? AND estado = "OPEN" LIMIT 1',
            [companyId]
        );
        if (openContingencies.length > 0) {
            logger.warn({ companyId, codigoGeneracion }, '[ContingencyQueue] Empresa tiene una contingencia ABIERTA activa. Se pospone retransmisión.');
            throw new Error(`Empresa ${companyId} tiene contingencia abierta activa. Intento pospuesto.`);
        }

        // 2. Fetch full document details
        const [rows] = await pool.query(
            'SELECT cd.*, c.api_user, c.api_password, d.ambiente, d.id as dte_id, d.venta_id, d.company_id ' +
            'FROM dte_contingency_documents cd ' +
            'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
            'JOIN companies c ON d.company_id = c.id ' +
            'WHERE cd.id = ?',
            [docId]
        );

        if (!rows.length) {
            logger.warn({ docId }, '[ContingencyQueue] Documento de contingencia no encontrado en base de datos');
            return { skipped: true, reason: 'Document not found' };
        }

        const task = rows[0];
        if (task.estado_envio === 'SENT') {
            return { alreadyProcessed: true };
        }

        // 3. Authenticate with Hacienda
        const auth = await authenticate(task.api_user, task.api_password, task.ambiente);
        if (!auth.success) {
            throw new Error(`Autenticación MH fallida: ${auth.message}`);
        }

        // 4. Transmit to Hacienda
        const version = getSchemaVersion(task.tipo_documento);
        const ambiente = getMHAmbiente(task.ambiente);
        const result = await transmitDTE(auth.token, task.json_firmado, {
            ambiente: ambiente,
            tipoDte: task.tipo_documento,
            codigoGeneracion: task.codigo_generacion,
            version: version,
            apiUser: task.api_user
        });

        // 5. Handle MH response
        if (result.success && result.status === 'PROCESADO') {
            let formattedDate = result.fhProcesamiento || null;
            if (formattedDate && formattedDate.includes('/')) {
                const [datePart, timePart] = formattedDate.split(' ');
                const [day, month, year] = datePart.split('/');
                formattedDate = `${year}-${month}-${day} ${timePart}`;
            }

            await pool.query(
                'UPDATE dte_contingency_documents SET estado_envio = "SENT", fecha_envio_hacienda = NOW() WHERE id = ?',
                [task.id]
            );
            await pool.query(
                'UPDATE dtes SET status = "ACCEPTED", sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                [result.selloRecepcion, formattedDate, task.codigo_generacion]
            );
            await pool.query(
                'UPDATE sales_headers SET sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                [result.selloRecepcion, formattedDate, task.codigo_generacion]
            );
            await pool.query(
                'INSERT INTO dte_events (dte_id, event_type, description) VALUES (?, "RETRANSMITTED", "Documento retransmitido y aceptado por MH post-contingencia")',
                [task.dte_id]
            );

            logger.info({ codigoGeneracion: task.codigo_generacion, sello: result.selloRecepcion }, '[ContingencyQueue] DTE aceptado con sello oficial');

            // Notify main server to send official email asynchronously
            if (task.venta_id) {
                const mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:4000';
                try {
                    await axios.post(`${mainServerUrl}/api/internal/dte/notify-accepted`, {
                        codigoGeneracion: task.codigo_generacion,
                        ventaId: task.venta_id,
                        companyId: task.company_id
                    }, { timeout: 10000 });
                } catch (mailErr) {
                    logger.warn({ err: mailErr.message }, '[ContingencyQueue] Advertencia al notificar envío de correo al servidor principal');
                }
            }

            return { success: true, sello: result.selloRecepcion };
        } else {
            // MH Rejected or connection error
            const retries = (task.retry_count || 0) + 1;
            const lastErrorMsg = JSON.stringify(result.error || result.data || 'Rechazo MH sin detalle');
            
            await pool.query(
                'UPDATE dte_contingency_documents SET retry_count = ?, last_error = ? WHERE id = ?',
                [retries, lastErrorMsg, task.id]
            );

            // If error is temporary, throw to trigger BullMQ exponential backoff
            const isTransient = !result.error?.codigoMsg || ['503', 'ETIMEDOUT', 'ECONNRESET'].some(code => String(result.error).includes(code));
            if (isTransient) {
                throw new Error(`Error temporal de conexión con Hacienda: ${lastErrorMsg}`);
            }

            // Definite rejection: update status
            await pool.query('UPDATE dtes SET status = "ERROR" WHERE codigo_generacion = ?', [task.codigo_generacion]);
            await pool.query(
                'INSERT INTO dte_errors (dte_id, codigo_error, mensaje_error) VALUES (?, "CONT_RETRY_ERR", ?)',
                [task.dte_id, lastErrorMsg]
            );

            return { success: false, rejected: true, error: lastErrorMsg };
        }
    }

    async enqueueContingencyDocuments(companyId) {
        // Fetch all pending documents for this company (ensuring contingency is NOT OPEN)
        const [docs] = await pool.query(
            'SELECT cd.id, cd.codigo_generacion, d.company_id ' +
            'FROM dte_contingency_documents cd ' +
            'JOIN dtes d ON cd.codigo_generacion = d.codigo_generacion ' +
            'WHERE d.company_id = ? AND cd.estado_envio = "PENDING" ' +
            '  AND NOT EXISTS (' +
            '      SELECT 1 FROM dte_contingencies dc ' +
            '      WHERE dc.company_id = d.company_id AND dc.estado = "OPEN"' +
            '  ) ' +
            'ORDER BY cd.created_at ASC',
            [companyId]
        );

        if (!docs.length) {
            logger.info({ companyId }, '[ContingencyQueue] No hay documentos pendientes para encolar en contingencia');
            return { enqueued: 0 };
        }

        logger.info({ companyId, count: docs.length }, '[ContingencyQueue] Encolando lote de documentos post-contingencia');

        if (this.isRedisReady && this.queue) {
            try {
                const jobs = docs.map(doc => ({
                    name: 'transmit-contingency-dte',
                    data: {
                        docId: doc.id,
                        codigoGeneracion: doc.codigo_generacion,
                        companyId: doc.company_id
                    }
                }));

                await this.queue.addBulk(jobs);
                return { enqueued: docs.length, inBullMQ: true };
            } catch (err) {
                logger.warn({ err: err.message }, '[ContingencyQueue] Error al encolar en BullMQ, ejecutando en fallback local');
            }
        }

        // Fallback: Trigger legacy background processor
        const { processContingencyQueue } = require('../jobs/resendContingencyDTE');
        setImmediate(() => {
            processContingencyQueue().catch(err => {
                logger.error({ err: err.message }, '[ContingencyQueue:Fallback] Error en procesamiento local de contingencia');
            });
        });

        return { enqueued: docs.length, fallback: true };
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

const contingencyQueueInstance = new ContingencyQueueService();
module.exports = contingencyQueueInstance;
