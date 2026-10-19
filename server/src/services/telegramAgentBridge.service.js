const pool = require('../config/db');
const telegramService = require('./telegram.service');
const supervisorAgent = require('./agents/SupervisorAgent');
const agentRegistry = require('./agents/agentRegistry');
const {
    getOrCreateSession,
    saveMessage,
    updateAuditAction
} = require('./agents/agentSessionService');

/**
 * Bridge connecting the Telegram Bot with the Multi-Agent Supervisor
 * and Human-in-the-Loop interactive callback queries.
 */

async function handleAgentTelegramCommand(chatId, text) {
    const trimmed = text.trim().toLowerCase();

    if (trimmed === '/agentes') {
        const agents = agentRegistry.getAllAgents();
        let msg = '🤖 *EQUIPO DE AGENTES DISPONIBLES EN NOVAS:*\n\n';
        agents.forEach(a => {
            msg += `🔹 *${a.name}* (\`/${a.code}\`)\n${a.description}\n\n`;
        });
        msg += '💡 _Puedes escribir tu consulta con lenguaje natural y el Supervisor la delegará al especialista correspondiente, o usar un comando directo._';
        await telegramService.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        return true;
    }

    const commandAgentMap = {
        '/contador': 'accounting',
        '/cpa': 'accounting',
        '/fiscal': 'dte',
        '/dte': 'dte',
        '/ventas': 'sales',
        '/inventario': 'inventory',
        '/kardex': 'inventory',
        '/tanques': 'gas',
        '/gas': 'gas',
        '/tecnico': 'tech',
        '/sysadmin': 'tech',
        '/supervisor': 'supervisor'
    };

    if (commandAgentMap[trimmed]) {
        const code = commandAgentMap[trimmed];
        const agent = code === 'supervisor' ? supervisorAgent : agentRegistry.getAgent(code);
        if (agent) {
            await telegramService.sendMessage(
                chatId,
                `✅ Conectado con *${agent.name}*.\n\n${agent.description}\n\n¿En qué te puedo ayudar hoy?`,
                { parse_mode: 'Markdown' }
            );
            return true;
        }
    }

    return false;
}

async function handleAgentTelegramMessage(chatId, text, from, state) {
    // 1. Verificar comandos de agentes
    const handledCommand = await handleAgentTelegramCommand(chatId, text);
    if (handledCommand) return;

    // 2. Indicador visual de typing en Telegram
    telegramService.apiCall('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

    try {
        const session = await getOrCreateSession({
            channel: 'telegram',
            externalChatId: chatId,
            companyId: state.companyId || 1,
            branchId: state.branchId,
            userId: null
        });

        // 3. Cargar permisos y configuración de allowed_agents del binding
        let allowedAgents = null;
        let bindingName = from?.first_name || from?.username || 'Usuario Telegram';
        let canApprove = false;
        let bindingCompanyId = state?.companyId || session.company_id || 1;
        let bindingBranchId = state?.branchId || null;

        try {
            const [bindings] = await pool.query(
                'SELECT * FROM telegram_chat_bindings WHERE chat_id = ?',
                [chatId]
            );
            if (bindings.length === 0) {
                await telegramService.sendMessage(
                    chatId,
                    '🔒 Acceso restringido. Tu cuenta de Telegram no está vinculada a ninguna empresa autorizada.'
                );
                return;
            }
            const b = bindings[0];
            bindingCompanyId = b.company_id || state?.companyId || session.company_id || 1;
            bindingBranchId = b.branch_id || state?.branchId;
            if (b.nombre) bindingName = b.nombre;
            canApprove = Boolean(b.can_approve_entries);
            if (b.allowed_agents) {
                const parsed = typeof b.allowed_agents === 'string'
                    ? JSON.parse(b.allowed_agents)
                    : b.allowed_agents;
                if (Array.isArray(parsed)) allowedAgents = parsed;
            }
        } catch (err) {
            console.error('[TelegramAgentBridge] Error consultando binding:', err.message);
        }

        const hasRestrictedAgents = Array.isArray(allowedAgents) && !allowedAgents.includes('all');
        const effectiveAllowedAgents = Array.isArray(allowedAgents)
            ? allowedAgents
            : (canApprove ? null : ['accounting', 'dte', 'sales', 'inventory', 'gas', 'operations']);

        const user = {
            id: null,
            nombre: bindingName,
            role: (canApprove && !hasRestrictedAgents) ? 'Admin' : 'Operator',
            company_id: bindingCompanyId,
            branch_id: bindingBranchId,
            allowed_agents: Array.isArray(effectiveAllowedAgents) ? effectiveAllowedAgents : null,
            can_approve_entries: canApprove
        };

        const result = await supervisorAgent.handleUserMessage({
            text,
            session,
            user
        });

        // 4. Guardar historial
        await saveMessage(session.id, { role: 'user', content: text });
        await saveMessage(session.id, {
            role: 'assistant',
            agentCode: result.agentCode || 'supervisor',
            content: result.content
        });

        // 5. Verificar si hay propuestas de acción pendientes para adjuntar botones HitL
        let extraOptions = {};
        const replyText = result.content || 'He procesado tu consulta.';

        // Detectar si el Agente Contador u Operaciones generó una partida pendiente
        if (result.toolResults && result.toolResults.length > 0) {
            for (const tr of result.toolResults) {
                let parsed = {};
                try { parsed = JSON.parse(tr.content); } catch { /* ignore parsing error */ }

                // Si fue un preview de partida automática o manual que puede asentarse
                if (parsed.status === 'success' && parsed.kind && !parsed.already_generated && parsed.balanced) {
                    const auditId = await require('./agents/agentSessionService').logAuditAction({
                        sessionId: session.id,
                        companyId: state.companyId,
                        branchId: state.branchId,
                        agentCode: 'accounting',
                        actionType: 'post_system_entry',
                        description: `Asentar partida de ${parsed.kind} del ${parsed.date}`,
                        payload: { kind: parsed.kind, date: parsed.date },
                        status: 'pending_approval'
                    });

                    extraOptions = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ Asentar en Libro Diario', callback_data: `agent_post:${auditId}` },
                                    { text: '❌ Descartar', callback_data: `agent_cancel:${auditId}` }
                                ]
                            ]
                        }
                    };
                    break;
                } else if (parsed.status === 'valid' && parsed.lines && parsed.balanced) {
                    const auditId = await require('./agents/agentSessionService').logAuditAction({
                        sessionId: session.id,
                        companyId: state.companyId,
                        branchId: state.branchId,
                        agentCode: 'accounting',
                        actionType: 'post_manual_entry',
                        description: `Asentar partida independiente: ${parsed.description}`,
                        payload: {
                            entry_type_code: parsed.entry_type || 'DIARIO',
                            date: parsed.date,
                            description: parsed.description,
                            lines: parsed.lines
                        },
                        status: 'pending_approval'
                    });

                    extraOptions = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '💾 Asentar Partida', callback_data: `agent_post:${auditId}` },
                                    { text: '❌ Cancelar', callback_data: `agent_cancel:${auditId}` }
                                ]
                            ]
                        }
                    };
                    break;
                }
            }
        }

        const AGENT_BADGES = {
            accounting: '⚖️ Agente Contador CPA',
            dte: '📑 Agente Fiscal & DTE',
            sales: '📈 Agente Comercial & Ventas',
            gas: '⛽ Agente de Combustibles & Pistas',
            inventory: '📦 Agente de Inventarios & Kardex',
            tech: '🛠️ Agente Técnico & SysAdmin',
            operations: '⚙️ Agente de Operaciones',
            supervisor: '🤖 Supervisor Novas AI'
        };

        const badge = AGENT_BADGES[result.agentCode] || '🤖 Supervisor Novas AI';
        let formattedReply = replyText;
        if (!replyText.startsWith('*[') && !replyText.startsWith('**[')) {
            formattedReply = `*[${badge}]*\n\n${replyText}`;
        }

        await telegramService.sendMessage(chatId, formattedReply, extraOptions);
    } catch (error) {
        console.error('[TelegramAgentBridge] Error:', error.message);
        await telegramService.sendMessage(
            chatId,
            `⚠️ Error procesando tu consulta con el Supervisor: ${error.message}`
        );
    }
}

async function handleAgentTelegramCallback(cb) {
    const data = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const userDisplayName = cb.from?.first_name || cb.from?.username || 'Administrador';

    if (!data.startsWith('agent_post:') && !data.startsWith('agent_cancel:')) {
        return false;
    }

    telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

    // 1. Validar vinculación del chat y permisos
    const [bindings] = await pool.query(
        'SELECT company_id, branch_id, can_approve_entries FROM telegram_chat_bindings WHERE chat_id = ?',
        [chatId]
    );
    if (bindings.length === 0) {
        await telegramService.sendMessage(chatId, '⛔ Tu cuenta no está vinculada al sistema.');
        return true;
    }
    const binding = bindings[0];

    if (data.startsWith('agent_post:')) {
        const auditId = parseInt(data.replace('agent_post:', ''), 10);
        if (isNaN(auditId)) return true;

        if (!binding.can_approve_entries) {
            await telegramService.sendMessage(chatId, '⛔ No cuentas con permisos para asentar o aprobar partidas contables.');
            return true;
        }

        const [auditRows] = await pool.query(
            'SELECT company_id, status FROM ai_agent_actions_audit WHERE id = ?',
            [auditId]
        );
        if (auditRows.length === 0) {
            await telegramService.sendMessage(chatId, '⚠️ La propuesta de partida no existe o ya no está disponible.');
            return true;
        }
        if (binding.company_id !== null && auditRows[0].company_id !== binding.company_id) {
            await telegramService.sendMessage(chatId, '⛔ No tienes permiso para operar acciones de otra empresa.');
            return true;
        }
        if (auditRows[0].status !== 'pending_approval') {
            await telegramService.sendMessage(chatId, `ℹ️ Esta acción ya fue ${auditRows[0].status === 'executed' ? 'asentada' : 'cancelada'} previamente.`);
            return true;
        }

        try {
            const operationsAgent = agentRegistry.getAgent('operations');
            const execution = await operationsAgent.executeApprovedAction(
                auditId,
                { id: null, nombre: `${userDisplayName} (Telegram)` },
                'telegram'
            );

            await telegramService.sendMessage(
                chatId,
                `✅ **ACCIÓN ASENTADA CON ÉXITO**\n\n${execution.result?.message || 'Partida contable registrada oficialmente en el sistema.'}\n\n_Autorizado por: ${userDisplayName}_`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            await telegramService.sendMessage(
                chatId,
                `❌ Error al asentar la partida contable: ${err.message}`
            );
        }
        return true;
    }

    if (data.startsWith('agent_cancel:')) {
        const auditId = parseInt(data.replace('agent_cancel:', ''), 10);
        if (!isNaN(auditId)) {
            const [auditRows] = await pool.query(
                'SELECT company_id, status FROM ai_agent_actions_audit WHERE id = ?',
                [auditId]
            );
            if (auditRows.length > 0 && (binding.company_id === null || auditRows[0].company_id === binding.company_id)) {
                await updateAuditAction(auditId, {
                    status: 'rejected',
                    approvedByUserId: null,
                    approvedVia: 'telegram',
                    executionResult: { reason: `Descartado por ${userDisplayName}` }
                });
            }
        }
        await telegramService.sendMessage(
            chatId,
            `🚫 Operación cancelada por ${userDisplayName}. No se asentó ninguna partida en el sistema.`
        );
        return true;
    }

    return false;
}

module.exports = {
    handleAgentTelegramMessage,
    handleAgentTelegramCallback,
    handleAgentTelegramCommand
};
