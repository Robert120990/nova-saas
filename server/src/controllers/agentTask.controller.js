const pool = require('../config/db');
const agentTaskQueue = require('../services/agents/agentTaskQueue.service');
const ticketAiTaskBridge = require('../services/ticketAiTaskBridge.service');

/**
 * List agent tasks with pagination, filtering and KPI metrics.
 */
exports.getTasks = async (req, res) => {
    try {
        const companyId = req.company_id || req.companyId || 1;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        await ticketAiTaskBridge.syncAllFlaggedTicketsToAiTasks(isSuperAdmin ? null : companyId);
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
        const offset = (page - 1) * limit;
        const { search, status, priority, agent_code } = req.query;
        let whereClause = isSuperAdmin ? "WHERE (t.company_id = ? OR t.assigned_agent_code = 'support')" : 'WHERE t.company_id = ?';
        const params = [companyId];

        if (status && status !== 'todos') { whereClause += ' AND t.status = ?'; params.push(status); }
        if (priority && priority !== 'todas') { whereClause += ' AND t.priority = ?'; params.push(priority); }
        if (agent_code && agent_code !== 'todos') { whereClause += ' AND t.assigned_agent_code = ?'; params.push(agent_code); }
        if (search && search.trim()) {
            whereClause += ' AND (t.title LIKE ? OR t.prompt LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ai_agent_tasks t ${whereClause}`, params);
        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit) || 1;

        const [tasks] = await pool.query(
            `SELECT t.*, u.nombre as user_name, b.nombre as branch_name
             FROM ai_agent_tasks t
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN branches b ON t.branch_id = b.id
             ${whereClause}
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const kpiWhere = isSuperAdmin ? "WHERE (company_id = ? OR assigned_agent_code = 'support')" : 'WHERE company_id = ?';
        const [kpiRows] = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status IN ('analizando', 'en_proceso') THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'pendiente' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'completada' AND DATE(completed_at) = CURDATE() THEN 1 END) as completed_today,
                COUNT(CASE WHEN status = 'fallida' THEN 1 END) as failed
            FROM ai_agent_tasks
            ${kpiWhere}
        `, [companyId]);

        const summary = kpiRows[0] || { in_progress: 0, pending: 0, completed_today: 0, failed: 0 };
        res.json({ data: tasks, pagination: { total, page, limit, totalPages }, summary });
    } catch (error) {
        console.error('[AgentTaskController] Error getTasks:', error);
        res.status(500).json({ message: 'Error al obtener lista de tareas agénticas' });
    }
};

/**
 * Get task detail along with chronological execution logs.
 */
exports.getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId || 1;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const whereSql = isSuperAdmin ? "WHERE t.id = ? AND (t.company_id = ? OR t.assigned_agent_code = 'support')" : 'WHERE t.id = ? AND t.company_id = ?';

        const [tasks] = await pool.query(
            `SELECT t.*, u.nombre as user_name, b.nombre as branch_name
             FROM ai_agent_tasks t
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN branches b ON t.branch_id = b.id
             ${whereSql}`,
            [id, companyId]
        );

        if (tasks.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
        const task = tasks[0];

        const [logs] = await pool.query(
            `SELECT * FROM ai_agent_task_logs 
             WHERE task_id = ? 
             ORDER BY created_at ASC, id ASC`,
            [id]
        );

        res.json({
            ...task,
            logs
        });
    } catch (error) {
        console.error('[AgentTaskController] Error getTaskById:', error);
        res.status(500).json({ message: 'Error al consultar detalle de la tarea' });
    }
};

/**
 * Create and enqueue a new task (Mode 1: 'api' | Mode 2: 'agent_prompt').
 */
exports.createTask = async (req, res) => {
    try {
        const companyId = req.company_id || req.companyId || 1;
        const userId = req.user.id;
        const {
            title,
            prompt,
            priority,
            output_type,
            branch_id,
            notify_telegram,
            execution_mode,
            agent_platform,
            custom_logs
        } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ message: 'El título de la tarea es requerido' });
        }
        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ message: 'La instrucción o prompt de la tarea es requerida' });
        }

        const branchId = branch_id ? Number(branch_id) : (req.user.branch_id || null);
        const execMode = execution_mode === 'agent_prompt' ? 'agent_prompt' : 'api';

        const taskId = await agentTaskQueue.enqueueTask({
            companyId,
            branchId,
            userId,
            title,
            prompt,
            priority: priority || 'media',
            outputType: output_type || 'texto',
            notifyTelegram: notify_telegram !== false ? 1 : 0,
            executionMode: execMode,
            agentPlatform: agent_platform || 'antigravity',
            customLogs: custom_logs || null
        });

        res.status(201).json({
            message: execMode === 'agent_prompt'
                ? 'Paquete de Prompt + Logs generado y listo para copiar al Agente Externo'
                : 'Tarea registrada y enviada a la cola de API Interna exitosamente',
            taskId
        });
    } catch (error) {
        console.error('[AgentTaskController] Error createTask:', error);
        res.status(500).json({ message: 'Error al registrar tarea agéntica: ' + error.message });
    }
};

/**
 * Cancel a pending or running task.
 */
exports.cancelTask = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId || 1;
        await agentTaskQueue.cancelTask(id, companyId);
        res.json({ message: 'Tarea cancelada exitosamente' });
    } catch (error) {
        console.error('[AgentTaskController] Error cancelTask:', error);
        res.status(400).json({ message: error.message || 'Error al cancelar la tarea' });
    }
};

/**
 * Retry a failed or cancelled task.
 */
exports.retryTask = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId || 1;
        await agentTaskQueue.retryTask(id, companyId, { forceApi: Boolean(req.body?.force_api) });
        res.json({ message: 'Tarea actualizada / procesada exitosamente' });
    } catch (error) {
        console.error('[AgentTaskController] Error retryTask:', error);
        res.status(400).json({ message: error.message || 'Error al reintentar la tarea' });
    }
};

/**
 * Update an existing task (title, prompt, priority, execution_mode, agent_platform, custom_logs) and optionally re-execute.
 */
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId || 1;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const {
            title, prompt, priority, output_type, branch_id,
            execution_mode, agent_platform, custom_logs, mark_completed, re_execute
        } = req.body;

        const whereSql = isSuperAdmin
            ? "SELECT * FROM ai_agent_tasks WHERE id = ? AND (company_id = ? OR assigned_agent_code = 'support')"
            : 'SELECT * FROM ai_agent_tasks WHERE id = ? AND company_id = ?';
        const [tasks] = await pool.query(whereSql, [id, companyId]);
        if (tasks.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });

        const task = tasks[0];
        if (task.status === 'analizando' && task.execution_mode !== 'agent_prompt') {
            return res.status(400).json({ message: 'No se puede editar una tarea mientras está en ejecución activa por API. Cancélela primero.' });
        }

        const updates = [];
        const params = [];
        if (title !== undefined && String(title).trim()) { updates.push('title = ?'); params.push(String(title).trim()); }
        if (prompt !== undefined && String(prompt).trim()) { updates.push('prompt = ?'); params.push(String(prompt).trim()); }
        if (priority !== undefined && ['alta', 'media', 'baja'].includes(priority)) { updates.push('priority = ?'); params.push(priority); }
        if (output_type !== undefined && ['texto', 'pdf', 'excel', 'imagen'].includes(output_type)) { updates.push('output_type = ?'); params.push(output_type); }
        if (branch_id !== undefined) { updates.push('branch_id = ?'); params.push(branch_id ? Number(branch_id) : null); }
        if (execution_mode !== undefined && ['api', 'agent_prompt'].includes(execution_mode)) { updates.push('execution_mode = ?'); params.push(execution_mode); }
        if (agent_platform !== undefined && ['antigravity', 'cursor', 'claude_code', 'universal'].includes(agent_platform)) { updates.push('agent_platform = ?'); params.push(agent_platform); }
        if (custom_logs !== undefined) { updates.push('custom_logs = ?'); params.push(custom_logs && String(custom_logs).trim() ? String(custom_logs).trim() : null); }
        if (mark_completed === true) {
            updates.push("status = 'completada'", 'progress = 100', "current_step = 'Completada y validada en plataforma de Agente.'", 'completed_at = NOW()');
        }

        if (updates.length > 0) {
            params.push(id);
            await pool.query(`UPDATE ai_agent_tasks SET ${updates.join(', ')} WHERE id = ?`, params);
            await agentTaskQueue.logTaskStep(
                id,
                mark_completed ? (task.assigned_agent_code || 'support') : 'supervisor',
                mark_completed ? 'tool_result' : 'info',
                mark_completed
                    ? 'Tarea marcada como completada al 100% y validada.'
                    : 'Configuración de modo IA, logs o parámetros actualizados por el usuario.'
            );
        }

        // Sync back to support_tickets if linked
        let metaObj = null;
        try { metaObj = typeof task.output_metadata === 'string' ? JSON.parse(task.output_metadata) : task.output_metadata; } catch {}
        if (metaObj?.ticket_id) {
            const tUpdates = [];
            const tParams = [];
            if (execution_mode !== undefined) { tUpdates.push('ai_mode = ?'); tParams.push(execution_mode === 'api' ? 'api' : 'agent_prompt'); }
            if (agent_platform !== undefined) { tUpdates.push('agent_platform = ?'); tParams.push(agent_platform); }
            if (custom_logs !== undefined) { tUpdates.push('custom_logs = ?'); tParams.push(custom_logs || null); }
            if (mark_completed === true) {
                tUpdates.push("status = 'resuelto'", 'resolved_at = COALESCE(resolved_at, NOW())', "resolution_notes = COALESCE(resolution_notes, 'Resuelto y validado desde Tareas Agénticas.')");
            }
            if (tUpdates.length > 0) {
                tParams.push(metaObj.ticket_id);
                await pool.query(`UPDATE support_tickets SET ${tUpdates.join(', ')} WHERE id = ?`, tParams);
            }
            if (!re_execute && !mark_completed) {
                await ticketAiTaskBridge.syncTicketToAiTask(metaObj.ticket_id, { forceSync: true });
            }
        }

        if (re_execute) {
            await agentTaskQueue.retryTask(id, task.company_id);
        }

        res.json({
            message: mark_completed
                ? 'Tarea completada al 100% exitosamente'
                : (re_execute ? 'Tarea actualizada y procesada según el modo IA seleccionado' : 'Tarea y logs actualizados exitosamente')
        });
    } catch (error) {
        console.error('[AgentTaskController] Error updateTask:', error);
        res.status(500).json({ message: error.message || 'Error al actualizar la tarea' });
    }
};

/**
 * Server-Sent Events (SSE) stream for real-time progress and logs.
 */
exports.streamTaskProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        const [tasks] = await pool.query(
            'SELECT id, status FROM ai_agent_tasks WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (tasks.length === 0) {
            return res.status(404).json({ message: 'Tarea no encontrada' });
        }

        // Configure SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
        res.flushHeaders?.();

        // Initial connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ taskId: id, status: tasks[0].status })}\n\n`);

        // Subscribe to live broadcasts
        const unsubscribe = agentTaskQueue.subscribeToTask(id, res);

        // Keep-alive heartbeat every 20 seconds
        const heartbeat = setInterval(() => {
            try {
                res.write(': heartbeat\n\n');
            } catch {
                clearInterval(heartbeat);
            }
        }, 20000);

        req.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
            res.end();
        });
    } catch (error) {
        console.error('[AgentTaskController] Error streamTaskProgress:', error);
        res.status(500).end();
    }
};
