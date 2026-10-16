const pool = require('../config/db');
const whatsappService = require('../services/whatsapp.service');

const getSettings = async (req, res) => {
    const { branchId } = req.params;
    try {
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branchId, req.company_id]
        );
        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta sucursal' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM whatsapp_settings WHERE branch_id = ?',
            [branchId]
        );
        if (rows.length === 0) {
            return res.json(null);
        }

        res.json({
            ...rows[0],
            token: rows[0].token ? '********' + String(rows[0].token).slice(-4) : '',
            has_token: Boolean(rows[0].token)
        });
    } catch (error) {
        console.error('Error in getWhatsAppSettings:', error);
        res.status(500).json({ message: 'Error al obtener configuración WhatsApp' });
    }
};

const saveSettings = async (req, res) => {
    const { branch_id, phone_number_id, token, from_phone } = req.body;
    if (!branch_id || !phone_number_id || !from_phone) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    try {
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branch_id, req.company_id]
        );
        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para configurar esta sucursal' });
        }

        let finalToken = token ? String(token).trim() : '';
        if (!finalToken || finalToken.includes('***')) {
            const [existingRows] = await pool.query(
                'SELECT token FROM whatsapp_settings WHERE branch_id = ?',
                [branch_id]
            );
            finalToken = existingRows[0]?.token || '';
            if (!finalToken) {
                return res.status(400).json({ message: 'El token de WhatsApp es requerido' });
            }
        }

        await pool.query(
            `INSERT INTO whatsapp_settings (branch_id, phone_number_id, token, from_phone)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             phone_number_id = VALUES(phone_number_id),
             token = VALUES(token),
             from_phone = VALUES(from_phone)`,
            [branch_id, phone_number_id, finalToken, from_phone]
        );

        res.json({ message: 'Configuración WhatsApp guardada exitosamente' });
    } catch (error) {
        console.error('Error in saveWhatsAppSettings:', error);
        res.status(500).json({ message: 'Error al guardar configuración WhatsApp' });
    }
};

const testConnection = async (req, res) => {
    const { branch_id } = req.body;
    if (!branch_id) {
        return res.status(400).json({ message: 'Sucursal es requerida' });
    }

    try {
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branch_id, req.company_id]
        );
        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta sucursal' });
        }

        const result = await whatsappService.testConnection(branch_id);
        res.json({ message: 'Conexión exitosa. Mensaje de prueba enviado.', result });
    } catch (error) {
        res.status(500).json({ message: 'Error de conexión: ' + error.message });
    }
};

module.exports = { getSettings, saveSettings, testConnection };
