async function getSettings(branchId) {
    const pool = require('../config/db');
    const [rows] = await pool.query('SELECT * FROM whatsapp_settings WHERE branch_id = ?', [branchId]);
    return rows[0] || null;
}

async function sendMessage(to, message, branchId) {
    const settings = await getSettings(branchId);
    if (!settings) {
        console.warn(`[WhatsApp] No hay configuración para sucursal ${branchId}`);
        return null;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${settings.phone_number_id}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: message }
                }),
                signal: AbortSignal.timeout(15000)
            }
        );
        const data = await response.json();
        if (!response.ok) {
            console.error(`[WhatsApp] Error HTTP ${response.status}:`, data);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando mensaje a ${to}:`, error.message);
        return null;
    }
}

async function testConnection(branchId) {
    const settings = await getSettings(branchId);
    if (!settings) {
        throw new Error('No hay configuración de WhatsApp para esta sucursal');
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${settings.phone_number_id}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: settings.from_phone,
                    type: 'text',
                    text: { body: 'Prueba de conexion - Sistema de Notificaciones\n\nSi recibes este mensaje, la configuracion de WhatsApp funciona correctamente.' }
                }),
                signal: AbortSignal.timeout(15000)
            }
        );
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.error?.message || `Error HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { sendMessage, getSettings, testConnection };
