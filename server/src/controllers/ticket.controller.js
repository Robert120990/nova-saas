const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const ticketService = require('../services/ticket.service');

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB decoded limit

function isValidImageMagicBytes(buf) {
    if (!buf || buf.length < 12) return false;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    return isPng || isJpeg || isGif || isWebp;
}

function saveBase64Screenshot(base64Data) {
    if (!base64Data || typeof base64Data !== 'string') return null;
    if (base64Data.length > Math.ceil(MAX_IMAGE_BYTES * 1.38) + 256) {
        throw new Error('La captura de pantalla supera el límite permitido de 6 MB');
    }
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;

    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error('La captura de pantalla supera el límite permitido de 6 MB');
    }
    if (!isValidImageMagicBytes(buffer)) {
        throw new Error('Formato binario de imagen inválido o no permitido');
    }

    const uploadsDir = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = path.basename(`ticket-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`);
    const targetPath = path.resolve(uploadsDir, filename);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
        throw new Error('Ruta de archivo inválida');
    }
    fs.writeFileSync(targetPath, buffer);
    return `/uploads/${filename}`;
}

async function getUserFullName(userId, fallback = 'Usuario') {
    const [rows] = await pool.query('SELECT nombre, username FROM users WHERE id = ? LIMIT 1', [userId]);
    return rows[0]?.nombre || rows[0]?.username || fallback;
}

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

const getTickets = async (req, res) => {
    try {
        const { search = '', status = '', priority = '', type = '', scope = 'auto', mine = 'false', page = 1, limit = 15 } = req.query;
        const isTech = await checkIsTechManager(req);
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const activeCompanyId = req.companyId || req.company_id;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
        const offset = (pageNum - 1) * limitNum;

        const where = [];
        const params = [];

        if (scope === 'mine' || mine === 'true' || !isTech) {
            where.push('t.user_id = ?');
            params.push(req.user.id);
        } else if (!isSuperAdmin) {
            where.push('t.company_id = ?');
            params.push(activeCompanyId || 0);
        }

        if (status && status !== 'all') { where.push('t.status = ?'); params.push(status); }
        if (priority && priority !== 'all') { where.push('t.priority = ?'); params.push(priority); }
        if (type && type !== 'all') { where.push('t.type = ?'); params.push(type); }
        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            where.push('(t.ticket_code LIKE ? OR t.subject LIKE ? OR t.description LIKE ? OR t.user_name LIKE ? OR t.module_name LIKE ? OR t.page_url LIKE ?)');
            params.push(q, q, q, q, q, q);
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM support_tickets t ${whereSql}`, params);
        const total = countRows[0]?.total || 0;

        const [rows] = await pool.query(
            `SELECT t.*, t.ticket_code AS code, t.user_name AS creator_name,
                    c.razon_social AS company_name, b.nombre AS branch_name,
                    (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id) AS message_count
             FROM support_tickets t
             LEFT JOIN companies c ON c.id = t.company_id
             LEFT JOIN branches b ON b.id = t.branch_id
             ${whereSql}
             ORDER BY
                FIELD(t.status, 'abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado'),
                FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'),
                t.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limitNum, offset]
        );

        const totalPages = Math.ceil(total / limitNum) || 1;
        res.json({ data: rows, total, page: pageNum, totalPages, pagination: { total, page: pageNum, limit: limitNum, totalPages }, isTechManager: isTech });
    } catch (error) {
        console.error('Error getTickets:', error);
        res.status(500).json({ message: 'Error al obtener listado de tickets' });
    }
};

const getTicketStats = async (req, res) => {
    try {
        const isTech = await checkIsTechManager(req);
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const activeCompanyId = req.companyId || req.company_id;
        const { scope = 'auto', mine = 'false' } = req.query;

        let whereSql = '';
        const params = [];

        if (scope === 'mine' || mine === 'true' || !isTech) {
            whereSql = 'WHERE user_id = ?';
            params.push(req.user.id);
        } else if (!isSuperAdmin) {
            whereSql = 'WHERE company_id = ?';
            params.push(activeCompanyId || 0);
        }

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'abierto' THEN 1 ELSE 0 END) AS abiertos,
                SUM(CASE WHEN status = 'en_proceso' THEN 1 ELSE 0 END) AS en_proceso,
                SUM(CASE WHEN status = 'resuelto' THEN 1 ELSE 0 END) AS resueltos,
                SUM(CASE WHEN status = 'cerrado' THEN 1 ELSE 0 END) AS cerrados,
                SUM(CASE WHEN priority IN ('urgente', 'alta') AND status IN ('abierto', 'en_proceso') THEN 1 ELSE 0 END) AS criticos_pendientes,
                SUM(CASE WHEN include_in_ai_prompt = 1 AND status NOT IN ('cerrado', 'rechazado') THEN 1 ELSE 0 END) AS seleccionados_ia
             FROM support_tickets ${whereSql}`,
            params
        );

        const stats = {
            total: Number(rows[0]?.total || 0), abiertos: Number(rows[0]?.abiertos || 0),
            en_proceso: Number(rows[0]?.en_proceso || 0), resueltos: Number(rows[0]?.resueltos || 0),
            cerrados: Number(rows[0]?.cerrados || 0), criticos_pendientes: Number(rows[0]?.criticos_pendientes || 0),
            urgentes_pendientes: Number(rows[0]?.criticos_pendientes || 0), seleccionados_ia: Number(rows[0]?.seleccionados_ia || 0),
            isTechManager: isTech
        };
        res.json({ ...stats, data: stats });
    } catch (error) {
        console.error('Error getTicketStats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de tickets' });
    }
};

const getPendingResolvedForCreator = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, user_id, ticket_code, ticket_code AS code, subject, type, priority, page_url, module_name,
                    resolution_notes, resolved_by_name, resolved_version, resolved_at
             FROM support_tickets
             WHERE user_id = ? AND status = 'resuelto' AND creator_notified_at IS NULL
             ORDER BY resolved_at DESC LIMIT 5`,
            [req.user.id]
        );
        res.json({ data: rows });
    } catch (error) {
        console.error('Error getPendingResolvedForCreator:', error);
        res.status(500).json({ message: 'Error al consultar tickets resueltos pendientes' });
    }
};

const acknowledgeResolvedTicket = async (req, res) => {
    try {
        await pool.query(`UPDATE support_tickets SET creator_notified_at = NOW() WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Notificación de resolución confirmada' });
    } catch (error) {
        console.error('Error acknowledgeResolvedTicket:', error);
        res.status(500).json({ message: 'Error al confirmar lectura de ticket resuelto' });
    }
};

const getTicketDetail = async (req, res) => {
    try {
        const ticket = await ticketService.getTicketById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

        const isCreator = Number(ticket.user_id) === Number(req.user.id);
        const isSameTenant = Number(ticket.company_id) === Number(req.companyId || req.company_id);
        if (req.user?.role !== 'SuperAdmin' && !isCreator && !isSameTenant) {
            return res.status(403).json({ message: 'No tienes autorización para ver tickets de otra empresa' });
        }
        const isTech = await checkIsTechManager(req);
        if (!isTech && !isCreator) return res.status(403).json({ message: 'No tienes autorización para ver este ticket' });

        res.json({ ...ticket, data: ticket });
    } catch (error) {
        console.error('Error getTicketDetail:', error);
        res.status(500).json({ message: 'Error al obtener detalle del ticket' });
    }
};

const createTicket = async (req, res) => {
    try {
        const {
            type = 'problema', priority = 'media', subject, description, page_url, module_name,
            browser_info, branch_id, screenshot_base64, attachments = [],
            diagnostics = null, diagnostic_relevance = 'sin_errores', diagnostic_score = 0
        } = req.body;
        if (!subject || !String(subject).trim()) return res.status(400).json({ message: 'El asunto del ticket es obligatorio' });

        const savedAttachments = [];
        if (Array.isArray(attachments) && attachments.length > 0) {
            attachments.slice(0, 4).forEach((att) => {
                const safeExistingUrl = typeof att?.url === 'string' && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(att.url) ? att.url : null;
                const url = att?.dataUrl ? saveBase64Screenshot(att.dataUrl) : safeExistingUrl;
                if (url) savedAttachments.push({ url, caption: String(att.caption || '').slice(0, 250), annotated: Boolean(att.annotated) });
            });
        }
        const primaryUrl = savedAttachments[0]?.url || (req.file ? `/uploads/${path.basename(req.file.filename)}` : (screenshot_base64 ? saveBase64Screenshot(screenshot_base64) : null));
        if (primaryUrl && savedAttachments.length === 0) savedAttachments.push({ url: primaryUrl, caption: '', annotated: false });

        const userName = await getUserFullName(req.user.id, req.user.nombre || req.user.username || 'Usuario');
        const ticket = await ticketService.createTicket({
            companyId: req.companyId || req.company_id || req.user?.company_id || 1,
            branchId: branch_id || req.branchId || req.branch_id || req.user?.branch_id || null,
            userId: req.user.id, userName, userRole: req.user?.role || null, type, priority,
            subject: String(subject), description: String(description || subject),
            pageUrl: page_url || null, moduleName: module_name || null, screenshotUrl: primaryUrl,
            attachmentsJson: savedAttachments.length > 0 ? savedAttachments : null,
            browserInfo: browser_info || null, diagnosticsJson: diagnostics || null,
            diagnosticRelevance: diagnostic_relevance || (diagnostics?.relevance || 'sin_errores'),
            diagnosticScore: Number(diagnostic_score || diagnostics?.score || 0)
        });

        res.status(201).json({ success: true, message: `Ticket #${ticket.ticket_code} creado y enviado a Soporte Técnico`, ticket, data: ticket });
    } catch (error) {
        console.error('Error createTicket:', error);
        res.status(400).json({ message: error.message || 'Error al crear el ticket de soporte' });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_notes, resolved_version, assigned_to, assigned_name } = req.body;
        const validStatuses = ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado'];
        if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Estado de ticket inválido' });

        const ticket = await ticketService.getTicketById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

        const isCreator = Number(ticket.user_id) === Number(req.user.id);
        const isSameTenant = Number(ticket.company_id) === Number(req.companyId || req.company_id);
        if (req.user?.role !== 'SuperAdmin' && !isCreator && !isSameTenant) {
            return res.status(403).json({ message: 'No tienes autorización para modificar tickets de otra empresa' });
        }

        const isTech = await checkIsTechManager(req);
        if (!isTech && !(isCreator && status === 'cerrado')) {
            return res.status(403).json({ message: 'Solo el equipo técnico puede cambiar el estado del ticket' });
        }

        const actorName = await getUserFullName(req.user.id, req.user.nombre || 'Soporte Técnico');
        const updated = await ticketService.updateTicketStatus(id, {
            status,
            assignedTo: assigned_to !== undefined ? assigned_to : (status === 'en_proceso' ? req.user.id : null),
            assignedName: assigned_name || (status === 'en_proceso' ? actorName : null),
            resolvedByName: status === 'resuelto' ? actorName : null,
            resolutionNotes: resolution_notes !== undefined ? resolution_notes : null,
            resolvedVersion: resolved_version || null,
            updatedByType: isTech ? 'tech' : 'user',
            updatedById: req.user.id
        });
        await require('../services/ticketAiTaskBridge.service').syncTicketToAiTask(updated);

        res.json({
            success: true,
            message: status === 'resuelto'
                ? `Ticket #${updated.ticket_code} marcado como resuelto. Se ha notificado únicamente a ${updated.user_name}.`
                : `Estado del ticket #${updated.ticket_code} actualizado a ${status}`,
            ticket: updated, data: updated
        });
    } catch (error) {
        console.error('Error updateTicketStatus:', error);
        res.status(500).json({ message: error.message || 'Error al actualizar el estado del ticket' });
    }
};

const addMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, screenshot_base64, attachment_base64 } = req.body;
        const rawImg = attachment_base64 || screenshot_base64 || null;
        if ((!message || !String(message).trim()) && !rawImg && !req.file) return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
        const ticket = await ticketService.getTicketById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

        const isCreator = Number(ticket.user_id) === Number(req.user.id);
        const isSameTenant = Number(ticket.company_id) === Number(req.companyId || req.company_id);
        if (req.user?.role !== 'SuperAdmin' && !isCreator && !isSameTenant) {
            return res.status(403).json({ message: 'No autorizado para comentar en tickets de otra empresa' });
        }

        const isTech = await checkIsTechManager(req);
        if (!isTech && !isCreator) return res.status(403).json({ message: 'No autorizado' });

        const attachmentUrl = req.file ? `/uploads/${path.basename(req.file.filename)}` : (rawImg ? saveBase64Screenshot(rawImg) : null);
        const senderName = await getUserFullName(req.user.id, 'Usuario');
        const updated = await ticketService.addTicketMessage(id, {
            senderType: isTech && !isCreator ? 'tech' : 'user',
            senderId: req.user.id, senderName, message: String(message || 'Adjunto imagen'), attachmentUrl
        });
        res.json({ success: true, ticket: updated, data: updated });
    } catch (error) {
        console.error('Error addTicketMessage:', error);
        res.status(400).json({ message: error.message || 'Error al enviar mensaje en el ticket' });
    }
};

module.exports = { getTickets, getTicketStats, getPendingResolvedForCreator, acknowledgeResolvedTicket, getTicketDetail, createTicket, updateStatus, addMessage, ...require('./ticketAiBundle.controller'), ...require('./ticketAgyFlow.controller') };
