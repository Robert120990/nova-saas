const pool = require('../config/db');

const getTaxConfig = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const [rows] = await pool.query('SELECT * FROM tax_configurations WHERE company_id = ?', [companyId]);
        if (rows.length === 0) {
            // Determine intelligent default for aplica_pago_cuenta based on company type
            const [companies] = await pool.query('SELECT tipo_persona, codigo_actividad FROM companies WHERE id = ?', [companyId]);
            const isPersonaNatural = String(companies[0]?.tipo_persona) === '1';
            const isServicios = ['62010', '62020', '69100', '69200', '71100', '71200', '86201'].includes(companies[0]?.codigo_actividad);
            const defaultAplicaPagoCuenta = !(isPersonaNatural && isServicios);

            return res.json({ 
                iva_rate: 13.00, 
                fovial_rate: 0.20, 
                cotrans_rate: 0.10, 
                retencion_rate: 1.00, 
                percepcion_rate: 1.00,
                compras_afectan_libro_compras: false,
                aplica_pago_cuenta: defaultAplicaPagoCuenta
            });
        }
        res.json({
            ...rows[0],
            compras_afectan_libro_compras: Boolean(rows[0].compras_afectan_libro_compras),
            aplica_pago_cuenta: rows[0].aplica_pago_cuenta !== null ? Boolean(rows[0].aplica_pago_cuenta) : true
        });
    } catch (error) {
        console.error('Error in getTaxConfig:', error);
        res.status(500).json({ message: 'Error al obtener impuestos' });
    }
};

const updateTaxConfig = async (req, res) => {
    const { iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate, compras_afectan_libro_compras, aplica_pago_cuenta } = req.body;
    try {
        const companyId = req.company_id || req.user?.company_id;
        const afectaCompras = compras_afectan_libro_compras ? 1 : 0;
        const pagoCuentaVal = (aplica_pago_cuenta !== undefined && !aplica_pago_cuenta) ? 0 : 1;
        await pool.query(
            `INSERT INTO tax_configurations (company_id, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate, compras_afectan_libro_compras, aplica_pago_cuenta) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                iva_rate = VALUES(iva_rate), 
                fovial_rate = VALUES(fovial_rate), 
                cotrans_rate = VALUES(cotrans_rate),
                retencion_rate = VALUES(retencion_rate),
                percepcion_rate = VALUES(percepcion_rate),
                compras_afectan_libro_compras = VALUES(compras_afectan_libro_compras),
                aplica_pago_cuenta = VALUES(aplica_pago_cuenta)`,
            [companyId, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate, afectaCompras, pagoCuentaVal]
        );
        res.json({ message: 'Impuestos actualizados correctamente' });
    } catch (error) {
        console.error('Error in updateTaxConfig:', error);
        res.status(500).json({ message: 'Error al actualizar impuestos' });
    }
};

module.exports = { getTaxConfig, updateTaxConfig };
