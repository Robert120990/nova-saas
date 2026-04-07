const pool = require('../config/db');

const getTaxConfig = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const [rows] = await pool.query('SELECT * FROM tax_configurations WHERE company_id = ?', [companyId]);
        if (rows.length === 0) {
            // Default values
            return res.json({ 
                iva_rate: 13.00, 
                fovial_rate: 0.20, 
                cotrans_rate: 0.10, 
                retencion_rate: 1.00, 
                percepcion_rate: 1.00 
            });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getTaxConfig:', error);
        res.status(500).json({ message: 'Error al obtener impuestos' });
    }
};

const updateTaxConfig = async (req, res) => {
    const { iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate } = req.body;
    try {
        const companyId = req.company_id || req.user?.company_id;
        await pool.query(
            `INSERT INTO tax_configurations (company_id, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                iva_rate = VALUES(iva_rate), 
                fovial_rate = VALUES(fovial_rate), 
                cotrans_rate = VALUES(cotrans_rate),
                retencion_rate = VALUES(retencion_rate),
                percepcion_rate = VALUES(percepcion_rate)`,
            [companyId, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate]
        );
        res.json({ message: 'Impuestos actualizados correctamente' });
    } catch (error) {
        console.error('Error in updateTaxConfig:', error);
        res.status(500).json({ message: 'Error al actualizar impuestos' });
    }
};

module.exports = { getTaxConfig, updateTaxConfig };
