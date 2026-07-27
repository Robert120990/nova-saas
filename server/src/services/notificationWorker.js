const pool = require('../config/db');
const { render } = require('./template.service');
const { evaluateAll } = require('./condition.service');
const whatsappService = require('./whatsapp.service');
const mailerService = require('./mailer.service');
const { sendToUser } = require('./websocket.service');

const actionCache = new Map();
let cacheTime = 0;
const CACHE_TTL = 60000;
const POLL_INTERVAL = 1500;
const BATCH_SIZE = 10;

async function getAction(actionCode) {
    const now = Date.now();
    if (cacheTime && now - cacheTime < CACHE_TTL && actionCache.has(actionCode)) {
        return actionCache.get(actionCode);
    }
    const [rows] = await pool.query('SELECT * FROM notification_actions WHERE code = ? AND is_active = 1', [actionCode]);
    const action = rows[0] || null;
    actionCache.set(actionCode, action);
    cacheTime = now;
    return action;
}

async function findMatchingRules(actionCode, companyId, branchId, context) {
    const [rules] = await pool.query(`
        SELECT r.* FROM notification_rules r
        WHERE r.action_code = ?
        AND r.company_id = ?
        AND (r.branch_id = ? OR r.branch_id IS NULL)
        AND r.is_active = 1
    `, [actionCode, companyId, branchId]);

    const matchingRules = [];
    for (const rule of rules) {
        const [rawConditions] = await pool.query(
            'SELECT * FROM notification_rule_conditions WHERE rule_id = ?',
            [rule.id]
        );
        const conditions = rawConditions.filter(c => c.field && c.field.trim());
        if (evaluateAll(conditions, context)) {
            const [recipients] = await pool.query(`
                SELECT u.id, u.email, u.nombre, u.telefono
                FROM notification_rule_recipients rcr
                JOIN users u ON rcr.user_id = u.id
                WHERE rcr.rule_id = ?
            `, [rule.id]);
            matchingRules.push({ ...rule, conditions, recipients });
        }
    }
    return matchingRules;
}

async function processJob(job) {
    const context = typeof job.context === 'string' ? JSON.parse(job.context) : job.context;

    const action = await getAction(job.action_code);
    if (!action) return;

    const rules = await findMatchingRules(job.action_code, job.company_id, job.branch_id, context);
    if (rules.length === 0) return;

    for (const rule of rules) {
        const title = rule.title_template
            ? render(rule.title_template, context)
            : render(action.default_title_template, context);
        const message = rule.body_template
            ? render(rule.body_template, context)
            : render(action.default_body_template, context);
        const link = context.link || null;

        for (const recipient of rule.recipients) {
            if (rule.channel_system) {
                const [result] = await pool.query(
                    'INSERT INTO notifications (company_id, user_id, rule_id, action_code, title, message, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [job.company_id, recipient.id, rule.id, job.action_code, title, message, link]
                );
                sendToUser(recipient.id, 'new_notification', {
                    id: result.insertId,
                    action_code: job.action_code,
                    title,
                    message,
                    link,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }

            if (rule.channel_email && recipient.email) {
                const branchName = context.sucursal || 'Sucursal';
                mailerService.sendMail({
                    branchId: job.branch_id,
                    to: recipient.email,
                    subject: title,
                    text: message,
                    html: buildEmailHtml(title, message, link)
                }).catch(err => console.error(`[NotificationWorker] Error email a ${recipient.email}:`, err.message));
            }

            if (rule.channel_whatsapp && recipient.telefono) {
                let phone = recipient.telefono.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '503' + phone;
                if (!phone.startsWith('503')) phone = '503' + phone;
                whatsappService.sendMessage(phone, `${title}\n\n${message}`, job.branch_id)
                    .catch(err => console.error(`[NotificationWorker] Error WhatsApp a ${phone}:`, err.message));
            }
        }
    }
}

function buildEmailHtml(title, message, link) {
    const msgHtml = message.replace(/\n/g, '<br>');
    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); margin: -20px -20px 20px; padding: 20px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0;">${title}</h2>
            </div>
            <div style="color: #374151; line-height: 1.6;">${msgHtml}</div>
            ${link ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;"><a href="${link}" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Ver detalle</a></div>` : ''}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Este es un mensaje automático del Sistema de Notificaciones.</p>
        </div>
    `;
}

async function pollQueue() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT id, action_code, company_id, branch_id, context
             FROM notification_queue
             WHERE status = 'pending'
             ORDER BY id ASC
             LIMIT ? FOR UPDATE SKIP LOCKED`,
            [BATCH_SIZE]
        );

        if (rows.length === 0) {
            await connection.commit();
            return;
        }

        const ids = rows.map(r => r.id);
        await connection.query(
            'UPDATE notification_queue SET status = ? WHERE id IN (?)',
            ['processing', ids]
        );

        await connection.commit();
        connection.release();
        connection = null;

        for (const job of rows) {
            try {
                await processJob(job);
                await pool.query(
                    'UPDATE notification_queue SET status = ?, processed_at = NOW() WHERE id = ?',
                    ['done', job.id]
                );
            } catch (error) {
                console.error(`[NotificationWorker] Error procesando job ${job.id}:`, error);
                await pool.query(
                    'UPDATE notification_queue SET status = ?, error_message = ?, processed_at = NOW() WHERE id = ?',
                    ['failed', error.message, job.id]
                );
            }
        }
    } catch (error) {
        console.error('[NotificationWorker] Error en pollQueue:', error);
        if (connection) {
            try { await connection.rollback(); } catch (e) {}
        }
    } finally {
        if (connection) connection.release();
    }
}

let intervalHandle = null;

function startWorker() {
    if (intervalHandle) return;
    console.log('[NotificationWorker] Iniciado (intervalo: ' + POLL_INTERVAL + 'ms)');
    intervalHandle = setInterval(pollQueue, POLL_INTERVAL);
}

function stopWorker() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log('[NotificationWorker] Detenido');
    }
}

module.exports = { startWorker, stopWorker };
