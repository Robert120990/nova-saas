const pool = require('../config/db');

const IVA_RATE = 0.13;
const DEFAULT_DAILY_RATE = 195.00;

function computeBilling(daysOn, dailyRate) {
    const days = Math.max(0, parseFloat(daysOn) || 0);
    const rate = Math.max(0, parseFloat(dailyRate ?? DEFAULT_DAILY_RATE) || 0);
    const subtotal = +(days * rate).toFixed(2);
    const iva_amount = +(subtotal * IVA_RATE).toFixed(2);
    const total_with_iva = +(subtotal + iva_amount).toFixed(2);
    const daily_iva = +(rate * IVA_RATE).toFixed(2);
    const daily_with_iva = +(rate + daily_iva).toFixed(2);
    return {
        days_on: days,
        daily_rate: rate,
        daily_iva,
        daily_with_iva,
        subtotal,
        iva_amount,
        total_with_iva
    };
}

function computeElapsedDays(turnedOnAt) {
    if (!turnedOnAt) return 0;
    const startMs = new Date(turnedOnAt).getTime();
    if (Number.isNaN(startMs)) return 0;
    const diffMs = Math.max(0, Date.now() - startMs);
    return Math.max(1, Math.ceil(diffMs / 86400000));
}

async function logIndustrialEvent(companyId, eventType, description, payload, user) {
    try {
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, ?, 'info', ?, ?, ?)`,
            [
                companyId,
                eventType,
                description,
                JSON.stringify(payload || {}),
                user?.nombre || user?.username || 'Operador Planta'
            ]
        );
    } catch {
        // No bloquear flujo principal si la tabla de eventos opcional no está disponible
    }
}

async function ensureDefaultContainers(companyId) {
    const [existing] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM egg_storage_containers WHERE company_id = ?',
        [companyId]
    );
    if ((existing[0]?.cnt || 0) > 0) return;

    const values = [];
    const placeholders = [];
    for (let num = 1; num <= 10; num++) {
        const code = `CONT-${String(num).padStart(2, '0')}`;
        const name = `Contenedor #${num}`;
        placeholders.push('(?, ?, ?, ?, 0, 0, ?)');
        values.push(companyId, num, code, name, DEFAULT_DAILY_RATE);
    }

    await pool.query(
        `INSERT IGNORE INTO egg_storage_containers
         (company_id, container_number, code, name, is_active_power, days_on, daily_rate)
         VALUES ${placeholders.join(', ')}`,
        values
    );
}

async function getContainersOverview(companyId) {
    await ensureDefaultContainers(companyId);

    const [rows] = await pool.query(
        `SELECT * FROM egg_storage_containers
         WHERE company_id = ?
         ORDER BY container_number ASC, id ASC`,
        [companyId]
    );

    const containers = rows.map(row => {
        const isActive = Boolean(row.is_active_power);
        const billing = computeBilling(row.days_on, row.daily_rate);
        const elapsed_days_since_on = isActive ? computeElapsedDays(row.turned_on_at) : 0;
        return {
            ...row,
            is_active_power: isActive,
            elapsed_days_since_on,
            ...billing
        };
    });

    const total_containers = containers.length;
    const active_count = containers.filter(c => c.is_active_power).length;
    const available_count = total_containers - active_count;
    const total_days_on = +containers.reduce((acc, c) => acc + c.days_on, 0).toFixed(2);
    const total_subtotal = +containers.reduce((acc, c) => acc + c.subtotal, 0).toFixed(2);
    const total_iva = +containers.reduce((acc, c) => acc + c.iva_amount, 0).toFixed(2);
    const total_with_iva = +containers.reduce((acc, c) => acc + c.total_with_iva, 0).toFixed(2);
    const default_daily_rate = containers[0]?.daily_rate ?? DEFAULT_DAILY_RATE;
    const default_daily_iva = +(default_daily_rate * IVA_RATE).toFixed(2);
    const default_daily_with_iva = +(default_daily_rate + default_daily_iva).toFixed(2);

    const [logs] = await pool.query(
        `SELECT * FROM egg_storage_container_logs
         WHERE company_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [companyId]
    );

    return {
        containers,
        summary: {
            total_containers,
            available_count,
            active_count,
            total_days_on,
            default_daily_rate,
            default_daily_iva,
            default_daily_with_iva,
            iva_rate_percent: 13,
            total_subtotal,
            total_iva,
            total_with_iva
        },
        logs
    };
}

async function addContainer(companyId, payload, user) {
    await ensureDefaultContainers(companyId);

    const [maxRow] = await pool.query(
        `SELECT COALESCE(MAX(container_number), 0) AS max_num,
                COALESCE(MAX(daily_rate), ?) AS current_rate
         FROM egg_storage_containers
         WHERE company_id = ?`,
        [DEFAULT_DAILY_RATE, companyId]
    );

    const quantity = Math.min(Math.max(parseInt(payload.quantity, 10) || 1, 1), 20);
    const baseRate = payload.daily_rate !== undefined && payload.daily_rate !== ''
        ? parseFloat(payload.daily_rate)
        : parseFloat(maxRow[0]?.current_rate || DEFAULT_DAILY_RATE);

    let nextNum = (maxRow[0]?.max_num || 0) + 1;

    for (let i = 0; i < quantity; i++) {
        const num = nextNum + i;
        const code = payload.code && quantity === 1
            ? String(payload.code).trim().toUpperCase()
            : `CONT-${String(num).padStart(2, '0')}`;
        const name = payload.name && quantity === 1
            ? String(payload.name).trim()
            : `Contenedor #${num}`;
        const isActive = payload.is_active_power ? 1 : 0;
        const daysOn = Math.max(0, parseFloat(payload.days_on) || 0);
        const notes = payload.notes ? String(payload.notes).trim() : null;

        const [res] = await pool.query(
            `INSERT INTO egg_storage_containers
             (company_id, container_number, code, name, is_active_power, days_on, daily_rate, turned_on_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, num, code, name, isActive, daysOn, baseRate, isActive ? new Date() : null, notes]
        );

        if (isActive || daysOn > 0) {
            const billing = computeBilling(daysOn, baseRate);
            await pool.query(
                `INSERT INTO egg_storage_container_logs
                 (company_id, container_id, container_name, action_type, days_on, daily_rate, subtotal, iva_amount, total_with_iva, started_at, notes, user_id, user_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
                [
                    companyId,
                    res.insertId,
                    name,
                    isActive ? 'encendido' : 'ajuste_dias',
                    billing.days_on,
                    billing.daily_rate,
                    billing.subtotal,
                    billing.iva_amount,
                    billing.total_with_iva,
                    notes || 'Contenedor adicionado',
                    user?.id || null,
                    user?.nombre || user?.username || 'Sistema'
                ]
            );
        }
    }

    return getContainersOverview(companyId);
}

async function toggleContainerPower(companyId, containerId, payload, user) {
    const [rows] = await pool.query(
        'SELECT * FROM egg_storage_containers WHERE id = ? AND company_id = ?',
        [containerId, companyId]
    );
    if (!rows.length) {
        const err = new Error('Contenedor no encontrado.');
        err.status = 404;
        throw err;
    }

    const current = rows[0];
    const nextPower = payload.is_active_power !== undefined
        ? (payload.is_active_power ? 1 : 0)
        : (current.is_active_power ? 0 : 1);

    let nextDays = parseFloat(current.days_on || 0);
    if (payload.days_on !== undefined && payload.days_on !== null && payload.days_on !== '') {
        nextDays = Math.max(0, parseFloat(payload.days_on) || 0);
    } else if (nextPower === 1 && nextDays === 0) {
        nextDays = 1;
    }

    const nextNotes = payload.notes !== undefined ? (payload.notes || null) : current.notes;
    const rate = parseFloat(current.daily_rate || DEFAULT_DAILY_RATE);
    const billing = computeBilling(nextDays, rate);

    if (nextPower === 1) {
        await pool.query(
            `UPDATE egg_storage_containers
             SET is_active_power = 1,
                 days_on = ?,
                 turned_on_at = NOW(),
                 notes = ?
             WHERE id = ? AND company_id = ?`,
            [billing.days_on, nextNotes, containerId, companyId]
        );
    } else {
        await pool.query(
            `UPDATE egg_storage_containers
             SET is_active_power = 0,
                 days_on = ?,
                 turned_off_at = NOW(),
                 notes = ?
             WHERE id = ? AND company_id = ?`,
            [billing.days_on, nextNotes, containerId, companyId]
        );
    }

    await pool.query(
        `INSERT INTO egg_storage_container_logs
         (company_id, container_id, container_name, action_type, days_on, daily_rate, subtotal, iva_amount, total_with_iva, started_at, ended_at, notes, user_id, user_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            companyId,
            containerId,
            current.name,
            nextPower === 1 ? 'encendido' : 'apagado',
            billing.days_on,
            billing.daily_rate,
            billing.subtotal,
            billing.iva_amount,
            billing.total_with_iva,
            nextPower === 1 ? new Date() : current.turned_on_at,
            nextPower === 0 ? new Date() : null,
            nextNotes,
            user?.id || null,
            user?.nombre || user?.username || 'Sistema'
        ]
    );

    await logIndustrialEvent(
        companyId,
        nextPower === 1 ? 'container.turned_on' : 'container.turned_off',
        `${current.name} (${current.code}) ${nextPower === 1 ? 'ENCENDIDO' : 'APAGADO'} — ${billing.days_on} día(s), Total: $${billing.total_with_iva.toFixed(2)} (IVA incl.)`,
        { container_id: containerId, code: current.code, is_active_power: Boolean(nextPower), ...billing },
        user
    );

    return getContainersOverview(companyId);
}

async function updateContainer(companyId, containerId, payload, user) {
    const [rows] = await pool.query(
        'SELECT * FROM egg_storage_containers WHERE id = ? AND company_id = ?',
        [containerId, companyId]
    );
    if (!rows.length) {
        const err = new Error('Contenedor no encontrado.');
        err.status = 404;
        throw err;
    }

    const current = rows[0];
    const name = payload.name !== undefined ? String(payload.name).trim() : current.name;
    const code = payload.code !== undefined ? String(payload.code).trim().toUpperCase() : current.code;
    const daysOn = payload.days_on !== undefined ? Math.max(0, parseFloat(payload.days_on) || 0) : parseFloat(current.days_on || 0);
    const dailyRate = payload.daily_rate !== undefined ? Math.max(0, parseFloat(payload.daily_rate) || 0) : parseFloat(current.daily_rate || DEFAULT_DAILY_RATE);
    const isActive = payload.is_active_power !== undefined ? (payload.is_active_power ? 1 : 0) : current.is_active_power;
    const notes = payload.notes !== undefined ? (payload.notes ? String(payload.notes).trim() : null) : current.notes;

    await pool.query(
        `UPDATE egg_storage_containers
         SET name = ?,
             code = ?,
             days_on = ?,
             daily_rate = ?,
             is_active_power = ?,
             notes = ?
         WHERE id = ? AND company_id = ?`,
        [name, code, daysOn, dailyRate, isActive, notes, containerId, companyId]
    );

    if (payload.log_change) {
        const billing = computeBilling(daysOn, dailyRate);
        await pool.query(
            `INSERT INTO egg_storage_container_logs
             (company_id, container_id, container_name, action_type, days_on, daily_rate, subtotal, iva_amount, total_with_iva, started_at, notes, user_id, user_name)
             VALUES (?, ?, ?, 'ajuste_dias', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId,
                containerId,
                name,
                billing.days_on,
                billing.daily_rate,
                billing.subtotal,
                billing.iva_amount,
                billing.total_with_iva,
                current.turned_on_at,
                notes || 'Ajuste de días de almacenamiento',
                user?.id || null,
                user?.nombre || user?.username || 'Sistema'
            ]
        );
    }

    return getContainersOverview(companyId);
}

async function resetContainerCycle(companyId, containerId, payload, user) {
    const [rows] = await pool.query(
        'SELECT * FROM egg_storage_containers WHERE id = ? AND company_id = ?',
        [containerId, companyId]
    );
    if (!rows.length) {
        const err = new Error('Contenedor no encontrado.');
        err.status = 404;
        throw err;
    }

    const current = rows[0];
    const billing = computeBilling(current.days_on, current.daily_rate);

    if (billing.days_on > 0) {
        await pool.query(
            `INSERT INTO egg_storage_container_logs
             (company_id, container_id, container_name, action_type, days_on, daily_rate, subtotal, iva_amount, total_with_iva, started_at, ended_at, notes, user_id, user_name)
             VALUES (?, ?, ?, 'cierre_ciclo', ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
            [
                companyId,
                containerId,
                current.name,
                billing.days_on,
                billing.daily_rate,
                billing.subtotal,
                billing.iva_amount,
                billing.total_with_iva,
                current.turned_on_at,
                payload?.notes || current.notes || 'Ciclo cerrado y reiniciado a 0 días',
                user?.id || null,
                user?.nombre || user?.username || 'Sistema'
            ]
        );

        await logIndustrialEvent(
            companyId,
            'container.cycle_closed',
            `Ciclo cerrado en ${current.name} (${current.code}): ${billing.days_on} día(s), Subtotal: $${billing.subtotal.toFixed(2)}, Total con IVA: $${billing.total_with_iva.toFixed(2)}`,
            { container_id: containerId, code: current.code, ...billing },
            user
        );
    }

    await pool.query(
        `UPDATE egg_storage_containers
         SET is_active_power = 0,
             days_on = 0,
             turned_off_at = NOW(),
             notes = NULL
         WHERE id = ? AND company_id = ?`,
        [containerId, companyId]
    );

    return getContainersOverview(companyId);
}

async function updateGlobalDailyRate(companyId, dailyRate) {
    const rate = Math.max(0, parseFloat(dailyRate) || DEFAULT_DAILY_RATE);
    await pool.query(
        'UPDATE egg_storage_containers SET daily_rate = ? WHERE company_id = ?',
        [rate, companyId]
    );
    return getContainersOverview(companyId);
}

async function deleteContainer(companyId, containerId) {
    await pool.query(
        'DELETE FROM egg_storage_containers WHERE id = ? AND company_id = ?',
        [containerId, companyId]
    );
    return getContainersOverview(companyId);
}

module.exports = {
    getContainersOverview,
    addContainer,
    toggleContainerPower,
    updateContainer,
    resetContainerCycle,
    updateGlobalDailyRate,
    deleteContainer
};
