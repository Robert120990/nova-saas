const supervisorAgent = require('../services/agents/SupervisorAgent');
const { runAssistant } = require('../services/ai.assistant');
const { getOrCreateSession, saveMessage } = require('../services/agents/agentSessionService');

/**
 * Controller for Novas AI Chat
 * Powered by SupervisorAgent with fallback to legacy engine
 */
const chat = async (req, res) => {
    const { messages } = req.body;
    const companyId = req.company_id || req.user?.company_id;
    const branchId = req.branch_id || req.user?.branch_id;
    const user = req.user || { id: null, nombre: 'Usuario' };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'Se requiere un arreglo de mensajes.' });
    }

    const lastMessage = messages[messages.length - 1];

    try {
        // Multi-agent session tracking
        let session = null;
        if (user.id && companyId) {
            session = await getOrCreateSession({
                channel: 'web',
                externalChatId: `web_user_${user.id}`,
                companyId,
                branchId,
                userId: user.id
            }).catch(e => console.warn('[AI Controller] Session tracking non-fatal error:', e.message));
        }

        const reply = await supervisorAgent.execute({
            messages,
            context: {
                companyId,
                branchId,
                user,
                session,
                userQuery: lastMessage.content || ''
            }
        });

        if (session) {
            saveMessage(session.id, { role: 'user', content: lastMessage.content || '' }).catch(() => {});
            saveMessage(session.id, {
                role: 'assistant',
                agentCode: reply.agentCode || 'supervisor',
                content: reply.content
            }).catch(() => {});
        }

        return res.json({
            message: {
                role: 'assistant',
                content: reply.content,
                agent_code: reply.agentCode || 'supervisor',
                agent_name: reply.agentName || 'Supervisor Novas AI'
            }
        });
    } catch (agentError) {
        console.warn('[AI Controller] Supervisor attempt failed, attempting fallback engine:', agentError.message);
        try {
            const fallbackReply = await runAssistant({ messages, companyId, branchId });
            return res.json({
                message: {
                    role: 'assistant',
                    content: fallbackReply?.content || fallbackReply,
                    agent_code: 'supervisor',
                    agent_name: 'Supervisor Novas AI'
                }
            });
        } catch (error) {
            console.error('CRITICAL [Novas AI Error]:', error.message);
            return res.status(500).json({
                message: error.message || 'Error procesando consulta de IA',
                details: error.message
            });
        }
    }
};

module.exports = { chat };
