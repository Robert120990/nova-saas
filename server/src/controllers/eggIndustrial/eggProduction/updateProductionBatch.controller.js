const { pool } = require('./shared');
const closedBatchEditService = require('../../../services/eggIndustrial/eggClosedBatchEdit.service');

const updateProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await closedBatchEditService.applyBatchEditInTransaction(
            connection,
            req,
            req.params.id,
            req.company_id,
            req.body || {}
        );
        await connection.commit();
        res.json(result);
    } catch (error) {
        await connection.rollback();
        console.error('Error in updateProductionBatch:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

module.exports = { updateProductionBatch };
