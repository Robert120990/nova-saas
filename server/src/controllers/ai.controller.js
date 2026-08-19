const { runAssistant } = require('../services/ai.assistant');

/**
 * Novas AI Controller — SQL Engine Mode
 *
 * La lógica completa vive en services/ai.assistant.js (runAssistant),
 * reutilizable por el chat web y por el bot de Telegram.
 */

const chat = async (req, res) => {
    const { messages } = req.body;
    const companyId = req.user.company_id;
    const branchId = req.user.branch_id;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Se requiere un arreglo de mensajes.' });
    }

    try {
        const reply = await runAssistant({ messages, companyId, branchId });
        return res.json({ message: reply });
    } catch (error) {
        console.error('CRITICAL [Novas AI Error]:', error.message);
        res.status(500).json({
            message: error.message || 'Error procesando consulta de IA',
            details: error.message
        });
    }
};

module.exports = { chat };
