const pool = require('../config/db');

/**
 * Obtener el periodo actual de compras para el usuario y empresa
 */
const getPurchasePeriod = async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.company_id || req.user.company_id;

        const [rows] = await pool.query(
            'SELECT year, month FROM purchase_user_periods WHERE user_id = ? AND company_id = ?',
            [userId, companyId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No se ha seleccionado un periodo de compras' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getPurchasePeriod:', error);
        res.status(500).json({ message: 'Error al obtener el periodo de compras' });
    }
};

/**
 * Guardar o actualizar el periodo de compras
 */
const savePurchasePeriod = async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.company_id || req.user.company_id;
        const { year, month } = req.body;

        if (!year || !month) {
            return res.status(400).json({ message: 'Año y mes son requeridos' });
        }

        await pool.query(
            `INSERT INTO purchase_user_periods (user_id, company_id, year, month) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE year = VALUES(year), month = VALUES(month)`,
            [userId, companyId, year, month]
        );

        res.json({ message: 'Periodo guardado correctamente', year, month });
    } catch (error) {
        console.error('Error in savePurchasePeriod:', error);
        res.status(500).json({ message: 'Error al guardar el periodo de compras' });
    }
};

module.exports = {
    getPurchasePeriod,
    savePurchasePeriod
};
