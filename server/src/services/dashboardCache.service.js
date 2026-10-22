const cache = require('../config/cache');

const DASHBOARD_TTL_SECONDS = 45;

/**
 * Cache-aside helper for dashboard metrics.
 * Supports bypassing cache via force = true (e.g. ?force=true).
 *
 * @param {string} key Cache key
 * @param {Function} fetcher Async function returning fresh data
 * @param {number} ttlSeconds TTL in seconds (default 45s)
 * @param {boolean} force If true, bypass and update cache
 * @returns {Promise<any>}
 */
const getOrSetDashboard = async (key, fetcher, ttlSeconds = DASHBOARD_TTL_SECONDS, force = false) => {
    if (force) {
        await cache.del(key);
    } else {
        const cached = await cache.get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
    }

    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
        await cache.set(key, fresh, ttlSeconds);
    }
    return fresh;
};

module.exports = {
    getOrSetDashboard,
    DASHBOARD_TTL_SECONDS
};
