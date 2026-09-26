const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../../src/config/cache');

describe('DTE-API Fase 3.1: Cache & Token Storage Tests', () => {
    after(async () => {
        await cache.disconnect();
    });

    test('should cache and retrieve Hacienda MH auth token', async () => {
        const cacheKey = 'mh:token:06141234567890:00';
        const sampleToken = 'eyJhbGciOiJIUzUxMiJ9.sample_hacienda_token';

        await cache.set(cacheKey, sampleToken, 3600);
        const retrieved = await cache.get(cacheKey);

        assert.equal(retrieved, sampleToken);
    });

    test('should invalidate cached token on auth error', async () => {
        const cacheKey = 'mh:token:test_user:00';
        await cache.set(cacheKey, 'token_to_purge', 3600);
        assert.equal(await cache.get(cacheKey), 'token_to_purge');

        await cache.del(cacheKey);
        assert.equal(await cache.get(cacheKey), null);
    });

    test('should purge all mh tokens by pattern', async () => {
        await cache.set('mh:token:user1:00', 'token1', 3600);
        await cache.set('mh:token:user2:01', 'token2', 3600);
        await cache.set('other:token:key', 'other', 3600);

        const count = await cache.delByPattern('mh:token:*');
        assert.ok(count >= 2);

        assert.equal(await cache.get('mh:token:user1:00'), null);
        assert.equal(await cache.get('mh:token:user2:01'), null);
        assert.equal(await cache.get('other:token:key'), 'other');

        await cache.del('other:token:key');
    });
});
