const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { mailQueue } = require('../../src/queue');
const mailerService = require('../../src/services/mailer.service');

describe('Fase 3.2: BullMQ Mail Queue & Background Worker Unit Tests', () => {
    after(async () => {
        await new Promise(r => setTimeout(r, 50));
        await mailQueue.close();
        const pool = require('../../src/config/db');
        await pool.end();
    });

    test('should properly expose mailQueue instance and status', () => {
        assert.ok(mailQueue, 'mailQueue should be defined');
        assert.equal(typeof mailQueue.enqueueDTEEmail, 'function');
        assert.equal(typeof mailQueue.enqueueInvalidatedDTEEmail, 'function');
        assert.equal(typeof mailQueue.enqueuePaymentReceipt, 'function');
        assert.equal(typeof mailQueue.enqueueAdvanceReceipt, 'function');
        assert.equal(typeof mailQueue.enqueueMail, 'function');
        assert.equal(typeof mailQueue.close, 'function');
        assert.equal(typeof mailQueue.isRedisReady, 'boolean');
    });

    test('should expose queue helper methods on mailerService', () => {
        assert.equal(typeof mailerService.queueDTEEmail, 'function');
        assert.equal(typeof mailerService.queueInvalidatedDTEEmail, 'function');
        assert.equal(typeof mailerService.queuePaymentReceipt, 'function');
        assert.equal(typeof mailerService.queueAdvanceReceipt, 'function');
        assert.equal(typeof mailerService.queueMail, 'function');
    });

    test('should safely enqueue DTE email (either via BullMQ or resilient local fallback)', async () => {
        const result = await mailQueue.enqueueDTEEmail(999999, 1);
        assert.ok(result, 'enqueue result should be defined');
        // If Redis is online: result.enqueued === true.
        // If Redis is offline: result.enqueued === false and result.fallback === true.
        if (result.enqueued) {
            assert.ok(result.jobId, 'jobId should exist if enqueued');
        } else {
            assert.equal(result.fallback, true, 'fallback flag should be true when Redis is offline');
        }
    });

    test('should safely enqueue Invalidated DTE email without throwing error', async () => {
        const result = await mailQueue.enqueueInvalidatedDTEEmail(999999, 1);
        assert.ok(result, 'result should be defined');
        assert.ok(result.enqueued === true || result.fallback === true);
    });

    test('should safely enqueue generic notification mail via mailerService helper', async () => {
        const result = await mailerService.queueMail({
            branchId: 1,
            to: 'test@example.com',
            subject: 'Test Notification',
            text: 'Hello test',
            html: '<p>Hello test</p>'
        });
        assert.ok(result, 'result should be defined');
        assert.ok(result.enqueued === true || result.fallback === true);
    });
});
