const pool = require('../config/db');
const ticketService = require('../services/ticket.service');
const {
    AVAILABLE_AGY_MODELS,
    getAgyServerSettings,
    saveAgyServerSettings,
    isRunningOnTargetServer
} = require('../services/ticketAgyConsole.service');
const {
    ensureAgyFlowSchema,
    startTicketAgyPlanning,
    executeApprovedTicketAgyPlan,
    rejectTicketAgyPlan
} = require('../services/ticketAgyWorkflow.service');
const { sendAgyPlanToTelegram } = require('../services/ticketAgyTelegram.service');

async function checkIsTechManager(req) {
    if (req.user?.role === 'SuperAdmin') return true;
    const roleLower = (req.user?.role || '').toLowerCase();
    if (roleLower.includes('admin') || roleLower.includes('soporte') || roleLower.includes('tecnic') || roleLower.includes('técnic') || roleLower.includes('sistemas')) {
        return true;
    }
    try {
        const companyId = req.companyId || req.company_id;
        const [rows] = await pool.query(
            `SELECT r.permissions FROM usuario_empresa ue
             JOIN roles r ON r.id = ue.role_id
             WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND ue.has_access = 1 LIMIT 1`,
            [req.user.id, companyId]
        );
        if (rows.length > 0 && rows[0].permissions) {
            const perms = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions) : rows[0].permissions;
            if (Array.isArray(perms) && (perms.includes('manage_support_tickets') || perms.includes('manage_system'))) {
                return true;
            }
        }
    } catch { /* Ignore */ }
    return false;
}

async function getActorName(userId, fallback = 'SuperAdmin') {
    try {
        const [rows] = await pool.query('SELECT nombre, username FROM users WHERE id = ? LIMIT 1', [userId]);
        return rows[0]?.nombre || rows[0]?.username || fallback;
    } catch {
        return fallback;
    }
}

const getAgyConfig = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'No tienes permisos para consultar la configuración AGY' });
        }
        await ensureAgyFlowSchema();
        const settings = await getAgyServerSettings();
        const isLocalHostMatch = isRunningOnTargetServer(settings.ssh_host);
        res.json({
            data: {
                ...settings,
                ssh_password: settings.ssh_password ? '********' : '',
                has_password: Boolean(settings.ssh_password),
                is_running_on_target_server: isLocalHostMatch,
                available_models: AVAILABLE_AGY_MODELS
            }
        });
    } catch (error) {
        console.error('Error getAgyConfig:', error);
        res.status(500).json({ message: 'Error al obtener configuración de consola AGY' });
    }
};

const updateAgyConfig = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'Solo SuperAdmin o usuarios con permiso técnico pueden modificar la consola AGY' });
        }
        await ensureAgyFlowSchema();
        const saved = await saveAgyServerSettings(req.body || {});
        res.json({
            success: true,
            message: 'Configuración de Consola AGY actualizada correctamente',
            data: {
                ...saved,
                ssh_password: saved.ssh_password ? '********' : '',
                has_password: Boolean(saved.ssh_password),
                available_models: AVAILABLE_AGY_MODELS
            }
        });
    } catch (error) {
        console.error('Error updateAgyConfig:', error);
        res.status(500).json({ message: error.message || 'Error al guardar configuración AGY' });
    }
};

const approveTicketAndStartAgyPlan = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'No tienes permisos para aprobar y enviar tickets a la consola AGY' });
        }
        const { id } = req.params;
        const { model, ai_notes, feedback_comment } = req.body || {};
        const actorName = await getActorName(req.user?.id, req.user?.nombre || 'SuperAdmin');

        const updated = await startTicketAgyPlanning(id, {
            model: model || 'gemini-4-argon-high',
            aiNotes: ai_notes,
            approvedBy: actorName,
            additionalFeedback: feedback_comment || null
        });

        res.json({
            success: true,
            message: `Ticket #${updated.ticket_code} aprobado. Ejecutando comando agy (${updated.agy_model}) en Consola AGY; el plan se enviará a Telegram al finalizar.`,
            data: updated,
            ticket: updated
        });
    } catch (error) {
        console.error('Error approveTicketAndStartAgyPlan:', error);
        res.status(400).json({ message: error.message || 'Error al iniciar planificación en Consola AGY' });
    }
};

const approveAndExecuteAgyPlan = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'No tienes permisos para ejecutar planes AGY' });
        }
        const { id } = req.params;
        const actorName = await getActorName(req.user?.id, req.user?.nombre || 'SuperAdmin');
        const updated = await executeApprovedTicketAgyPlan(id, { approvedBy: actorName });

        res.json({
            success: true,
            message: `Plan aprobado. AGY (${updated.agy_model}) está ejecutando los cambios en Consola AGY.`,
            data: updated,
            ticket: updated
        });
    } catch (error) {
        console.error('Error approveAndExecuteAgyPlan:', error);
        res.status(400).json({ message: error.message || 'Error al ejecutar el plan AGY' });
    }
};

const denyAgyPlan = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'No tienes permisos para denegar planes AGY' });
        }
        const { id } = req.params;
        const { reason = '' } = req.body || {};
        const actorName = await getActorName(req.user?.id, req.user?.nombre || 'SuperAdmin');
        const updated = await rejectTicketAgyPlan(id, { rejectedBy: actorName, reason });

        res.json({
            success: true,
            message: `Plan AGY del ticket #${updated.ticket_code} marcado como denegado.`,
            data: updated,
            ticket: updated
        });
    } catch (error) {
        console.error('Error denyAgyPlan:', error);
        res.status(400).json({ message: error.message || 'Error al denegar el plan AGY' });
    }
};

const resendAgyPlanToTelegram = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const ticket = await ticketService.getTicketById(req.params.id);
        if (!ticket || !ticket.agy_plan_markdown) {
            return res.status(400).json({ message: 'Este ticket aún no cuenta con un plan generado para enviar a Telegram' });
        }
        await pool.query(`UPDATE support_tickets SET agy_status = 'esperando_aprobacion', agy_updated_at = NOW() WHERE id = ?`, [req.params.id]);
        const updatedTicket = await ticketService.getTicketById(req.params.id);
        const sent = await sendAgyPlanToTelegram(updatedTicket);
        res.json({
            success: sent,
            message: sent
                ? `Plan v${ticket.agy_plan_version || 1} reenviado a Telegram con botones de aprobación`
                : 'No se encontraron chats técnicos activos en Telegram para enviar el plan'
        });
    } catch (error) {
        console.error('Error resendAgyPlanToTelegram:', error);
        res.status(500).json({ message: error.message || 'Error al reenviar plan a Telegram' });
    }
};

module.exports = {
    getAgyConfig,
    updateAgyConfig,
    approveTicketAndStartAgyPlan,
    approveAndExecuteAgyPlan,
    denyAgyPlan,
    resendAgyPlanToTelegram
};
