const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../../src/config/cache');

describe('Fase 3.1: Redis & In-Memory Cache Service Unit Tests', () => {
    after(async () => {
        await cache.disconnect();
        const pool = require('../../src/config/db');
        await pool.end();
    });

    test('should set and get a cached item', async () => {
        const key = 'test:item:1';
        const data = { id: 1, name: 'San Salvador', code: '06' };
        
        await cache.set(key, data, 60);
        const retrieved = await cache.get(key);
        
        assert.deepEqual(retrieved, data);
    });

    test('should return null for non-existent key', async () => {
        const val = await cache.get('test:non_existent_key_999');
        assert.equal(val, null);
    });

    test('should delete a cached item', async () => {
        const key = 'test:delete:1';
        await cache.set(key, 'to-be-deleted', 60);
        assert.equal(await cache.get(key), 'to-be-deleted');
        
        const deleted = await cache.del(key);
        assert.equal(deleted, true);
        assert.equal(await cache.get(key), null);
    });

    test('should delete keys matching a pattern', async () => {
        await cache.set('cat:test:alpha', { val: 'a' }, 60);
        await cache.set('cat:test:beta', { val: 'b' }, 60);
        await cache.set('other:test:gamma', { val: 'c' }, 60);

        const count = await cache.delByPattern('cat:test:*');
        assert.ok(count >= 2);

        assert.equal(await cache.get('cat:test:alpha'), null);
        assert.equal(await cache.get('cat:test:beta'), null);
        assert.deepEqual(await cache.get('other:test:gamma'), { val: 'c' });
        
        await cache.del('other:test:gamma');
    });

    test('should use getOrSet cache-aside pattern without re-invoking fetcher', async () => {
        let fetchCount = 0;
        const key = 'test:getOrSet:1';
        
        const fetcher = async () => {
            fetchCount++;
            return { timestamp: 12345, query: 'SELECT * FROM test' };
        };

        const res1 = await cache.getOrSet(key, fetcher, 60);
        assert.equal(fetchCount, 1);
        assert.deepEqual(res1, { timestamp: 12345, query: 'SELECT * FROM test' });

        // Second call should return cached value without calling fetcher
        const res2 = await cache.getOrSet(key, fetcher, 60);
        assert.equal(fetchCount, 1);
        assert.deepEqual(res2, res1);

        await cache.del(key);
    });

    test('should respect TTL expiration', async () => {
        const key = 'test:expiring:1';
        // Set TTL of 1 second
        await cache.set(key, 'temporary_value', 1);
        assert.equal(await cache.get(key), 'temporary_value');

        // Wait 1.1s for expiration
        await new Promise((r) => setTimeout(r, 1100));
        assert.equal(await cache.get(key), null);
    });

    test('should preload official Hacienda catalogs into cache', async () => {
        const { preloadHaciendaCatalogs, getPreloadStatus, OFFICIAL_CATALOG_TABLES } = require('../../src/services/catalogCache.service');
        assert.equal(OFFICIAL_CATALOG_TABLES.length, 25);

        const status = await preloadHaciendaCatalogs();
        assert.equal(status.loaded, true);
        assert.ok(status.tableCount > 0);
        assert.ok(status.totalRecords > 0);

        const readStatus = getPreloadStatus();
        assert.equal(readStatus.loaded, true);

        // Verify that generic catalog key exists in cache
        const cat002 = await cache.get('cat:generic:cat_002_tipo_dte');
        assert.ok(Array.isArray(cat002));
        assert.ok(cat002.length > 0);

        // Verify friendly alias
        const deps = await cache.get('cat:012:departamentos');
        assert.ok(Array.isArray(deps));
        assert.ok(deps.length > 0);
    });
});
