const pool = require('../config/db');
const agentTaskQueue = require('../services/agents/agentTaskQueue.service');

/**
 * List agent tasks with pagination, filtering and KPI metrics.
 */
exports.getTasks = async (req, res) => {
    try {
        const companyId = req.company_id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
        const offset = (page - 1) * limit;

        const { search, status, priority, agent_code } = req.query;

        let whereClause = 'WHERE t.company_id = ?';
        const params = [companyId];

        if (status && status !== 'todos') {
            whereClause += ' AND t.status = ?';
            params.push(status);
        }

        if (priority && priority !== 'todas') {
            whereClause += ' AND t.priority = ?';
            params.push(priority);
        }

        if (agent_code && agent_code !== 'todos') {
            whereClause += ' AND t.assigned_agent_code = ?';
            params.push(agent_code);
        }

        if (search && search.trim()) {
            whereClause += ' AND (t.title LIKE ? OR t.prompt LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }

        // Count total matching tasks
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM ai_agent_tasks t ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit) || 1;

        // Fetch paginated tasks
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

        // Calculate KPI summary for this company
        const [kpiRows] = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status IN ('analizando', 'en_proceso') THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'pendiente' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'completada' AND DATE(completed_at) = CURDATE() THEN 1 END) as completed_today,
                COUNT(CASE WHEN status = 'fallida' THEN 1 END) as failed
            FROM ai_agent_tasks
            WHERE company_id = ?
        `, [companyId]);

        const summary = kpiRows[0] || {
            in_progress: 0,
            pending: 0,
            completed_today: 0,
            failed: 0
        };

        res.json({
            data: tasks,
            pagination: {
                total,
                page,
                limit,
                totalPages
            },
            summary
        });
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
        const companyId = req.company_id;

        const [tasks] = await pool.query(
            `SELECT t.*, u.nombre as user_name, b.nombre as branch_name
             FROM ai_agent_tasks t
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN branches b ON t.branch_id = b.id
             WHERE t.id = ? AND t.company_id = ?`,
            [id, companyId]
        );

        if (tasks.length === 0) {
            return res.status(404).json({ message: 'Tarea no encontrada' });
        }

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
 * Create and enqueue a new task.
 */
exports.createTask = async (req, res) => {
    try {
        const companyId = req.company_id;
        const userId = req.user.id;
        const { title, prompt, priority, output_type, branch_id, notify_telegram } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ message: 'El título de la tarea es requerido' });
        }

        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ message: 'La instrucción o prompt de la tarea es requerida' });
        }

        const branchId = branch_id ? Number(branch_id) : (req.user.branch_id || null);

        const taskId = await agentTaskQueue.enqueueTask({
            companyId,
            branchId,
            userId,
            title,
            prompt,
            priority: priority || 'media',
            outputType: output_type || 'texto',
            notifyTelegram: notify_telegram !== false ? 1 : 0
        });

        res.status(201).json({
            message: 'Tarea registrada y agregada a la cola exitosamente',
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
        const companyId = req.company_id;

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
        const companyId = req.company_id;

        await agentTaskQueue.retryTask(id, companyId);

        res.json({ message: 'Tarea reencolada exitosamente para un nuevo intento' });
    } catch (error) {
        console.error('[AgentTaskController] Error retryTask:', error);
        res.status(400).json({ message: error.message || 'Error al reintentar la tarea' });
    }
};

/**
 * Update an existing task (title, prompt, priority, branch_id) and optionally re-execute.
 */
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;
        const { title, prompt, priority, output_type, branch_id, re_execute } = req.body;

        const [tasks] = await pool.query(
            'SELECT id, status FROM ai_agent_tasks WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (tasks.length === 0) {
            return res.status(404).json({ message: 'Tarea no encontrada' });
        }

        const task = tasks[0];
        if (['analizando', 'en_proceso'].includes(task.status)) {
            return res.status(400).json({ message: 'No se puede editar una tarea mientras está en ejecución activa. Cancélela primero.' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined && String(title).trim()) {
            updates.push('title = ?');
            params.push(String(title).trim());
        }

        if (prompt !== undefined && String(prompt).trim()) {
            updates.push('prompt = ?');
            params.push(String(prompt).trim());
        }

        if (priority !== undefined && ['alta', 'media', 'baja'].includes(priority)) {
            updates.push('priority = ?');
            params.push(priority);
        }

        if (output_type !== undefined && ['texto', 'pdf', 'excel', 'imagen'].includes(output_type)) {
            updates.push('output_type = ?');
            params.push(output_type);
        }

        if (branch_id !== undefined) {
            updates.push('branch_id = ?');
            params.push(branch_id ? Number(branch_id) : null);
        }

        if (updates.length > 0) {
            params.push(id, companyId);
            await pool.query(
                `UPDATE ai_agent_tasks SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
                params
            );

            await agentTaskQueue.logTaskStep(
                id,
                'supervisor',
                'info',
                'Parámetros o prompt de la tarea actualizados por el usuario.'
            );
        }

        if (re_execute) {
            await agentTaskQueue.retryTask(id, companyId);
        }

        res.json({
            message: re_execute
                ? 'Tarea actualizada y reencolada exitosamente para ejecución'
                : 'Tarea actualizada exitosamente'
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
