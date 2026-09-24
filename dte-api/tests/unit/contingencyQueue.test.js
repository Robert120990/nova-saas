const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { contingencyQueue } = require('../../src/queue');
const pool = require('../../src/config/db');

describe('DTE-API Fase 3.2: BullMQ Contingency Queue & Worker Tests', () => {
    after(async () => {
        await new Promise(r => setTimeout(r, 50));
        await contingencyQueue.close();
        await pool.end();
    });

    test('should properly expose contingencyQueue instance and core methods', () => {
        assert.ok(contingencyQueue, 'contingencyQueue should be defined');
        assert.equal(typeof contingencyQueue.enqueueContingencyDocuments, 'function');
        assert.equal(typeof contingencyQueue.processDocumentJob, 'function');
        assert.equal(typeof contingencyQueue.close, 'function');
        assert.equal(typeof contingencyQueue.isRedisReady, 'boolean');
    });

    test('should return enqueued: 0 when company has no pending contingency documents', async () => {
        const result = await contingencyQueue.enqueueContingencyDocuments(999999);
        assert.ok(result, 'result should be defined');
        assert.equal(result.enqueued, 0);
    });

    test('should skip non-existent contingency document safely without crashing', async () => {
        const result = await contingencyQueue.processDocumentJob({
            docId: 999999,
            codigoGeneracion: '00000000-0000-0000-0000-000000000000',
            companyId: 999999
        });
        assert.ok(result, 'result should exist');
        assert.equal(result.skipped, true);
        assert.equal(result.reason, 'Document not found');
    });

    test('should throw and postpone if company has an active OPEN contingency', async () => {
        // Temporarily create a mock OPEN contingency for a fictitious company
        const testCompanyId = 888888;
        await pool.query(
            'INSERT INTO dte_contingencies (company_id, branch_id, fecha_inicio, motivo, tipo_contingencia, estado) VALUES (?, 1, NOW(), "Prueba Test", 1, "OPEN")',
            [testCompanyId]
        );

        try {
            await assert.rejects(async () => {
                await contingencyQueue.processDocumentJob({
                    docId: 1,
                    codigoGeneracion: '00000000-0000-0000-0000-000000000000',
                    companyId: testCompanyId
                });
            }, /contingencia abierta activa/);
        } finally {
            // Clean up mock contingency
            await pool.query('DELETE FROM dte_contingencies WHERE company_id = ?', [testCompanyId]);
        }
    });
});
