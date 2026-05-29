const pool = require('../../config/db');
const retornoService = require('../services/retorno/retornoService');

async function generate(req, res) {
    try {
        if (req.body.companyId || req.body.company_id) {
            return res.status(400).json({
                success: false,
                message: 'No está permitido enviar IDs de empresa en el cuerpo.'
            });
        }

        const { codigoGeneracionOriginal, items } = req.body;

        if (!codigoGeneracionOriginal) {
            return res.status(400).json({ success: false, message: 'codigoGeneracionOriginal es requerido' });
        }

        const eret = await retornoService.generateERET(codigoGeneracionOriginal, items, req.company_id);

        res.status(200).json({
            success: true,
            codigoGeneracion: eret.identificacion.codigoGeneracion,
            eret: eret
        });
    } catch (error) {
        console.error('ERET Generate Error:', error.message);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.details || []
        });
    }
}

async function emit(req, res) {
    try {
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

        console.log(`[SecurityAudit] ERET Emit request for Company: ${req.company_id}, User: ${req.user.id}`);

        const result = await retornoService.emitERET(payload, req.company_id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('ERET Emit Error:', error.message);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.details || []
        });
    }
}

async function getStatus(req, res) {
    const { codigoGeneracion } = req.params;
    try {
        const result = await retornoService.getRetornoStatus(codigoGeneracion, req.company_id);
        res.status(200).json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
}

async function list(req, res) {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE tipo_dte = ? AND company_id = ?';
        const params = ['18', req.company_id];

        if (search) {
            whereClause += ' AND (codigo_generacion LIKE ? OR json_original LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }

        const [countRows] = await pool.query(
            `SELECT COUNT(*) as total FROM dtes ${whereClause}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT id, codigo_generacion, tipo_dte, status, sello_recepcion, fh_procesamiento, created_at, respuesta_hacienda, branch_id,
                    JSON_UNQUOTE(JSON_EXTRACT(json_original, '$.documentoRelacionado[0].codigoGeneracion')) as codigo_generacion_original
             FROM dtes ${whereClause} 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('ERET List Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = { generate, emit, getStatus, list };
