/**
 * Unified Cache Service (Redis with In-Memory Fallback)
 * Sipe Web SaaS - Phase 3.1
 */

const Redis = require('ioredis');
const { logger } = require('../utils/logger');

class MemoryStore {
    constructor() {
        this.store = new Map();
        // Periodic cleanup every 5 minutes (unref so it doesn't block process exit)
        this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (item.expiresAt && item.expiresAt <= now) {
                this.store.delete(key);
            }
        }
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (item.expiresAt && item.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    set(key, value, ttlSeconds = 0) {
        const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
        this.store.set(key, { value, expiresAt });
    }

    del(key) {
        return this.store.delete(key);
    }

    delByPattern(pattern) {
        const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexStr);
        let deleted = 0;
        for (const key of this.store.keys()) {
            if (regex.test(key)) {
                this.store.delete(key);
                deleted++;
            }
        }
        return deleted;
    }

    clear() {
        this.store.clear();
    }
}

class CacheService {
    constructor() {
        this.memoryStore = new MemoryStore();
        this.redisClient = null;
        this.isRedisReady = false;
        this.initRedis();
    }

    initRedis() {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        try {
            this.redisClient = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
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
                logger.info('[Cache] Conectado exitosamente al servidor Redis');
            });

            this.redisClient.on('error', (err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[Cache] Redis no disponible, operando en modo local (in-memory fallback)');
            });

            this.redisClient.on('close', () => {
                this.isRedisReady = false;
            });

            // Attempt initial connection without blocking app startup
            this.redisClient.connect().catch((err) => {
                this.isRedisReady = false;
                logger.debug({ err: err.message }, '[Cache] Conexión inicial a Redis no establecida, usando fallback local');
            });
        } catch (initErr) {
            this.isRedisReady = false;
            logger.warn({ err: initErr.message }, '[Cache] Error inicializando cliente Redis, usando memoria interna');
        }
    }

    async get(key) {
        if (this.isRedisReady && this.redisClient) {
            try {
                const data = await this.redisClient.get(key);
                if (data === null || data === undefined) return null;
                return JSON.parse(data);
            } catch (err) {
                logger.debug({ key, err: err.message }, '[Cache] Error leyendo de Redis, consultando fallback');
            }
        }
        return this.memoryStore.get(key) || null;
    }

    async set(key, value, ttlSeconds = 0) {
        const serialized = JSON.stringify(value);
        if (this.isRedisReady && this.redisClient) {
            try {
                if (ttlSeconds > 0) {
                    await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
                } else {
                    await this.redisClient.set(key, serialized);
                }
                return true;
            } catch (err) {
                logger.debug({ key, err: err.message }, '[Cache] Error escribiendo en Redis, usando fallback local');
            }
        }
        this.memoryStore.set(key, value, ttlSeconds);
        return true;
    }

    async del(key) {
        let deleted = false;
        if (this.isRedisReady && this.redisClient) {
            try {
                const res = await this.redisClient.del(key);
                deleted = res > 0;
            } catch (err) {
                logger.debug({ key, err: err.message }, '[Cache] Error eliminando en Redis');
            }
        }
        const memDeleted = this.memoryStore.del(key);
        return deleted || memDeleted;
    }

    async delByPattern(pattern) {
        let total = 0;
        if (this.isRedisReady && this.redisClient) {
            try {
                const keys = await this.redisClient.keys(pattern);
                if (keys && keys.length > 0) {
                    total = await this.redisClient.del(...keys);
                }
            } catch (err) {
                logger.debug({ pattern, err: err.message }, '[Cache] Error borrando por patrón en Redis');
            }
        }
        const memTotal = this.memoryStore.delByPattern(pattern);
        return total + memTotal;
    }

    /**
     * Cache-Aside helper: Returns cached data if available; otherwise calls fetcher, caches, and returns.
     */
    async getOrSet(key, fetcher, ttlSeconds = 300) {
        const cached = await this.get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) {
            await this.set(key, fresh, ttlSeconds);
        }
        return fresh;
    }

    isRedisActive() {
        return this.isRedisReady;
    }

    async disconnect() {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch {
                this.redisClient.disconnect();
            }
        }
        this.memoryStore.clear();
    }
}

const cacheInstance = new CacheService();
module.exports = cacheInstance;
