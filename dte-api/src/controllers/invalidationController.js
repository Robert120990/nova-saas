/**
 * Invalidation Controller
 */

const invalidationService = require('../invalidation/invalidationService');

async function invalidate(req, res) {
    try {
        // SECURITY: Reject tenant-level fields in the body
        if (req.body.companyId || req.body.company_id || req.body.userId || req.body.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'No está permitido enviar IDs de empresa o usuario en el cuerpo.' 
            });
        }

        const payload = {
            ...req.body,
            companyId: req.company_id,
            user: req.user
        };
        
        console.log(`[SecurityAudit] Invalidation request for Company: ${req.company_id}, User: ${req.user.id}`);

        const result = await invalidationService.invalidateDTE(payload, req.company_id, req.user);
        res.status(200).json(result);

    } catch (error) {
        console.error('Invalidation Request Error:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
}

async function getStatus(req, res) {
    const { codigoGeneracion } = req.params;
    try {
        const result = await invalidationService.getInvalidationStatus(codigoGeneracion, req.company_id);
        res.status(200).json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
}

module.exports = { invalidate, getStatus };
