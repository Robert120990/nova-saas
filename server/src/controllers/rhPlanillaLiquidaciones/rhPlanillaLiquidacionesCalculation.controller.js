const pool = require('../../config/db');
const { calculateLiquidaciones } = require('../../services/rhBenefitsCalculation.service');

const calcular = async (req, res) => {
    try { res.json(await calculateLiquidaciones(pool, req.company_id, req.query)); }
    catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};

module.exports = { calcular };
