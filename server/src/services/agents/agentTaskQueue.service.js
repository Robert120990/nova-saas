const pool = require('../../config/db');
const supervisorAgent = require('./SupervisorAgent');
const agentRegistry = require('./agentRegistry');
const agentReportGenerator = require('./agentReportGenerator.service');
const telegramService = require('../telegram.service');
const { notify } = require('../notification.service');

// Event emitter / subscriber map for real-time SSE updates
const subscribers = new Map(); // taskId -> Set of res objects

function subscribeToTask(taskId, res) {
    const id = Number(taskId);
    if (!subscribers.has(id)) {
        subscribers.set(id, new Set());
    }
    subscribers.get(id).add(res);

    return () => {
        const clientSet = subscribers.get(id);
        if (clientSet) {
            clientSet.delete(res);
            if (clientSet.size === 0) {
                subscribers.delete(id);
            }
        }
    };
}

function broadcastTaskEvent(taskId, eventType, data) {
    const id = Number(taskId);
    const clientSet = subscribers.get(id);
    if (!clientSet || clientSet.size === 0) return;

    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clientSet) {
        try {
            res.write(payload);
        } catch {
            // Socket might be closed
        }
    }
}

// Concurrency control: track running task IDs
const runningTasks = new Set();
const MAX_CONCURRENT_TASKS = 2;

/**
 * Log a step in the task log history and stream to real-time clients.
 */
async function logTaskStep(taskId, agentCode, logType, message, metadata = null) {
    try {
        const metaStr = metadata ? JSON.stringify(metadata) : null;
        const [result] = await pool.query(
            `INSERT INTO ai_agent_task_logs (task_id, agent_code, log_type, message, metadata)
             VALUES (?, ?, ?, ?, ?)`,
            [taskId, agentCode, logType, message, metaStr]
        );

        const logEntry = {
            id: result.insertId,
            task_id: taskId,
            agent_code: agentCode,
            log_type: logType,
            message,
            metadata,
            created_at: new Date().toISOString()
        };

        broadcastTaskEvent(taskId, 'task_log', logEntry);
        return logEntry;
    } catch (err) {
        console.error(`[AgentTaskQueue] Error logging task step for #${taskId}:`, err.message);
    }
}

/**
 * Update task progress and broadcast status change.
 */
async function updateTaskStatus(taskId, updates) {
    try {
        const fields = [];
        const values = [];

        for (const [key, val] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
        values.push(taskId);

        await pool.query(
            `UPDATE ai_agent_tasks SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        broadcastTaskEvent(taskId, 'task_progress', { taskId, ...updates });
    } catch (err) {
        console.error(`[AgentTaskQueue] Error updating task #${taskId}:`, err.message);
    }
}

/**
 * Process the next pending task from the priority queue.
 */
async function processQueue() {
    if (runningTasks.size >= MAX_CONCURRENT_TASKS) {
        return; // Capacity reached
    }

    let task = null;
    try {
        // Pick highest priority task (alta = 1, media = 2, baja = 3)
        const [rows] = await pool.query(`
            SELECT t.*, u.nombre as user_name, u.email as user_email
            FROM ai_agent_tasks t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.status = 'pendiente'
            ORDER BY 
                CASE t.priority 
                    WHEN 'alta' THEN 1 
                    WHEN 'media' THEN 2 
                    WHEN 'baja' THEN 3 
                    ELSE 4 
                END ASC,
                t.created_at ASC
            LIMIT 1
        `);

        if (rows.length === 0) {
            return; // No tasks pending
        }

        task = rows[0];
        if (runningTasks.has(task.id)) {
            return;
        }

        runningTasks.add(task.id);

        // Mark as analyzing by Supervisor
        await updateTaskStatus(task.id, {
            status: 'analizando',
            assigned_agent_code: 'supervisor',
            progress: 15,
            current_step: 'Supervisor analizando objetivo y requerimientos...',
            started_at: new Date()
        });

        await logTaskStep(
            task.id,
            'supervisor',
            'thinking',
            `Inicio de tarea #${task.id}: "${task.title}". Evaluando dependencias y asignación de especialista.`
        );

        // Fetch creator user's actual role and permissions in the task company
        const [ueRows] = await pool.query(
            `SELECT ue.role_id, r.name as role_name, r.permissions
             FROM usuario_empresa ue
             LEFT JOIN roles r ON ue.role_id = r.id
             WHERE ue.usuario_id = ? AND ue.empresa_id = ?`,
            [task.user_id, task.company_id]
        );

        let userRole = ueRows[0]?.role_name || null;
        if (!userRole && task.user_id) {
            const [saRows] = await pool.query(
                `SELECT 1 FROM usuario_empresa ue
                 JOIN roles r ON ue.role_id = r.id
                 WHERE ue.usuario_id = ? AND r.name = 'SuperAdmin'
                 LIMIT 1`,
                [task.user_id]
            );
            userRole = saRows.length > 0 ? 'SuperAdmin' : (ueRows[0]?.role_name || 'Operador');
        } else if (!userRole) {
            userRole = 'Operador';
        }

        let userPermissions = ueRows[0]?.permissions || [];
        if (typeof userPermissions === 'string') {
            try { userPermissions = JSON.parse(userPermissions); } catch { userPermissions = []; }
        }

        // Prepare context for execution
        const taskContext = {
            companyId: task.company_id,
            branchId: task.branch_id || null,
            user: {
                id: task.user_id,
                nombre: task.user_name || 'Usuario',
                email: task.user_email || '',
                role: userRole,
                permissions: userPermissions,
                is_system_task: false
            },
            taskId: task.id,
            onStepLog: async (agentCode, type, msg, meta) => {
                await logTaskStep(task.id, agentCode, type, msg, meta);
            }
        };

        await logTaskStep(
            task.id,
            'supervisor',
            'info',
            `Supervisor evaluando prompt: "${task.prompt.slice(0, 140)}${task.prompt.length > 140 ? '...' : ''}"`
        );

        // Prepare autonomous execution prompt
        const autonomousPrompt = `[TAREA AGÉNTICA AUTÓNOMA #${task.id} - EJECUCIÓN DIRECTA]:
OBJETIVO: ${task.prompt}

INSTRUCCIONES CLAVE DE EJECUCIÓN AUTÓNOMA:
1. Esta es una tarea en segundo plano. NO es un chat interactivo. El usuario NO puede responder preguntas intermedias ni dar confirmaciones.
2. EJECUTA TÚ MISMO de inmediato todas las consultas SQL y herramientas requeridas para obtener las cifras reales del período y la sucursal.
3. Si necesitas conocer la estructura de tablas o puntos de venta, consúltalas y DE INMEDIATO ejecuta las consultas de agregación de datos con las fechas solicitadas.
4. Genera el resultado final exhaustivo con tablas Markdown de datos reales, comparativos numéricos, diferencias y conclusiones de auditoría.
5. Queda estrictamente prohibido devolver respuestas a medias, pedir confirmación al usuario o devolver tablas con plantillas vacías o guiones ($—).`;

        // Execute Supervisor Agent
        const executionResult = await supervisorAgent.execute({
            messages: [{ role: 'user', content: autonomousPrompt }],
            context: taskContext
        });

        let targetAgentCode = taskContext._delegatedAgent ? taskContext._delegatedAgent.code : 'supervisor';
        let targetAgentName = taskContext._delegatedAgent ? taskContext._delegatedAgent.name : supervisorAgent.name;

        await updateTaskStatus(task.id, {
            status: 'en_proceso',
            assigned_agent_code: targetAgentCode,
            progress: 65,
            current_step: `Especialista [${targetAgentName}] procesando informe final...`
        });

        await logTaskStep(
            task.id,
            targetAgentCode,
            'delegation',
            `Objetivo delegado exitosamente a [${targetAgentName}]. Consolidando respuesta...`
        );

        const finalContent = executionResult.content || 'Tarea procesada sin salida adicional.';

        // Generate official output document if requested (pdf, excel, imagen)
        let outputUrl = null;
        let outputMeta = null;
        if (task.output_type && task.output_type !== 'texto') {
            await logTaskStep(
                task.id,
                targetAgentCode,
                'info',
                `Generando archivo de salida en formato [${task.output_type.toUpperCase()}]...`
            );
            try {
                const rep = await agentReportGenerator.generateReportForTask({
                    task,
                    companyId: task.company_id,
                    findings: finalContent,
                    toolResults: executionResult.toolResults || []
                });
                outputUrl = rep.fileUrl;
                outputMeta = rep.metadata;
                await logTaskStep(
                    task.id,
                    targetAgentCode,
                    'info',
                    `Documento oficial [${task.output_type.toUpperCase()}] generado con éxito.`
                );
            } catch (repErr) {
                console.error(`[AgentTaskQueue] Error generating ${task.output_type} for #${task.id}:`, repErr.message);
                await logTaskStep(
                    task.id,
                    targetAgentCode,
                    'warning',
                    `No se pudo compilar el archivo ${task.output_type}: ${repErr.message}. La salida en texto se conserva intacta.`
                );
            }
        }

        // Complete the task
        await updateTaskStatus(task.id, {
            status: 'completada',
            assigned_agent_code: targetAgentCode,
            progress: 100,
            current_step: 'Tarea completada exitosamente.',
            result: finalContent,
            output_file_url: outputUrl,
            output_metadata: outputMeta ? JSON.stringify(outputMeta) : null,
            completed_at: new Date()
        });

        await logTaskStep(
            task.id,
            targetAgentCode,
            'info',
            outputUrl
                ? `Resolución final y archivo [${task.output_type.toUpperCase()}] listos para consulta o descarga.`
                : 'Resolución final generada y guardada en el sistema.'
        );

        // Internal Bell Notification
        await notify('ai_task_completed', task.company_id, task.branch_id, {
            task_id: task.id,
            title: task.title,
            agent_code: targetAgentCode,
            priority: task.priority
        }).catch(() => {});

        // Optional Telegram Notification
        if (task.notify_telegram) {
            sendTelegramCompletionNotification(task, targetAgentName, finalContent).catch(() => {});
        }

    } catch (taskError) {
        console.error(`[AgentTaskQueue] Error executing task #${task?.id}:`, taskError);
        if (task && task.id) {
            await updateTaskStatus(task.id, {
                status: 'fallida',
                error_message: taskError.message || 'Error desconocido durante la ejecución del agente.',
                current_step: 'Ejecución interrumpida por error.'
            });

            await logTaskStep(
                task.id,
                'supervisor',
                'error',
                `Fallo en la ejecución: ${taskError.message}`
            );
        }
    } finally {
        if (task && task.id) {
            runningTasks.delete(task.id);
            // Check next pending task in queue only when a task was just finished
            setImmediate(() => processQueue());
        }
    }
}

/**
 * Send summary notification to Telegram bound chats
 */
async function sendTelegramCompletionNotification(task, agentName, resultContent) {
    try {
        const [chats] = await pool.query(
            `SELECT chat_id FROM telegram_chat_bindings 
             WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL) AND receive_alerts = 1`,
            [task.company_id, task.branch_id || null]
        );

        if (!chats || chats.length === 0) return;

        // Truncate content for clean Telegram presentation
        const cleanSummary = resultContent
            .replace(/[#*`_]/g, '')
            .split('\n')
            .filter(line => line.trim().length > 0)
            .slice(0, 5)
            .join('\n');

        const message = `🤖 *TAREA AGÉNTICA COMPLETADA*\n\n` +
            `📌 *Título:* ${task.title}\n` +
            `⚡ *Prioridad:* ${task.priority.toUpperCase()}\n` +
            `👤 *Agente Especialista:* ${agentName}\n\n` +
            `📝 *Resumen del informe:*\n${cleanSummary.slice(0, 400)}...\n\n` +
            `_Ingresa al módulo web de Tareas Agénticas para ver el informe detallado._`;

        for (const chat of chats) {
            try {
                await telegramService.sendMessage(chat.chat_id, message, { parse_mode: 'Markdown' });
            } catch (tgErr) {
                console.error(`[AgentTaskQueue] Telegram error sending to ${chat.chat_id}:`, tgErr.message);
            }
        }
    } catch (err) {
        console.error('[AgentTaskQueue] Error in Telegram completion notification:', err.message);
    }
}

/**
 * Enqueue a new agent task.
 */
async function enqueueTask({ companyId, branchId, userId, title, prompt, priority = 'media', outputType = 'texto', notifyTelegram = 1 }) {
    const cleanPriority = ['alta', 'media', 'baja'].includes(priority) ? priority : 'media';
    const cleanOutput = ['texto', 'pdf', 'excel', 'imagen'].includes(outputType) ? outputType : 'texto';

    const [result] = await pool.query(
        `INSERT INTO ai_agent_tasks 
         (company_id, branch_id, user_id, title, prompt, priority, output_type, status, notify_telegram, current_step)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, 'En cola de espera...')`,
        [companyId, branchId || null, userId, String(title).trim(), String(prompt).trim(), cleanPriority, cleanOutput, notifyTelegram ? 1 : 0]
    );

    const taskId = result.insertId;

    await logTaskStep(
        taskId,
        'supervisor',
        'info',
        `Tarea #${taskId} registrada en cola de procesamiento con prioridad ${cleanPriority.toUpperCase()}.`
    );

    // Trigger queue processing asynchronously
    setImmediate(() => processQueue());

    return taskId;
}

/**
 * Cancel a pending or running task.
 */
async function cancelTask(taskId, companyId) {
    const [tasks] = await pool.query(
        'SELECT id, status FROM ai_agent_tasks WHERE id = ? AND company_id = ?',
        [taskId, companyId]
    );

    if (tasks.length === 0) {
        throw new Error('Tarea no encontrada.');
    }

    const task = tasks[0];
    if (['completada', 'cancelada'].includes(task.status)) {
        throw new Error(`La tarea ya se encuentra en estado '${task.status}'.`);
    }

    await updateTaskStatus(taskId, {
        status: 'cancelada',
        current_step: 'Cancelada por el usuario.',
        error_message: 'La tarea fue cancelada manualmente.'
    });

    await logTaskStep(taskId, 'supervisor', 'warning', 'Tarea cancelada manualmente por el usuario.');

    runningTasks.delete(Number(taskId));
    setImmediate(() => processQueue());

    return true;
}

/**
 * Retry a failed or cancelled task.
 */
async function retryTask(taskId, companyId) {
    const [tasks] = await pool.query(
        'SELECT id, status FROM ai_agent_tasks WHERE id = ? AND company_id = ?',
        [taskId, companyId]
    );

    if (tasks.length === 0) {
        throw new Error('Tarea no encontrada.');
    }

    await updateTaskStatus(taskId, {
        status: 'pendiente',
        progress: 0,
        current_step: 'Reencolada para nuevo intento...',
        error_message: null,
        result: null,
        started_at: null,
        completed_at: null
    });

    await logTaskStep(taskId, 'supervisor', 'info', 'Tarea reencolada para nuevo intento.');

    setImmediate(() => processQueue());

    return true;
}

// Auto-start queue listener in case pending tasks were left on server reload
setTimeout(() => {
    processQueue().catch(e => console.error('[AgentTaskQueue] Startup queue error:', e));
}, 5000);

// Gentle periodic check every 30s to catch any unhandled pending tasks safely
setInterval(() => {
    processQueue().catch(e => console.error('[AgentTaskQueue] Periodic check error:', e));
}, 30000);

module.exports = {
    enqueueTask,
    cancelTask,
    retryTask,
    subscribeToTask,
    logTaskStep,
    updateTaskStatus,
    processQueue
};
