const pool = require('../../config/db');

/**
 * Service to manage conversational multi-agent sessions,
 * message history persistence, and agent state.
 */

async function getOrCreateSession({ channel, externalChatId, companyId, branchId = null, userId = null }) {
    if (!channel || !externalChatId || !companyId) {
        throw new Error('[AgentSession] channel, externalChatId and companyId are required.');
    }

    const [existing] = await pool.query(
        'SELECT * FROM ai_agent_sessions WHERE channel = ? AND external_chat_id = ?',
        [channel, String(externalChatId)]
    );

    if (existing.length > 0) {
        const session = existing[0];
        // Update context if changed
        if (session.company_id !== companyId || session.branch_id !== branchId || (userId && session.user_id !== userId)) {
            await pool.query(
                `UPDATE ai_agent_sessions 
                 SET company_id = ?, branch_id = ?, user_id = COALESCE(?, user_id), last_activity = NOW()
                 WHERE id = ?`,
                [companyId, branchId, userId, session.id]
            );
            session.company_id = companyId;
            session.branch_id = branchId;
            if (userId) session.user_id = userId;
        }
        return session;
    }

    const [insertResult] = await pool.query(
        `INSERT INTO ai_agent_sessions (channel, external_chat_id, company_id, branch_id, user_id, active_agent_code)
         VALUES (?, ?, ?, ?, ?, 'supervisor')`,
        [channel, String(externalChatId), companyId, branchId, userId]
    );

    return {
        id: insertResult.insertId,
        channel,
        external_chat_id: String(externalChatId),
        company_id: companyId,
        branch_id: branchId,
        user_id: userId,
        active_agent_code: 'supervisor'
    };
}

async function getSessionHistory(sessionId, limit = 8) {
    const [rows] = await pool.query(
        `SELECT role, agent_code, content, tool_calls, created_at
         FROM ai_agent_messages
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [sessionId, limit]
    );

    // Return in chronological order
    return rows.reverse().map(r => ({
        role: r.role,
        agent_code: r.agent_code,
        content: r.content || '',
        tool_calls: typeof r.tool_calls === 'string' ? JSON.parse(r.tool_calls) : r.tool_calls
    }));
}

async function saveMessage(sessionId, { role, agentCode = 'supervisor', content = '', toolCalls = null }) {
    await pool.query(
        `INSERT INTO ai_agent_messages (session_id, role, agent_code, content, tool_calls)
         VALUES (?, ?, ?, ?, ?)`,
        [
            sessionId,
            role,
            agentCode,
            content || '',
            toolCalls ? JSON.stringify(toolCalls) : null
        ]
    );

    await pool.query(
        'UPDATE ai_agent_sessions SET last_activity = NOW() WHERE id = ?',
        [sessionId]
    );
}

async function setActiveAgent(sessionId, agentCode) {
    await pool.query(
        'UPDATE ai_agent_sessions SET active_agent_code = ?, last_activity = NOW() WHERE id = ?',
        [agentCode, sessionId]
    );
}

async function logAuditAction({
    sessionId = null,
    companyId,
    branchId = null,
    agentCode,
    actionType,
    description = '',
    payload = {},
    status = 'pending_approval'
}) {
    const [res] = await pool.query(
        `INSERT INTO ai_agent_actions_audit 
         (session_id, company_id, branch_id, agent_code, action_type, description, payload, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            sessionId,
            companyId,
            branchId,
            agentCode,
            actionType,
            description,
            JSON.stringify(payload),
            status
        ]
    );

    return res.insertId;
}

async function updateAuditAction(auditId, { status, approvedByUserId = null, approvedVia = null, executionResult = null }) {
    const fields = ['status = ?'];
    const params = [status];

    if (approvedByUserId) {
        fields.push('approved_by_user_id = ?');
        params.push(approvedByUserId);
    }
    if (approvedVia) {
        fields.push('approved_via = ?');
        params.push(approvedVia);
    }
    if (executionResult) {
        fields.push('execution_result = ?');
        params.push(JSON.stringify(executionResult));
    }
    if (status === 'executed' || status === 'approved') {
        fields.push('executed_at = NOW()');
    }

    params.push(auditId);

    await pool.query(
        `UPDATE ai_agent_actions_audit SET ${fields.join(', ')} WHERE id = ?`,
        params
    );
}

async function getAuditAction(auditId) {
    const [rows] = await pool.query('SELECT * FROM ai_agent_actions_audit WHERE id = ?', [auditId]);
    if (rows.length === 0) return null;
    const item = rows[0];
    if (typeof item.payload === 'string') {
        try { item.payload = JSON.parse(item.payload); } catch { item.payload = {}; }
    }
    if (typeof item.execution_result === 'string') {
        try { item.execution_result = JSON.parse(item.execution_result); } catch { item.execution_result = null; }
    }
    return item;
}

module.exports = {
    getOrCreateSession,
    getSessionHistory,
    saveMessage,
    setActiveAgent,
    logAuditAction,
    updateAuditAction,
    getAuditAction
};
