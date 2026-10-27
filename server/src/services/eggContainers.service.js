const pool = require('../config/db');

const IVA_RATE = 0.13;
const DEFAULT_DAILY_RATE = 195.00;

function formatYMD(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        return dateInput.trim();
    }
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

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

function computeElapsedDaysSinceReference(turnedOnAt, lastCutoffDate, targetEndDate = null) {
    const refStartStr = formatYMD(turnedOnAt);
    const cutoffStr = formatYMD(lastCutoffDate);
    let effectiveStartStr = refStartStr || cutoffStr;
    if (refStartStr && cutoffStr) {
        effectiveStartStr = refStartStr > cutoffStr ? refStartStr : cutoffStr;
    }
    if (!effectiveStartStr) return 0;

    const endStr = formatYMD(targetEndDate) || formatYMD(new Date());
    const startMs = new Date(`${effectiveStartStr}T00:00:00`).getTime();
    const endMs = new Date(`${endStr}T00:00:00`).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 0;

    const diffDays = Math.round((endMs - startMs) / 86400000);
    return Math.max(1, diffDays);
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

    // Obtener historial de cortes por fechas (Estados de Cuenta)
    let cutoffs = [];
    try {
        const [cutoffRows] = await pool.query(
            `SELECT * FROM egg_storage_container_cutoffs
             WHERE company_id = ?
             ORDER BY period_end DESC, id DESC
             LIMIT 60`,
            [companyId]
        );

        if (cutoffRows.length > 0) {
            const cutoffIds = cutoffRows.map(c => c.id);
            const [itemRows] = await pool.query(
                `SELECT * FROM egg_storage_container_cutoff_items
                 WHERE company_id = ? AND cutoff_id IN (?)
                 ORDER BY container_number ASC, id ASC`,
                [companyId, cutoffIds]
            );
            const itemsByCutoff = {};
            for (const item of itemRows) {
                if (!itemsByCutoff[item.cutoff_id]) itemsByCutoff[item.cutoff_id] = [];
                itemsByCutoff[item.cutoff_id].push({
                    ...item,
                    was_active_power: Boolean(item.was_active_power),
                    days_on: parseFloat(item.days_on || 0),
                    daily_rate: parseFloat(item.daily_rate || DEFAULT_DAILY_RATE),
                    subtotal: parseFloat(item.subtotal || 0),
                    iva_amount: parseFloat(item.iva_amount || 0),
                    total_with_iva: parseFloat(item.total_with_iva || 0)
                });
            }

            cutoffs = cutoffRows.map(c => ({
                ...c,
                period_start: formatYMD(c.period_start),
                period_end: formatYMD(c.period_end),
                previous_cutoff_date: formatYMD(c.previous_cutoff_date),
                total_days_on: parseFloat(c.total_days_on || 0),
                daily_rate: parseFloat(c.daily_rate || DEFAULT_DAILY_RATE),
                subtotal: parseFloat(c.subtotal || 0),
                iva_amount: parseFloat(c.iva_amount || 0),
                total_with_iva: parseFloat(c.total_with_iva || 0),
                items: itemsByCutoff[c.id] || []
            }));
        }
    } catch {
        cutoffs = [];
    }

    const lastCutoff = cutoffs.length > 0 ? cutoffs[0] : null;
    const todayYMD = formatYMD(new Date());

    // El nuevo corte SIEMPRE parte desde el último corte realizado (lastCutoff.period_end)
    let nextPeriodStart = lastCutoff ? lastCutoff.period_end : null;
    if (!nextPeriodStart) {
        const activeDates = rows
            .map(r => formatYMD(r.turned_on_at))
            .filter(Boolean)
            .sort();
        const now = new Date();
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        nextPeriodStart = activeDates[0] || firstOfMonth;
    }

    const containers = rows.map(row => {
        const isActive = Boolean(row.is_active_power);
        const billing = computeBilling(row.days_on, row.daily_rate);
        const refCutoffDate = row.last_cutoff_date || lastCutoff?.period_end || null;
        const elapsed_days_since_on = isActive
            ? computeElapsedDaysSinceReference(row.turned_on_at, refCutoffDate, todayYMD)
            : 0;
        return {
            ...row,
            is_active_power: isActive,
            last_cutoff_date: formatYMD(row.last_cutoff_date) || lastCutoff?.period_end || null,
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
        cutoff_chain: {
            has_previous_cutoff: Boolean(lastCutoff),
            last_cutoff_id: lastCutoff?.id || null,
            last_cutoff_code: lastCutoff?.cutoff_code || null,
            last_cutoff_date: lastCutoff?.period_end || null,
            last_cutoff_period_start: lastCutoff?.period_start || null,
            last_cutoff_total: lastCutoff?.total_with_iva || 0,
            last_cutoff_days: lastCutoff?.total_days_on || 0,
            last_customer_name: lastCutoff?.customer_name || '',
            last_customer_id: lastCutoff?.customer_id || null,
            next_period_start: nextPeriodStart,
            suggested_period_end: todayYMD >= nextPeriodStart ? todayYMD : nextPeriodStart,
            total_cutoffs_count: cutoffs.length
        },
        cutoffs,
        logs
    };
}

async function addContainer(companyId, payload, user) {
    await ensureDefaultContainers(companyId);

    const [maxRow] = await pool.query(
        `SELECT COALESCE(MAX(container_number), 0) AS max_num,
                COALESCE(MAX(daily_rate), ?) AS current_rate,
                MAX(last_cutoff_date) AS last_cut_date,
                MAX(last_cutoff_id) AS last_cut_id
         FROM egg_storage_containers
         WHERE company_id = ?`,
        [DEFAULT_DAILY_RATE, companyId]
    );

    const quantity = Math.min(Math.max(parseInt(payload.quantity, 10) || 1, 1), 20);
    const baseRate = payload.daily_rate !== undefined && payload.daily_rate !== ''
        ? parseFloat(payload.daily_rate)
        : parseFloat(maxRow[0]?.current_rate || DEFAULT_DAILY_RATE);
    const lastCutDate = maxRow[0]?.last_cut_date || null;
    const lastCutId = maxRow[0]?.last_cut_id || null;

    const nextNum = (maxRow[0]?.max_num || 0) + 1;

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
             (company_id, container_number, code, name, is_active_power, days_on, daily_rate, turned_on_at, last_cutoff_date, last_cutoff_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, num, code, name, isActive, daysOn, baseRate, isActive ? new Date() : null, lastCutDate, lastCutId, notes]
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

    await pool.query(
        `UPDATE egg_storage_containers
         SET is_active_power = ?,
             days_on = ?,
             turned_on_at = ${nextPower === 1 ? 'NOW()' : 'turned_on_at'},
             turned_off_at = ${nextPower === 0 ? 'NOW()' : 'turned_off_at'},
             notes = ?
         WHERE id = ? AND company_id = ?`,
        [nextPower, billing.days_on, nextNotes, containerId, companyId]
    );

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
         SET name = ?, code = ?, days_on = ?, daily_rate = ?, is_active_power = ?, notes = ?
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
    }

    await pool.query(
        `UPDATE egg_storage_containers
         SET is_active_power = 0, days_on = 0, turned_off_at = NOW(), notes = NULL
         WHERE id = ? AND company_id = ?`,
        [containerId, companyId]
    );

    return getContainersOverview(companyId);
}

async function updateGlobalDailyRate(companyId, dailyRate) {
    const rate = Math.max(0, parseFloat(dailyRate) || DEFAULT_DAILY_RATE);
    await pool.query('UPDATE egg_storage_containers SET daily_rate = ? WHERE company_id = ?', [rate, companyId]);
    return getContainersOverview(companyId);
}

async function deleteContainer(companyId, containerId) {
    await pool.query('DELETE FROM egg_storage_containers WHERE id = ? AND company_id = ?', [containerId, companyId]);
    return getContainersOverview(companyId);
}

module.exports = {
    IVA_RATE,
    DEFAULT_DAILY_RATE,
    formatYMD,
    computeBilling,
    computeElapsedDaysSinceReference,
    logIndustrialEvent,
    ensureDefaultContainers,
    getContainersOverview,
    addContainer,
    toggleContainerPower,
    updateContainer,
    resetContainerCycle,
    updateGlobalDailyRate,
    deleteContainer
};
