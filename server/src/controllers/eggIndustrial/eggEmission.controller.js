const pool = require('../../config/db');
const { emitSavedSale } = require('../../services/eggDispatchEmission.service');
const { reconcileEmission } = require('../../services/eggDispatchRecovery.service');

exports.getEmission = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT sale_id, status, result_json, updated_at FROM egg_dispatch_emissions WHERE company_id = ? AND sale_id = ?', [req.company_id, req.params.saleId]);
        if (!rows.length) return res.status(404).json({ message: 'Emisión industrial no encontrada.' });
        res.json(rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.recoverEmission = async (req, res) => {
    try {
        const result = await reconcileEmission(req.company_id, req.params.saleId);
        res.json(result.pending ? await emitSavedSale(req.company_id, req.params.saleId) : result);
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
