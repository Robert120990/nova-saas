const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/db');
const salesIntegrityAuditService = require('../../src/services/salesIntegrityAudit.service');
const salesIntegrityAuditController = require('../../src/controllers/sales/salesIntegrityAudit.controller');

describe('Sales Integrity Audit Service & Controller', () => {
    it('should export all required service functions', () => {
        assert.equal(typeof salesIntegrityAuditService.runSalesIntegrityAudit, 'function');
        assert.equal(typeof salesIntegrityAuditService.syncUnsyncedDteStamps, 'function');
        assert.equal(typeof salesIntegrityAuditService.generateAuditPdfBuffer, 'function');
    });

    it('should throw an error when companyId is missing in runSalesIntegrityAudit', async () => {
        await assert.rejects(
            async () => {
                await salesIntegrityAuditService.runSalesIntegrityAudit(null);
            },
            { message: 'company_id es requerido para la auditoría de ventas.' }
        );
    });

    it('should throw an error when companyId is missing in generateAuditPdfBuffer', async () => {
        await assert.rejects(
            async () => {
                await salesIntegrityAuditService.generateAuditPdfBuffer(null);
            },
            { message: 'company_id es requerido para generar el dictamen PDF.' }
        );
    });

    it('should export all required controller functions', () => {
        assert.equal(typeof salesIntegrityAuditController.getSalesIntegrityAudit, 'function');
        assert.equal(typeof salesIntegrityAuditController.exportSalesIntegrityAuditPDF, 'function');
        assert.equal(typeof salesIntegrityAuditController.syncUnsyncedDteStamps, 'function');
    });

    it('should execute audit for company 9 (ANDELSA) and return valid structure', async () => {
        const result = await salesIntegrityAuditService.runSalesIntegrityAudit(9);
        assert.ok(result);
        assert.ok(result.empresa);
        assert.equal(result.empresa.id, 9);
        assert.ok(result.resumen);
        assert.ok(result.resumen.total_ventas > 0);
        assert.ok(Array.isArray(result.ventas_sin_sello_fantasma));
        assert.ok(Array.isArray(result.duplicados_sospechosos_hacienda));
        assert.ok(Array.isArray(result.sellos_desincronizados));
        assert.ok(Array.isArray(result.auditoria_pedidos_automaticos));
        assert.ok(Array.isArray(result.ventas_multi_sucursal_legitimas));
    });

    it('should execute audit for company 1 (high-volume multi-company) within performance budget', async () => {
        const start = Date.now();
        const result = await salesIntegrityAuditService.runSalesIntegrityAudit(1);
        const duration = Date.now() - start;
        assert.ok(result);
        assert.ok(result.resumen.total_ventas > 1000);
        assert.ok(duration < 5000, `Execution took ${duration}ms, exceeding budget`);
    });

    it('should generate valid PDF buffer for company 9', async () => {
        const pdfBuffer = await salesIntegrityAuditService.generateAuditPdfBuffer(9);
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.ok(pdfBuffer.length > 1000);
        assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('should generate valid PDF buffer for company 1', async () => {
        const pdfBuffer = await salesIntegrityAuditService.generateAuditPdfBuffer(1);
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.ok(pdfBuffer.length > 1000);
        assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    after(async () => {
        try {
            await pool.end();
        } catch (_) {}
    });
});
